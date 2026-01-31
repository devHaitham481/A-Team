# ScreenAssist

Ein macOS KI-Assistent der deinen Bildschirm sieht und dir per Sprache hilft.

---

## Was ist das?

ScreenAssist ist eine macOS App für **ältere Menschen** die Hilfe bei der Computer-Bedienung brauchen.

**Beispiel:**
1. Oma ist auf Amazon und will etwas kaufen
2. Sie teilt ihren Screen mit der App
3. Sie fragt: "Wie kaufe ich das?"
4. Die KI sieht den Screen und antwortet: "Klicke auf den großen orangen Button rechts der 'In den Warenkorb' heißt"

---

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Plattform | macOS 13.0+ |
| Sprache | Swift 6.0 |
| UI | SwiftUI |
| Screen Capture | ScreenCaptureKit |
| Audio | AVAudioEngine |
| KI Backend | Firebase AI Logic SDK |
| KI Model | Gemini 2.5 Flash (Live API) |

---

## Features

- ✅ Echtzeit Screen-Sharing mit KI
- ✅ Spracheingabe (kein Tippen nötig)
- ✅ Gesprochene Antworten
- ✅ Optimiert für ältere Nutzer
- ✅ Einfaches UI

---

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| [TODO.md](TODO.md) | Implementierungs-Tasks |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System-Architektur |
| [docs/SERVICES.md](docs/SERVICES.md) | Service-Implementierungen |
| [docs/UI.md](docs/UI.md) | Test-UI Komponenten |
| [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) | Firebase Einrichtung |
| [docs/XCODE_SETUP.md](docs/XCODE_SETUP.md) | Xcode Projekt Setup |

---

## Quick Start

### 1. Firebase Projekt erstellen
Siehe [FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)

### 2. Xcode Projekt erstellen
Siehe [XCODE_SETUP.md](docs/XCODE_SETUP.md)

### 3. Code implementieren
Siehe [SERVICES.md](docs/SERVICES.md) und [UI.md](docs/UI.md)

### 4. Testen
- App starten
- Permissions erlauben
- Session starten
- Frage stellen
- Antwort hören

---

## Session Limits

| Modus | Max Dauer |
|-------|-----------|
| Audio + Video | 2 Minuten |
| Audio only | 15 Minuten |

Für eine Demo reicht das aus!

---

## Projektstruktur

```
ScreenAssist/
├── ScreenAssistApp.swift         # Entry Point + Firebase Init
├── ContentView.swift             # Haupt-UI
│
├── Models/
│   ├── SessionState.swift        # App-Zustände
│   └── AssistantError.swift      # Fehler-Typen
│
├── Services/
│   ├── ScreenCaptureService.swift    # Screen → JPEG Frames
│   ├── AudioCaptureService.swift     # Mikrofon → PCM 16kHz
│   ├── AudioPlayerService.swift      # PCM 24kHz → Speaker
│   ├── GeminiLiveService.swift       # Firebase AI Logic
│   └── ScreenAssistCoordinator.swift # Orchestriert alles
│
├── Views/Components/
│   ├── StatusIndicator.swift     # Status-Anzeige
│   ├── MainButton.swift          # Start/Stop
│   ├── TranscriptSection.swift   # Transkripte
│   └── ErrorBanner.swift         # Fehler-Banner
│
└── Resources/
    └── GoogleService-Info.plist  # Firebase Config
```

---

## Datenfluss

```
┌─────────────┐     ┌─────────────┐
│   Screen    │     │  Mikrofon   │
│  (Display)  │     │   (Audio)   │
└──────┬──────┘     └──────┬──────┘
       │                    │
       ▼                    ▼
┌─────────────┐     ┌─────────────┐
│ScreenCapture│     │ AudioCapture│
│   Service   │     │   Service   │
└──────┬──────┘     └──────┬──────┘
       │ JPEG              │ PCM 16kHz
       │                   │
       └────────┬──────────┘
                │
                ▼
       ┌────────────────┐
       │   Coordinator  │
       └────────┬───────┘
                │
                ▼
       ┌────────────────┐
       │ GeminiLive     │
       │ Service        │──────► Gemini Live API
       └────────┬───────┘        (WebSocket)
                │
                │ PCM 24kHz
                ▼
       ┌────────────────┐
       │ AudioPlayer    │
       │ Service        │
       └────────┬───────┘
                │
                ▼
          ┌──────────┐
          │ Speaker  │
          └──────────┘
```

---

## Für Frontend-Entwickler

Das Backend (dieser Code) stellt folgende Schnittstelle bereit:

### ScreenAssistCoordinator

```swift
class ScreenAssistCoordinator: ObservableObject {
    // State
    @Published var state: SessionState
    @Published var userTranscript: String
    @Published var assistantTranscript: String
    @Published var errorMessage: String?
    
    // Actions
    func startSession() async
    func stopSession()
    func toggleSession() async
    func checkPermissions() async -> (microphone: Bool, screen: Bool)
}
```

### SessionState

```swift
enum SessionState {
    case idle          // Bereit zum Starten
    case connecting    // Verbindet mit Gemini
    case listening     // Hört zu
    case processing    // Verarbeitet Frage
    case speaking      // Spricht Antwort
    case error(message: String)
}
```

Das Frontend kann einfach den Coordinator observen und basierend auf dem State die UI anpassen.

---

## Lizenz

MIT
