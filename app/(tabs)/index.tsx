import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { ScreenContainer } from "@/components/screen-container";
import {
  clearTemporaryFiles,
  describeDurationHint,
  formatFileSize,
  pickVideo,
  runAudioPipeline,
  shareBackgroundAudio,
  type PickedVideo,
  type PipelineResult,
} from "@/lib/audio-pipeline";

type WorkState = "idle" | "ready" | "extracting" | "separating" | "done" | "error";

type StageProps = {
  number: string;
  title: string;
  subtitle: string;
  active: boolean;
  complete: boolean;
};

const palette = {
  ink: "#07141F",
  panel: "#0D2230",
  panelRaised: "#112B3A",
  line: "#204456",
  text: "#F3F8F8",
  muted: "#8FAAB1",
  cyan: "#74E7E3",
  cyanDeep: "#2EA7AA",
  amber: "#F4B96A",
  red: "#FF7E7E",
  green: "#87E3B0",
};

function StageRow({ number, title, subtitle, active, complete }: StageProps) {
  return (
    <View style={styles.stageRow}>
      <View
        style={[
          styles.stageMarker,
          active && styles.stageMarkerActive,
          complete && styles.stageMarkerComplete,
        ]}
      >
        {complete ? (
          <MaterialIcons name="check" size={17} color={palette.ink} />
        ) : (
          <Text style={[styles.stageNumber, active && styles.stageNumberActive]}>{number}</Text>
        )}
      </View>
      <View style={styles.stageCopy}>
        <Text style={styles.stageTitle}>{title}</Text>
        <Text style={styles.stageSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.stageDot, active && styles.stageDotActive, complete && styles.stageDotComplete]} />
    </View>
  );
}

