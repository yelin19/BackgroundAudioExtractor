import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

type PipelineStage = "extracting" | "separating";

export type PickedVideo = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
};

export type PipelineResult = {
  originalAudioUri: string;
  backgroundAudioUri: string;
  mode: "native" | "preview";
  sourceName: string;
};

export type PipelineProgress = (stage: PipelineStage) => void;

const TEMP_PREFIX = "bgtrack";

function toFfmpegPath(uri: string) {
  return uri.startsWith("file://") ? uri.slice("file://".length) : uri;
}

function tempFile(name: string) {
  return new File(Paths.cache, name);
}

async function removeIfPresent(uri: string | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best effort; the next run will overwrite its own names.
  }
}

export async function clearTemporaryFiles(uris: (string | undefined)[] = []) {
  await Promise.all(uris.map(removeIfPresent));
}

export async function pickVideo(): Promise<PickedVideo | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "video/*",
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
  };
}

async function executeFfmpeg(argumentsArray: string[]) {
  // Keep the native-only dependency out of the browser execution path.
  // An Expo Go session does not include this module; the user-facing error
  // explains that a native APK/development build is required.
  let ffmpegKit: typeof import("ffmpeg-kit-react-native");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ffmpegKit = require("ffmpeg-kit-react-native");
  } catch {
    throw new Error("Native audio engine မပါသေးပါ။ APK/development build ဖြင့် စမ်းသပ်ပါ။");
  }

  const session = await ffmpegKit.FFmpegKit.executeWithArguments(argumentsArray);
  const returnCode = await session.getReturnCode();
  if (!ffmpegKit.ReturnCode.isSuccess(returnCode)) {
    const detail = (await session.getFailStackTrace()) || "FFmpeg processing failed";
    throw new Error(detail.slice(-220));
  }
}

export async function runAudioPipeline(
  video: PickedVideo,
  onProgress: PipelineProgress,
): Promise<PipelineResult> {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const original = tempFile(`${TEMP_PREFIX}-original-${stamp}.m4a`);
  const background = tempFile(`${TEMP_PREFIX}-bg-audio-${stamp}.m4a`);

  await clearTemporaryFiles([original.uri, background.uri]);

  if (Platform.OS === "web") {
    // Browser preview keeps the workflow demonstrable without claiming that
    // browser APIs can demux and process arbitrary local video files.
    onProgress("extracting");
    await new Promise((resolve) => setTimeout(resolve, 380));
    onProgress("separating");
    await new Promise((resolve) => setTimeout(resolve, 620));
    return {
      originalAudioUri: video.uri,
      backgroundAudioUri: video.uri,
      mode: "preview",
      sourceName: video.name,
    };
  }

  try {
    onProgress("extracting");
    await executeFfmpeg([
      "-y",
      "-i",
      toFfmpegPath(video.uri),
      "-vn",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      toFfmpegPath(original.uri),
    ]);

    onProgress("separating");
    // Lightweight background-preserving mix: subtract the stereo center so
    // center-panned speech is strongly reduced while side-panned ambience and
    // music remain. It is intentionally not an ML model; off-center speech
    // can still remain and a future model mode can handle that case.
    // The second command reads only the temporary original-audio file above.
    await executeFfmpeg([
      "-y",
      "-i",
      toFfmpegPath(original.uri),
      "-af",
      "pan=stereo|c0=c0-c1|c1=c1-c0,volume=0.82,alimiter=limit=0.95",
      "-ac",
      "2",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      toFfmpegPath(background.uri),
    ]);

    return {
      originalAudioUri: original.uri,
      backgroundAudioUri: background.uri,
      mode: "native",
      sourceName: video.name,
    };
  } catch (error) {
    await clearTemporaryFiles([original.uri, background.uri]);
    throw error;
  }
}

export async function shareBackgroundAudio(uri: string, sourceName: string) {
  if (Platform.OS === "web") {
    throw new Error("Web Preview တွင် export မလုပ်နိုင်သေးပါ။ Android APK မှာ စမ်းသပ်ပါ။");
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("ဒီဖုန်းမှာ system share/save sheet မရနိုင်ပါ။");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "audio/mp4",
    dialogTitle: `Save bg_audio — ${sourceName}`,
    UTI: "public.mpeg-4-audio",
  });
}

export function describeDurationHint() {
  return "15–30 sec clips";
}

export function formatFileSize(bytes?: number) {
  if (!bytes) return "Size unknown";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
