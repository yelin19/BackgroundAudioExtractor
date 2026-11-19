# BackgroundAudioExtractor

A lightweight Android background-audio extractor prototype for short 15–30 second videos.

## Workflow

1. Pick a video from the Android device.
2. Extract the original audio to a temporary AAC file.
3. Run the background-track filter on that temporary audio file only.
4. Preview/play the generated `bg_audio` track.
5. Save/share the output with the Android system share sheet.
6. Clear temporary files when replacing or clearing a workflow.

The app intentionally avoids a large ML source-separation model. It uses a lightweight FFmpeg audio filter that favors BGM, sound effects, and ambience while allowing some speech residue.

## Local checks

```bash
pnpm install
pnpm check
npx expo prebuild --no-install --platform android
```

## Build an installable APK

This project uses Expo EAS for native builds because it includes the `ffmpeg-kit-react-native` native module. Install and authenticate with EAS, then run:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

The `preview` profile produces an installable Android `.apk`. The `production` profile is configured for a Play Store `.aab`.

Expo Go can review the interface, but the full two-stage FFmpeg processing requires a native APK/development build.

## Build from GitHub Actions

The repository includes a manual workflow at `.github/workflows/build-apk.yml`. Add an `EXPO_TOKEN` repository secret in GitHub, then open **Actions → Build Android APK → Run workflow**. The workflow starts the EAS `preview` build using `eas.json`.
