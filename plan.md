# Background Audio Extractor — Implementation Plan

## Scope

Build phase 1 and phase 2 of a small portrait Android app for validating 15–30 second videos. The required pipeline is explicit: **video selection → temporary original-audio extraction → background-audio separation**. The output is a previewable and exportable `bg_audio` track. The first version is local-first and keeps intermediate files temporary.

## Implementation approach

The screen is a single focused workbench. Android uses the system document/media picker, `expo-file-system` for temporary paths, `expo-audio` for playback, and `expo-sharing` to hand the generated file to the Android system save/share sheet. Native processing is isolated behind `lib/audio-pipeline.ts`: the production Android build calls the bundled FFmpeg bridge in two separate commands, first extracting AAC original audio and then applying a light background-preserving vocal reduction filter to the extracted file. The second command never reads the video directly. Web/Preview keeps the same state machine and uses a clearly labelled demo fallback so the interface can be reviewed without pretending that browser APIs perform native extraction.

The lightweight separation heuristic intentionally favors music, effects, and ambience over speech. It is not a large ML source-separation model; it can leave some speech behind, as permitted by the request. The UI makes the processing stages visible and prevents overlapping runs. Temporary original-audio and processing files are deleted when a new video is selected, when the workflow is cleared, and after a failed run.

## Project structure

- `app/(tabs)/index.tsx` — single-screen picker, pipeline status, preview, export, and cleanup controls.
- `lib/audio-pipeline.ts` — platform-aware picker/file lifecycle plus the two-step extraction/separation contract.
- `components/screen-container.tsx` — safe-area shell reused by the workbench.
- `app.config.ts` — native permissions/plugins and branding references.
- `plan.md` / `TODO.md` — durable scope and acceptance outcomes.

## Design

### Candidate styles

- **Signal Desk / dark studio console** — 0.06 probability.
- **Paper edit bay / warm notebook** — 0.04 probability.
- **Soft utility / pale mint instrument panel** — 0.07 probability.

### Chosen direction: Signal Desk / dark studio console

**Design Movement:** compact audio-engineering utility inspired by a calm studio meter, not a generic dashboard.

**Core Principles:** one primary action per state; status is always readable; dense information is grouped into quiet cards; destructive cleanup stays secondary.

**Color Philosophy:** deep ink blue-black keeps focus on the selected file, electric cyan marks the active signal path, and a warm amber accent marks the handoff to a saved track. Red is reserved for actionable errors.

**Layout Paradigm:** a left-aligned vertical signal path with a single dominant “Choose video” entry point, followed by stage cards that appear as the workflow progresses. Avoid equal grids and decorative clutter.

**Signature Elements:** a cyan waveform rail, numbered stage markers, and a compact pill showing the current file duration/format.

**Interaction Philosophy:** taps advance the signal path; every stage reports what it is doing; preview is available immediately after separation; clear always returns to an empty workbench.

**Animation:** subtle pulsing on the active stage marker, a short progress sweep during processing, and no looping decorative motion.

**Typography System:** bold rounded system headings for tool identity, medium system text for instructions, and monospaced micro-labels for file names and pipeline stages.

**Brand Essence:** a fast, honest pocket tool for pulling usable background sound from short clips; personality: focused, transparent, practical.

**Brand Voice:** direct, calm, technical without jargon. Example lines: “Choose a short video to begin.” and “Background track ready to preview.”

**Wordmark & Logo:** a small cyan waveform notch inside a rounded square, paired with the `bgtrack` wordmark.

**Signature Brand Color:** signal cyan `#74E7E3`.

## Delivery constraints

The sandbox can validate TypeScript, Expo Web, and the managed preview. A signed Android APK build requires the project’s native build action/Dashboard because release builds are not run inside the sandbox. The source will therefore keep the native bridge and app configuration ready for that build handoff.
