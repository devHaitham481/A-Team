# Screen Recording Feature Design

**Date:** 2025-02-01
**Branch:** `mohammed/screen-recording`

## Overview

Implement screen + microphone recording in the Electron frontend. No backend required for this step.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ELECTRON                             │
├─────────────────────────────────────────────────────────────┤
│  Renderer Process          │  Main Process                  │
│  ─────────────────         │  ────────────                  │
│  • UI (buttons, status)    │  • Window management           │
│  • desktopCapturer         │  • File system access          │
│  • MediaRecorder           │  • Save .webm to disk          │
│  • Capture screen + mic    │  • IPC handlers                │
└─────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                               ~/Documents/VisionFlow/
                               └── recording-{timestamp}.webm
```

## Data Flow

1. User selects screen/window from dropdown
2. User clicks Record
3. Renderer gets screen stream via `desktopCapturer`
4. Renderer gets microphone stream via `getUserMedia`
5. Streams combined and recorded via `MediaRecorder`
6. User clicks Stop
7. Recording blob sent to Main process via IPC
8. Main process saves to `~/Documents/VisionFlow/`
9. UI shows "Done!" with file path

## Components

### recorder.ts (NEW)

```typescript
class ScreenRecorder {
  startRecording(sourceId: string): Promise<void>
  stopRecording(): Promise<Blob>
}
```

- Uses `desktopCapturer` for screen
- Uses `getUserMedia` for microphone
- Combines streams into single MediaStream
- Records as `video/webm`

### preload.ts (MODIFY)

Expose to renderer:
- `getSources()` — List available screens/windows
- `saveRecording(buffer)` — Save webm to disk

### main.ts (MODIFY)

IPC handlers:
- `get-sources` — Call `desktopCapturer.getSources()`
- `save-recording` — Write buffer to filesystem

### renderer.ts (MODIFY)

- Populate source dropdown with real sources
- Connect buttons to ScreenRecorder
- Handle recording state transitions

## Output Format

- **Container:** WebM
- **Video codec:** VP8/VP9
- **Audio codec:** Opus
- **Location:** `~/Documents/VisionFlow/recording-{timestamp}.webm`

## Permissions

macOS will prompt for:
- Screen Recording permission
- Microphone permission

Electron handles permission dialogs automatically.

## Out of Scope

- MP4 conversion (add later if needed)
- Backend/API integration
- AI processing
- Video preview/playback

## Implementation Steps

1. Create branch `mohammed/screen-recording`
2. Add source selector IPC (get-sources)
3. Implement ScreenRecorder class
4. Add save functionality IPC
5. Wire up UI to real recording
6. Test end-to-end