function ActionButton({
  label,
  hint,
  icon,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  hint?: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.actionButtonSecondary,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
    >
      <MaterialIcons
        name={icon}
        size={22}
        color={disabled ? palette.muted : secondary ? palette.amber : palette.ink}
      />
      <View style={styles.actionButtonCopy}>
        <Text
          style={[
            styles.actionButtonLabel,
            secondary && styles.actionButtonLabelSecondary,
            disabled && styles.actionButtonLabelDisabled,
          ]}
        >
          {label}
        </Text>
        {hint ? <Text style={styles.actionButtonHint}>{hint}</Text> : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={disabled ? palette.muted : palette.cyanDeep} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const [workState, setWorkState] = useState<WorkState>("idle");
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const player = useAudioPlayer(result?.backgroundAudioUri ?? null);
  const playerStatus = useAudioPlayerStatus(player);

  const busy = workState === "extracting" || workState === "separating";
  const hasOutput = Boolean(result?.backgroundAudioUri);
  const progressLabel = useMemo(() => {
    if (workState === "extracting") return "မူရင်းအသံကို ယာယီဖိုင်အဖြစ် ထုတ်နေသည်…";
    if (workState === "separating") return "Background track ကို ခွဲထုတ်နေသည်…";
    if (workState === "done") return result?.mode === "preview" ? "Preview flow ပြီးပါပြီ" : "Background track အဆင်သင့်ပါပြီ";
    return "";
  }, [result?.mode, workState]);

  useEffect(() => {
    if (!result?.backgroundAudioUri) return;
    player.pause();
    void player.seekTo(0);
  }, [player, result?.backgroundAudioUri]);

  const clearWorkflow = async () => {
    player.pause();
    await clearTemporaryFiles([result?.originalAudioUri, result?.backgroundAudioUri, video?.uri]);
    setVideo(null);
    setResult(null);
    setErrorMessage(null);
    setWorkState("idle");
  };

  const handlePickVideo = async () => {
    if (busy) return;
    setErrorMessage(null);
    if (video || result) {
      await clearTemporaryFiles([result?.originalAudioUri, result?.backgroundAudioUri, video?.uri]);
      setResult(null);
      setVideo(null);
    }
    try {
      const picked = await pickVideo();
      if (!picked) return;
      setVideo(picked);
      setWorkState("ready");
    } catch (error) {
      setWorkState("error");
      setErrorMessage(error instanceof Error ? error.message : "Video ရွေးချယ်မှု မအောင်မြင်ပါ။");
    }
  };

  const handleRun = async () => {
    if (!video || busy) return;
    setErrorMessage(null);
    try {
      const pipelineResult = await runAudioPipeline(video, (stage) => {
        setWorkState(stage);
      });
      setResult(pipelineResult);
      setWorkState("done");
    } catch (error) {
      setWorkState("error");
      setErrorMessage(error instanceof Error ? error.message : "Audio processing မအောင်မြင်ပါ။");
    }
  };

  const handlePlay = () => {
    if (!hasOutput) return;
    if (playerStatus.playing) player.pause();
    else player.play();
  };

  const handleExport = async () => {
    if (!result?.backgroundAudioUri || isExporting) return;
    setIsExporting(true);
    setErrorMessage(null);
    try {
      await shareBackgroundAudio(result.backgroundAudioUri, result.sourceName);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "bg_audio ကို သိမ်းမရပါ။");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScreenContainer
      edges={["top", "left", "right", "bottom"]}
      containerClassName="bg-[#07141F]"
      safeAreaClassName="bg-[#07141F]"
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.brandMark}>
            <View style={styles.waveBarShort} />
            <View style={styles.waveBarTall} />
            <View style={styles.waveBarMedium} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.eyebrow}>POCKET AUDIO LAB</Text>
            <Text style={styles.title}>bgtrack</Text>
          </View>
          <View style={styles.clipPill}>
            <MaterialIcons name="timer" size={14} color={palette.cyan} />
            <Text style={styles.clipPillText}>{describeDurationHint()}</Text>
          </View>
        </View>

        <Text style={styles.intro}>
          ဗီဒီယိုထဲက မူရင်းအသံကို အရင်ထုတ်ပြီး၊ BGM / SFX / ambience ပါတဲ့ background track ကို ခွဲထုတ်ပါ။
        </Text>

        <View style={styles.signalRail}>
          <View style={styles.signalRailLine} />
          <View style={styles.signalLabelRow}>
            <Text style={styles.signalLabel}>SIGNAL PATH</Text>
            <Text style={styles.signalStatus}>
              {busy ? "PROCESSING" : hasOutput ? "READY TO PREVIEW" : "WAITING FOR INPUT"}
            </Text>
          </View>
          <StageRow
            number="01"
            title="Original audio"
            subtitle="Video → temporary audio file"
            active={workState === "extracting" || (workState === "ready" && !hasOutput)}
            complete={workState === "separating" || workState === "done"}
          />
          <StageRow
            number="02"
            title="Background track"
            subtitle="Audio file → light speech reduction"
            active={workState === "separating" || workState === "done"}
            complete={workState === "done"}
          />
        </View>

        {!video ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="movie" size={28} color={palette.cyan} />
            </View>
            <Text style={styles.emptyTitle}>ဗီဒီယိုတိုတစ်ခု ရွေးချယ်ပါ</Text>
            <Text style={styles.emptySubtitle}>
              Android ဖုန်းထဲက ၁၅–၃၀ စက္ကန့် clip ကို ရွေးပြီး စမ်းသပ်နိုင်ပါတယ်။
            </Text>
            <ActionButton label="Choose video" hint="ဗီဒီယိုဖိုင် ရွေးရန်" icon="video-library" onPress={handlePickVideo} />
          </View>
        ) : (
          <View style={styles.fileCard}>
            <View style={styles.fileIcon}>
              <MaterialIcons name="movie" size={24} color={palette.cyan} />
            </View>
            <View style={styles.fileCopy}>
              <Text style={styles.fileEyebrow}>SOURCE VIDEO</Text>
              <Text numberOfLines={1} style={styles.fileName}>{video.name}</Text>
              <Text style={styles.fileMeta}>{formatFileSize(video.size)}  ·  {video.mimeType ?? "video"}</Text>
            </View>
            <Pressable onPress={handlePickVideo} disabled={busy} style={styles.changeButton}>
              <MaterialIcons name="swap-vert" size={18} color={busy ? palette.muted : palette.cyan} />
              <Text style={styles.changeButtonText}>ပြောင်း</Text>
            </Pressable>
          </View>
        )}

        {video ? (
          <View style={styles.workCard}>
            <View style={styles.workCardTop}>
              <View>
                <Text style={styles.cardEyebrow}>PHASE 1 + 2</Text>
                <Text style={styles.workTitle}>Run the two-step pipeline</Text>
              </View>
              <View style={[styles.statePill, workState === "error" && styles.statePillError]}>
                {busy ? <ActivityIndicator size="small" color={palette.cyan} /> : <View style={styles.statePillDot} />}
                <Text style={styles.statePillText}>{workState === "ready" ? "READY" : workState.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.workHint}>
              Original audio ကို ယာယီသိမ်းပြီးနောက်မှသာ background separation စတင်ပါမယ်။
            </Text>
            {progressLabel ? <Text style={styles.progressLabel}>{progressLabel}</Text> : null}
            <ActionButton
              label={busy ? "Processing…" : hasOutput ? "Run again" : "Extract + separate"}
              hint={busy ? "ခဏစောင့်ပါ" : "အဆင့် ၂ ဆင့်လုံး စတင်ရန်"}
              icon={busy ? "hourglass-top" : "graphic-eq"}
              onPress={handleRun}
              disabled={busy}
            />
          </View>
        ) : null}

        {hasOutput ? (
          <View style={styles.outputCard}>
            <View style={styles.outputHeader}>
              <View style={styles.outputIcon}>
                <MaterialIcons name="graphic-eq" size={23} color={palette.ink} />
              </View>
              <View style={styles.outputCopy}>
                <Text style={styles.cardEyebrow}>OUTPUT / BG_AUDIO</Text>
                <Text style={styles.outputTitle}>Background track ready</Text>
                <Text style={styles.outputMeta}>{result?.mode === "preview" ? "Web preview mode" : "Temporary AAC audio · light CPU filter"}</Text>
              </View>
              <View style={styles.readyBadge}><MaterialIcons name="check" size={15} color={palette.ink} /></View>
            </View>
            <View style={styles.waveform}>
              {[18, 30, 42, 26, 52, 36, 22, 46, 32, 58, 28, 40, 24, 48, 34, 20, 44, 30, 50, 25, 38, 18].map((height, index) => (
                <View key={index} style={[styles.waveBar, { height }]} />
              ))}
            </View>
            <View style={styles.outputActions}>
              <Pressable onPress={handlePlay} style={styles.playButton}>
                <MaterialIcons name={playerStatus.playing ? "pause" : "play-arrow"} size={28} color={palette.ink} />
                <Text style={styles.playButtonText}>{playerStatus.playing ? "Pause" : "Preview"}</Text>
              </Pressable>
              <Pressable onPress={handleExport} disabled={isExporting} style={styles.exportButton}>
                {isExporting ? <ActivityIndicator size="small" color={palette.amber} /> : <MaterialIcons name="save-alt" size={21} color={palette.amber} />}
                <Text style={styles.exportButtonText}>{isExporting ? "ဖွင့်နေသည်…" : "Save / Share"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={22} color={palette.red} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Processing error</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          </View>
        ) : null}

        {(video || result) ? (
          <Pressable onPress={clearWorkflow} disabled={busy} style={styles.clearButton}>
            <MaterialIcons name="delete-outline" size={18} color={busy ? palette.muted : palette.red} />
            <Text style={[styles.clearButtonText, busy && styles.clearButtonTextDisabled]}>ရှင်းလင်းပြီး ယာယီဖိုင်ဖျက်မည်</Text>
          </Pressable>
        ) : null}

        <View style={styles.footerNote}>
          <MaterialIcons name="offline-bolt" size={16} color={palette.cyanDeep} />
          <Text style={styles.footerText}>Local-first · lightweight · speech residue is acceptable</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: palette.cyan, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  waveBarShort: { width: 3, height: 10, borderRadius: 3, backgroundColor: palette.ink },
  waveBarTall: { width: 3, height: 23, borderRadius: 3, backgroundColor: palette.ink },
  waveBarMedium: { width: 3, height: 16, borderRadius: 3, backgroundColor: palette.ink },
  brandCopy: { flex: 1 },
  eyebrow: { color: palette.cyan, fontSize: 10, letterSpacing: 1.8, fontWeight: "700" },
  title: { color: palette.text, fontSize: 27, lineHeight: 29, fontWeight: "800", letterSpacing: -0.8 },
  clipPill: { flexDirection: "row", alignItems: "center", gap: 5, borderColor: palette.line, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7 },
  clipPillText: { color: palette.muted, fontSize: 10, fontWeight: "700" },
  intro: { color: palette.muted, fontSize: 13, lineHeight: 20, maxWidth: 350, marginTop: 2 },
  signalRail: { position: "relative", paddingLeft: 2, paddingTop: 8, paddingBottom: 1 },
  signalRailLine: { position: "absolute", left: 15, top: 40, bottom: 16, width: 1, backgroundColor: palette.line },
  signalLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  signalLabel: { color: palette.cyanDeep, fontSize: 10, fontWeight: "800", letterSpacing: 1.8 },
  signalStatus: { color: palette.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  stageRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 },
  stageMarker: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center", zIndex: 1 },
  stageMarkerActive: { borderColor: palette.cyan, backgroundColor: palette.panelRaised },
  stageMarkerComplete: { borderColor: palette.cyan, backgroundColor: palette.cyan },
  stageNumber: { color: palette.muted, fontSize: 9, fontWeight: "800" },
  stageNumberActive: { color: palette.cyan },
  stageCopy: { flex: 1 },
  stageTitle: { color: palette.text, fontSize: 14, fontWeight: "700" },
  stageSubtitle: { color: palette.muted, fontSize: 11, marginTop: 3 },
  stageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.line },
  stageDotActive: { backgroundColor: palette.cyan },
  stageDotComplete: { backgroundColor: palette.green },
  emptyCard: { backgroundColor: palette.panel, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 18, gap: 13 },
  emptyIconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#123746", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: palette.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  emptySubtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, maxWidth: 300 },
  actionButton: { minHeight: 58, borderRadius: 16, backgroundColor: palette.cyan, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 11 },
  actionButtonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: palette.amber },
  actionButtonDisabled: { backgroundColor: "#17313D", borderColor: palette.line },
  actionButtonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  actionButtonCopy: { flex: 1 },
  actionButtonLabel: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  actionButtonLabelSecondary: { color: palette.amber },
  actionButtonLabelDisabled: { color: palette.muted },
  actionButtonHint: { color: "#34767A", fontSize: 11, marginTop: 2 },
  fileCard: { backgroundColor: palette.panel, borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  fileIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#123746", alignItems: "center", justifyContent: "center" },
  fileCopy: { flex: 1, minWidth: 0 },
  fileEyebrow: { color: palette.cyanDeep, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  fileName: { color: palette.text, fontSize: 14, fontWeight: "700", marginTop: 3 },
  fileMeta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  changeButton: { padding: 6, alignItems: "center", gap: 2 },
  changeButtonText: { color: palette.cyan, fontSize: 10, fontWeight: "700" },
  workCard: { backgroundColor: palette.panel, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 16, gap: 13 },
  workCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  cardEyebrow: { color: palette.cyanDeep, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  workTitle: { color: palette.text, fontSize: 17, fontWeight: "800", marginTop: 4 },
  statePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 8, paddingVertical: 6 },
  statePillError: { borderColor: palette.red },
  statePillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.green },
  statePillText: { color: palette.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  workHint: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  progressLabel: { color: palette.cyan, fontSize: 12, fontWeight: "700" },
  outputCard: { backgroundColor: "#143339", borderRadius: 22, borderWidth: 1, borderColor: "#2E7778", padding: 16, gap: 15 },
  outputHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  outputIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.cyan, alignItems: "center", justifyContent: "center" },
  outputCopy: { flex: 1 },
  outputTitle: { color: palette.text, fontSize: 16, fontWeight: "800", marginTop: 3 },
  outputMeta: { color: "#8FC7C7", fontSize: 10, marginTop: 3 },
  readyBadge: { width: 25, height: 25, borderRadius: 13, backgroundColor: palette.green, alignItems: "center", justifyContent: "center" },
  waveform: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3 },
  waveBar: { width: 4, borderRadius: 3, backgroundColor: palette.cyan },
  outputActions: { flexDirection: "row", gap: 9 },
  playButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: palette.cyan, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  playButtonText: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  exportButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.amber, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  exportButtonText: { color: palette.amber, fontSize: 13, fontWeight: "800" },
  errorCard: { backgroundColor: "#3A2027", borderRadius: 16, borderWidth: 1, borderColor: "#7B3F48", padding: 13, flexDirection: "row", gap: 10 },
  errorCopy: { flex: 1 },
  errorTitle: { color: palette.red, fontWeight: "800", fontSize: 13 },
  errorText: { color: "#F4C5C5", fontSize: 11, lineHeight: 16, marginTop: 3 },
  clearButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  clearButtonText: { color: palette.red, fontSize: 11, fontWeight: "700" },
  clearButtonTextDisabled: { color: palette.muted },
  footerNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 2 },
  footerText: { color: palette.muted, fontSize: 10 },
});
