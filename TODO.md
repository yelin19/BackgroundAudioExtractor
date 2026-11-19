# TODO — Background Audio Extractor

## Implement the phase 1–2 short-video workbench

- The app is a simple and clear Android interface for testing 15–30 second videos.
- The user can select a video file from the Android device using the system picker.
- When a video is selected, the app first extracts the video's original audio and stores it as a temporary intermediate file.
- The app then separates a background-audio track from the extracted original-audio file, rather than extracting the background track directly from the video.
- The background track prioritizes BGM, sound effects, and ambient/environment sounds; a small amount of residual speech is acceptable.
- Processing uses a lightweight, fast on-device approach and avoids very large models and excessive RAM/CPU usage.
- The UI shows clear processing states and errors for original-audio extraction and background-track separation.
- The generated `bg_audio`/background track can be previewed and played in the app.
- The generated background track can be saved/exported to the device.
- Selecting a new video cleans up the previous temporary original-audio and processing files.
- Clearing the workflow cleans up temporary files and returns the app to an empty state.
