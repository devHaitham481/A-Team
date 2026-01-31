# Xcode Project Setup

Schritt-für-Schritt Anleitung zum Erstellen des Xcode Projekts.

---

## 1. Neues Projekt erstellen

1. Xcode öffnen
2. **File → New → Project**
3. Template: **macOS → App**
4. Klick "Next"

### Project Options:

| Field | Value |
|-------|-------|
| Product Name | `ScreenAssist` |
| Team | Dein Team auswählen |
| Organization Identifier | `com.yourname` |
| Bundle Identifier | (automatisch: `com.yourname.ScreenAssist`) |
| Interface | **SwiftUI** |
| Language | **Swift** |
| Storage | None |
| Include Tests | Optional (kann deaktiviert werden) |

5. Klick "Next"
6. Speicherort wählen
7. "Create" klicken

---

## 2. Minimum Deployment Target

1. Projekt im Navigator auswählen
2. Target "ScreenAssist" auswählen
3. Tab "General"
4. **Minimum Deployments: macOS 13.0**

---

## 3. Firebase SDK hinzufügen

1. **File → Add Package Dependencies...**
2. Oben rechts URL eingeben:
   ```
   https://github.com/firebase/firebase-ios-sdk
   ```
3. "Add Package" klicken
4. Warten bis Paket geladen ist
5. **Dependency Rule:** Up to Next Major Version, **12.5.0**
6. Bei "Choose Package Products":
   - **NUR `FirebaseAI` auswählen** ✅
   - Alle anderen deaktivieren
7. "Add Package" bestätigen

---

## 4. Info.plist bearbeiten

1. Im Navigator: `Info.plist` öffnen (oder unter Target → Info)
2. Rechtsklick → "Add Row"
3. Folgende Einträge hinzufügen:

### Privacy Descriptions:

| Key | Type | Value |
|-----|------|-------|
| `NSMicrophoneUsageDescription` | String | `ScreenAssist benötigt Mikrofon-Zugriff um deine Fragen zu hören.` |
| `NSScreenCaptureUsageDescription` | String | `ScreenAssist benötigt Bildschirmaufnahme um zu sehen was du siehst.` |

---

## 5. Entitlements konfigurieren

1. Im Navigator: `ScreenAssist.entitlements` öffnen
2. Falls nicht vorhanden: 
   - Target auswählen → Signing & Capabilities
   - "+" klicken → App Sandbox hinzufügen
   - Entitlements Datei wird erstellt

3. Folgende Werte setzen:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
</dict>
</plist>
```

**Wichtig:** `app-sandbox` auf `false` setzen für ScreenCaptureKit!

---

## 6. Ordnerstruktur erstellen

Im Xcode Navigator, Rechtsklick auf "ScreenAssist" Ordner:

1. **New Group** → `Services`
2. **New Group** → `Models`  
3. **New Group** → `Views`
4. In `Views`: **New Group** → `Components`

Ergebnis:
```
ScreenAssist/
├── ScreenAssistApp.swift
├── ContentView.swift
├── Services/
├── Models/
├── Views/
│   └── Components/
├── Assets.xcassets
├── Info.plist
└── ScreenAssist.entitlements
```

---

## 7. Dateien erstellen

### In `Models/`:
- `SessionState.swift` (New File → Swift File)
- `AssistantError.swift`

### In `Services/`:
- `ScreenCaptureService.swift`
- `AudioCaptureService.swift`
- `AudioPlayerService.swift`
- `GeminiLiveService.swift`
- `ScreenAssistCoordinator.swift`

### In `Views/Components/`:
- `StatusIndicator.swift`
- `MainButton.swift`
- `TranscriptSection.swift`
- `ErrorBanner.swift`

---

## 8. GoogleService-Info.plist hinzufügen

1. Aus Firebase Console herunterladen (siehe FIREBASE_SETUP.md)
2. Datei in Xcode ziehen (in den ScreenAssist Ordner)
3. Dialog-Optionen:
   - ✅ Copy items if needed
   - ✅ Add to targets: ScreenAssist
4. "Finish" klicken

---

## 9. Build Settings prüfen

Target → Build Settings:

| Setting | Value |
|---------|-------|
| Swift Language Version | Swift 6 |
| macOS Deployment Target | 13.0 |

---

## 10. Signing

Target → Signing & Capabilities:

1. Team auswählen
2. "Automatically manage signing" aktivieren
3. Bundle Identifier prüfen

**Für Screen Recording:**
- Die App braucht KEINE spezielle Entitlement für ScreenCaptureKit
- User muss Permission in System Settings geben
- Permission wird beim ersten `SCShareableContent.excludingDesktopWindows()` angefragt

---

## 11. Erster Build

1. **Product → Build** (⌘B)
2. Fehler prüfen und beheben
3. Häufige Fehler:
   - "No such module 'FirebaseAI'" → Package nicht richtig hinzugefügt
   - "GoogleService-Info.plist not found" → Datei fehlt
   - Signing Fehler → Team auswählen

---

## 12. Erster Run

1. **Product → Run** (⌘R)
2. App startet
3. Bei erstem Start:
   - Mikrofon-Permission wird angefragt → Erlauben
   - Screen Recording Permission → In System Settings erlauben

---

## Projekt-Übersicht nach Setup

```
ScreenAssist.xcodeproj
│
├── ScreenAssist/
│   ├── ScreenAssistApp.swift          # @main, Firebase init
│   ├── ContentView.swift              # Haupt-UI
│   │
│   ├── Models/
│   │   ├── SessionState.swift         # State Enum
│   │   └── AssistantError.swift       # Error Types
│   │
│   ├── Services/
│   │   ├── ScreenCaptureService.swift
│   │   ├── AudioCaptureService.swift
│   │   ├── AudioPlayerService.swift
│   │   ├── GeminiLiveService.swift
│   │   └── ScreenAssistCoordinator.swift
│   │
│   ├── Views/
│   │   └── Components/
│   │       ├── StatusIndicator.swift
│   │       ├── MainButton.swift
│   │       ├── TranscriptSection.swift
│   │       └── ErrorBanner.swift
│   │
│   ├── Resources/
│   │   └── GoogleService-Info.plist   # Firebase Config
│   │
│   ├── Assets.xcassets
│   ├── Info.plist
│   └── ScreenAssist.entitlements
│
└── Package Dependencies/
    └── firebase-ios-sdk (12.5.0+)
        └── FirebaseAI
```

---

## Troubleshooting

### "Cannot find 'FirebaseApp' in scope"

```swift
// Vergessen zu importieren:
import FirebaseCore
```

### "Cannot find 'FirebaseAI' in scope"

```swift
// Import hinzufügen:
import FirebaseAI
```

### Screen Recording funktioniert nicht

1. System Settings → Privacy & Security → Screen Recording
2. ScreenAssist finden und aktivieren
3. App neu starten

### Mikrofon funktioniert nicht

1. System Settings → Privacy & Security → Microphone
2. ScreenAssist finden und aktivieren

### Firebase Fehler "No Firebase App configured"

- `GoogleService-Info.plist` fehlt oder falsche Bundle ID
- `FirebaseApp.configure()` fehlt in App init
