# ScreenAssist - Implementation TODO

## Projektübersicht

Eine macOS App die den Bildschirm erfasst, Sprache hört und über Gemini Live API gesprochene Hilfestellung gibt. Zielgruppe: Ältere Menschen die Hilfe bei der Computer-Bedienung brauchen.

**Beispiel-Flow:**
1. User teilt seinen Screen (Amazon Warenkorb)
2. User fragt: "Wie kaufe ich das?"
3. Gemini sieht den Screen + hört die Frage
4. Gemini antwortet mit Sprache: "Klicke auf den großen orangen Button rechts der 'In den Warenkorb' heißt"

---

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Sprache | Swift 6.0+ |
| UI Framework | SwiftUI |
| Min. macOS | 13.0+ |
| Screen Capture | ScreenCaptureKit |
| Audio Capture | AVAudioEngine |
| Audio Playback | AVAudioPlayerNode |
| AI Backend | Firebase AI Logic SDK (Gemini Live API) |
| Model | `gemini-2.5-flash-native-audio-preview-12-2025` |

---

## Session Limits (wichtig!)

- **Audio + Video Session**: Max 2 Minuten
- **Audio-only Session**: Max 15 Minuten
- Für Demo reicht das aus

---

## Projekt-Struktur

```
ScreenAssist/
├── App/
│   ├── ScreenAssistApp.swift         # @main Entry Point
│   └── AppDelegate.swift             # Permissions handling
│
├── Services/
│   ├── ScreenCaptureService.swift    # ScreenCaptureKit wrapper
│   ├── AudioCaptureService.swift     # Mikrofon -> PCM 16kHz
│   ├── AudioPlayerService.swift      # PCM 24kHz -> Speaker
│   ├── GeminiLiveService.swift       # Firebase AI Logic wrapper
│   └── ScreenAssistCoordinator.swift # Orchestriert alle Services
│
├── Models/
│   ├── SessionState.swift            # Enum für App-Zustand
│   └── AssistantError.swift          # Error types
│
├── Views/
│   ├── ContentView.swift             # Haupt-UI (minimal für Test)
│   └── Components/
│       └── StatusIndicator.swift     # Zeigt aktuellen Status
│
├── Resources/
│   ├── GoogleService-Info.plist      # Firebase config (User muss erstellen)
│   └── Info.plist                    # Permissions
│
└── ScreenAssist.entitlements         # App Sandbox settings
```

---

## Implementation Tasks

### Phase 1: Projekt Setup

- [ ] **1.1** Xcode Projekt erstellen
  - Product Name: `ScreenAssist`
  - Interface: SwiftUI
  - Language: Swift
  - Min Deployment: macOS 13.0

- [ ] **1.2** Firebase SDK hinzufügen
  - Swift Package Manager
  - URL: `https://github.com/firebase/firebase-ios-sdk`
  - Version: 12.5.0+
  - Produkt auswählen: `FirebaseAI`

- [ ] **1.3** Info.plist konfigurieren
  ```xml
  <key>NSMicrophoneUsageDescription</key>
  <string>ScreenAssist benötigt Mikrofon-Zugriff um deine Fragen zu hören.</string>
  
  <key>NSScreenCaptureUsageDescription</key>
  <string>ScreenAssist benötigt Bildschirmaufnahme um zu sehen was du siehst.</string>
  ```

- [ ] **1.4** Entitlements konfigurieren
  ```xml
  <key>com.apple.security.app-sandbox</key>
  <false/>
  
  <key>com.apple.security.device.audio-input</key>
  <true/>
  ```

---

### Phase 2: Services implementieren

- [ ] **2.1** `SessionState.swift` erstellen
  - Enum: `idle`, `connecting`, `listening`, `processing`, `speaking`, `error`

- [ ] **2.2** `AssistantError.swift` erstellen
  - Cases für: permissions, connection, api, audio

- [ ] **2.3** `ScreenCaptureService.swift` implementieren
  - SCShareableContent für Permission-Check
  - SCStream für kontinuierliche Capture
  - Output: JPEG Data, max 1024px, 1 FPS
  - Methoden: `checkPermission()`, `startCapture()`, `stopCapture()`, `captureFrame() -> Data?`

- [ ] **2.4** `AudioCaptureService.swift` implementieren
  - AVAudioEngine für Mikrofon-Input
  - Format: PCM 16-bit, 16kHz, Mono
  - Callback wenn Audio-Buffer verfügbar
  - Methoden: `checkPermission()`, `startRecording()`, `stopRecording()`

- [ ] **2.5** `AudioPlayerService.swift` implementieren
  - AVAudioEngine + AVAudioPlayerNode
  - Input: PCM 16-bit, 24kHz, Mono
  - Queue-basiert für Streaming
  - Methoden: `play(data: Data)`, `stop()`, `isPlaying`

- [ ] **2.6** `GeminiLiveService.swift` implementieren
  - Firebase AI Logic SDK initialisieren
  - LiveModel mit Audio-Response Modality
  - System Instruction für Screen-Assistenz
  - Methoden: `connect()`, `disconnect()`, `sendAudio(Data)`, `sendVideoFrame(Data)`
  - Callbacks: `onAudioReceived`, `onTranscriptReceived`, `onError`

- [ ] **2.7** `ScreenAssistCoordinator.swift` implementieren
  - Orchestriert alle Services
  - State Management
  - Startet/Stoppt Session
  - Leitet Audio/Video an Gemini weiter
  - Spielt empfangene Audio ab

---

### Phase 3: Test-UI implementieren

- [ ] **3.1** `StatusIndicator.swift` erstellen
  - Farbiger Kreis basierend auf State
  - Text-Label mit Status-Beschreibung

- [ ] **3.2** `ContentView.swift` implementieren
  - Großer Start/Stop Button
  - Status-Anzeige
  - Transcript-Anzeige (was User sagt)
  - Response-Anzeige (was AI sagt)
  - Error-Banner

---

### Phase 4: Integration & Test

- [ ] **4.1** Firebase Projekt erstellen
  - Firebase Console
  - Gemini API aktivieren
  - GoogleService-Info.plist herunterladen

- [ ] **4.2** End-to-End Test
  - Permissions Flow testen
  - Screen teilen
  - Frage stellen
  - Antwort hören

- [ ] **4.3** Edge Cases testen
  - Keine Permissions
  - Netzwerk-Fehler
  - Session Timeout (2 Min)

---

## Erfolgskriterien

Die MVP ist fertig wenn:

1. ✅ App startet und fragt nach Permissions
2. ✅ User kann Session starten mit Button
3. ✅ Screen wird erfasst und an Gemini gesendet
4. ✅ Mikrofon-Audio wird erfasst und an Gemini gesendet
5. ✅ Gemini-Antwort wird als Audio abgespielt
6. ✅ User kann Session stoppen
7. ✅ Fehler werden sinnvoll angezeigt

---

## Nicht im Scope (für später)

- Floating Overlay Window
- Global Hotkey
- Conversation History
- Custom TTS (ElevenLabs)
- Session-Verlängerung über 2 Min
- Lokalisierung
