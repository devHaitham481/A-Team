# Architektur - ScreenAssist

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ScreenAssist App                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Screen     │  │    Audio     │  │    Audio     │              │
│  │   Capture    │  │    Capture   │  │    Player    │              │
│  │   Service    │  │    Service   │  │    Service   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────▲───────┘              │
│         │                  │                  │                      │
│         │ JPEG frames      │ PCM 16kHz        │ PCM 24kHz           │
│         │ (1 FPS)          │                  │                      │
│         │                  │                  │                      │
│         ▼                  ▼                  │                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  ScreenAssistCoordinator                     │   │
│  │                     (Orchestrator)                           │   │
│  │  - State Management                                          │   │
│  │  - Service Lifecycle                                         │   │
│  │  - Error Handling                                            │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    GeminiLiveService                         │   │
│  │                 (Firebase AI Logic SDK)                      │   │
│  │                                                              │   │
│  │  - WebSocket Connection                                      │   │
│  │  - sendAudioRealtime(Data)                                   │   │
│  │  - sendVideoRealtime(Data)                                   │   │
│  │  - responses: AsyncStream                                    │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ WebSocket
                               ▼
                    ┌─────────────────────┐
                    │   Google Gemini     │
                    │   Live API          │
                    │                     │
                    │ Model: gemini-2.5-  │
                    │ flash-native-audio  │
                    └─────────────────────┘
```

---

## Datenfluss

### Input Flow (User → Gemini)

```
1. ScreenCaptureService
   └── SCStream capture (1 FPS)
       └── CGImage → JPEG Data (max 1024px, 70% quality)
           └── ~50-150 KB pro Frame

2. AudioCaptureService  
   └── AVAudioEngine tap
       └── Float32 → Int16 PCM conversion
           └── 16kHz, Mono, 16-bit
               └── ~32 KB/sec

3. ScreenAssistCoordinator
   └── Empfängt beide Streams
       └── Leitet an GeminiLiveService weiter

4. GeminiLiveService
   └── session.sendAudioRealtime(audioData)
   └── session.sendVideoRealtime(frameData)
```

### Output Flow (Gemini → User)

```
1. GeminiLiveService
   └── session.responses (AsyncStream)
       └── InlineDataPart mit audio/pcm
           └── 24kHz, Mono, 16-bit

2. ScreenAssistCoordinator
   └── Empfängt Audio-Chunks
       └── Leitet an AudioPlayerService

3. AudioPlayerService
   └── AVAudioPlayerNode
       └── Spielt Audio ab
```

---

## State Machine

```
                    ┌─────────┐
                    │  idle   │
                    └────┬────┘
                         │ start()
                         ▼
                  ┌──────────────┐
                  │  connecting  │
                  └──────┬───────┘
                         │ connected
                         ▼
                  ┌──────────────┐
          ┌──────│  listening   │◄─────────┐
          │      └──────┬───────┘          │
          │             │ user speaks      │
          │             ▼                  │
          │      ┌──────────────┐          │
          │      │  processing  │          │
          │      └──────┬───────┘          │
          │             │ response ready   │
          │             ▼                  │
          │      ┌──────────────┐          │
          │      │   speaking   │──────────┘
          │      └──────────────┘  done speaking
          │
          │ stop() / error / timeout
          ▼
    ┌──────────┐
    │  error   │───► idle (nach Fehler-Anzeige)
    └──────────┘
```

---

## Service-Verantwortlichkeiten

### ScreenCaptureService

**Zweck:** Erfasst den Bildschirm als JPEG-Frames

**Zustand:**
- `isCapturing: Bool`
- `currentFrame: Data?`

**Methoden:**
```swift
func checkPermission() async -> Bool
func startCapture(display: SCDisplay) async throws
func stopCapture()
func captureFrame() -> Data?  // Liefert aktuellen Frame
```

**Events:**
```swift
var onFrameCaptured: ((Data) -> Void)?
var onError: ((Error) -> Void)?
```

---

### AudioCaptureService

**Zweck:** Erfasst Mikrofon-Audio als PCM

**Zustand:**
- `isRecording: Bool`

**Methoden:**
```swift
func checkPermission() async -> Bool
func startRecording() throws
func stopRecording()
```

**Events:**
```swift
var onAudioBuffer: ((Data) -> Void)?  // PCM 16kHz Chunks
var onError: ((Error) -> Void)?
```

---

### AudioPlayerService

**Zweck:** Spielt PCM-Audio von Gemini ab

**Zustand:**
- `isPlaying: Bool`

**Methoden:**
```swift
func play(data: Data)      // PCM 24kHz hinzufügen zur Queue
func stop()                 // Playback stoppen
func clearQueue()           // Buffer leeren
```

**Events:**
```swift
var onPlaybackFinished: (() -> Void)?
```

---

### GeminiLiveService

**Zweck:** Kommunikation mit Gemini Live API

**Zustand:**
- `isConnected: Bool`
- `session: LiveSession?`

**Methoden:**
```swift
func connect() async throws
func disconnect()
func sendAudio(_ data: Data) async
func sendVideo(_ data: Data) async
```

**Events:**
```swift
var onAudioReceived: ((Data) -> Void)?
var onInputTranscript: ((String) -> Void)?   // Was User sagt
var onOutputTranscript: ((String) -> Void)?  // Was AI sagt
var onError: ((Error) -> Void)?
```

---

### ScreenAssistCoordinator

**Zweck:** Zentrale Steuerung der App

**Zustand:**
```swift
@Published var state: SessionState
@Published var userTranscript: String
@Published var assistantTranscript: String
@Published var errorMessage: String?
```

**Methoden:**
```swift
func startSession() async
func stopSession()
```

**Interne Logik:**
1. Bei `startSession()`:
   - State → `connecting`
   - GeminiLiveService.connect()
   - ScreenCaptureService.startCapture()
   - AudioCaptureService.startRecording()
   - State → `listening`

2. Bei Audio von Mikrofon:
   - An GeminiLiveService.sendAudio() weiterleiten

3. Bei Frame von Screen:
   - An GeminiLiveService.sendVideo() weiterleiten

4. Bei Audio von Gemini:
   - State → `speaking`
   - An AudioPlayerService.play() weiterleiten

5. Bei Playback Ende:
   - State → `listening`

6. Bei `stopSession()`:
   - Alle Services stoppen
   - State → `idle`

---

## Audio-Formate

### Input (Mikrofon → Gemini)
- Format: Linear PCM
- Sample Rate: 16,000 Hz
- Channels: 1 (Mono)
- Bit Depth: 16-bit (Int16)
- MIME Type: `audio/pcm;rate=16000`

### Output (Gemini → Speaker)
- Format: Linear PCM  
- Sample Rate: 24,000 Hz
- Channels: 1 (Mono)
- Bit Depth: 16-bit (Int16)

---

## Video-Format

### Screen Frames → Gemini
- Format: JPEG
- Max Dimension: 1024px (längere Seite)
- Quality: 70%
- Rate: 1 FPS (während Session aktiv)
- Größe: ~50-150 KB pro Frame

---

## Threading Model

```
Main Thread (MainActor)
├── SwiftUI Views
├── ScreenAssistCoordinator (@MainActor)
│   └── Published properties
│
Background Threads
├── ScreenCaptureService
│   └── SCStream delegate callbacks
│
├── AudioCaptureService
│   └── AVAudioEngine tap callback
│
├── AudioPlayerService
│   └── AVAudioPlayerNode scheduling
│
└── GeminiLiveService
    └── WebSocket async streams
```

**Wichtig:** Alle UI-Updates müssen auf MainActor erfolgen!

```swift
// Beispiel
Task { @MainActor in
    self.state = .speaking
}
```

---

## Error Handling

### Fehler-Kategorien

```swift
enum AssistantError: Error {
    // Permissions
    case microphonePermissionDenied
    case screenCapturePermissionDenied
    
    // Connection
    case connectionFailed(underlying: Error)
    case connectionLost
    case sessionTimeout
    
    // API
    case apiError(message: String)
    case invalidResponse
    
    // Audio
    case audioSetupFailed
    case playbackFailed
}
```

### Recovery-Strategie

| Fehler | Aktion |
|--------|--------|
| Permission denied | Dialog mit Link zu System Settings |
| Connection failed | Retry-Button anzeigen |
| Session timeout | Automatisch neue Session starten |
| API error | Fehler anzeigen, Retry ermöglichen |

---

## Memory Management

### Zu beachten:

1. **Screen Frames:** Nicht speichern, nur aktuellen Frame halten
2. **Audio Buffers:** Nach Senden/Abspielen freigeben
3. **Session:** Bei Stop komplett aufräumen

```swift
func stopSession() {
    screenCapture.stopCapture()
    audioCapture.stopRecording()
    audioPlayer.stop()
    audioPlayer.clearQueue()
    geminiService.disconnect()
    
    // Explizit aufräumen
    currentFrame = nil
}
```
