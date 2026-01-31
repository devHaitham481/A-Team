# Firebase Setup Guide

## Übersicht

Diese App nutzt das **Firebase AI Logic SDK** um mit der Gemini Live API zu kommunizieren. Dieses Dokument erklärt das Setup.

---

## Schritt 1: Firebase Projekt erstellen

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Klicke "Projekt erstellen"
3. Name: `ScreenAssist` (oder beliebig)
4. Google Analytics: Kann deaktiviert werden (nicht benötigt)
5. Projekt erstellen

---

## Schritt 2: Gemini API aktivieren

1. Im Firebase Projekt, gehe zu **Build → AI Logic**
2. Klicke "Get started"
3. Wähle **Gemini Developer API** (kostenlos für Entwicklung)
4. Akzeptiere die Terms
5. API ist jetzt aktiviert

---

## Schritt 3: Apple App registrieren

1. In Firebase Console: **Project Settings → General**
2. Scrolle zu "Your apps"
3. Klicke das Apple-Icon (iOS+)
4. Bundle ID: `com.yourname.ScreenAssist` (muss mit Xcode übereinstimmen)
5. App nickname: `ScreenAssist macOS`
6. Klicke "Register app"

---

## Schritt 4: GoogleService-Info.plist herunterladen

1. Nach Registrierung wird `GoogleService-Info.plist` angeboten
2. Herunterladen
3. In Xcode: Datei in das Projekt ziehen (in Resources Ordner)
4. Bei "Add to targets" → ScreenAssist auswählen

---

## Schritt 5: Firebase SDK in Xcode hinzufügen

1. In Xcode: **File → Add Package Dependencies**
2. URL eingeben: `https://github.com/firebase/firebase-ios-sdk`
3. Version: 12.5.0 oder höher
4. "Add Package" klicken
5. Bei Produkt-Auswahl: **Nur `FirebaseAI` auswählen**
6. "Add Package" bestätigen

---

## Schritt 6: Firebase im Code initialisieren

In `ScreenAssistApp.swift`:

```swift
import SwiftUI
import FirebaseCore

@main
struct ScreenAssistApp: App {
    
    init() {
        FirebaseApp.configure()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

---

## Firebase AI Logic SDK - API Reference

### Import

```swift
import FirebaseAI
```

### LiveModel erstellen

```swift
let ai = FirebaseAI.firebaseAI(backend: .googleAI())

let liveModel = ai.liveModel(
    modelName: "gemini-2.5-flash-native-audio-preview-12-2025",
    generationConfig: LiveGenerationConfig(
        responseModalities: [.audio],
        speechConfig: SpeechConfig(
            voiceConfig: VoiceConfig(
                prebuiltVoiceConfig: PrebuiltVoiceConfig(voiceName: "Puck")
            )
        )
    ),
    systemInstruction: ModelContent(
        role: "system",
        parts: [.text("Du bist ein freundlicher Assistent...")]
    )
)
```

### Session verbinden

```swift
let session = try await liveModel.connect()
```

### Audio senden

```swift
// PCM 16kHz, 16-bit, Mono
await session.sendAudioRealtime(audioData)
```

### Video-Frame senden

```swift
// JPEG Data
await session.sendVideoRealtime(jpegData)
```

### Responses empfangen

```swift
for try await message in session.responses {
    switch message.payload {
    case .content(let content):
        // Audio oder Text
        for part in content.modelTurn?.parts ?? [] {
            if let inlineData = part as? InlineDataPart {
                if inlineData.mimeType.starts(with: "audio/pcm") {
                    // Audio Data: 24kHz, 16-bit, Mono
                    let audioData = inlineData.data
                    // → An AudioPlayer senden
                }
            }
            if let textPart = part as? TextPart {
                // Transcript
                let text = textPart.text
            }
        }
        
    case .inputTranscription(let transcript):
        // Was der User gesagt hat
        print("User: \(transcript.text)")
        
    case .outputTranscription(let transcript):
        // Was das Model gesagt hat
        print("AI: \(transcript.text)")
        
    default:
        break
    }
}
```

### Session beenden

```swift
session.disconnect()
```

---

## Konfigurationsoptionen

### Verfügbare Stimmen

| Voice Name | Beschreibung |
|------------|--------------|
| `Puck` | Männlich, freundlich (Default) |
| `Charon` | Männlich, tief |
| `Kore` | Weiblich, warm |
| `Fenrir` | Männlich, kräftig |
| `Aoede` | Weiblich, sanft |

### Response Modalities

```swift
// Nur Audio (für unsere App)
responseModalities: [.audio]

// Nur Text (wenn eigene TTS verwendet wird)
responseModalities: [.text]

// Beides
responseModalities: [.audio, .text]
```

### Transcription aktivieren

```swift
let config = LiveGenerationConfig(
    responseModalities: [.audio],
    inputAudioTranscription: AudioTranscriptionConfig(),  // User Speech → Text
    outputAudioTranscription: AudioTranscriptionConfig()  // AI Speech → Text
)
```

---

## System Instruction für Screen-Assistenz

Empfohlener System Prompt:

```swift
let systemInstruction = ModelContent(
    role: "system",
    parts: [.text("""
    Du bist ein freundlicher Assistent der älteren Menschen hilft ihren Computer zu bedienen.
    
    WICHTIGE REGELN:
    1. Gib immer nur EINEN einfachen Schritt auf einmal
    2. Beschreibe Buttons mit Farbe, Position und genauem Text
    3. Zum Beispiel: "Klicke auf den großen orangen Button rechts der 'In den Warenkorb' heißt"
    4. Halte Antworten KURZ - maximal 2-3 Sätze
    5. Sprich langsam und deutlich
    6. Sei geduldig und ermutigend
    7. Wenn du etwas nicht siehst, sag es ehrlich
    
    Der User teilt seinen Bildschirm mit dir. Du siehst was er sieht.
    Hilf ihm Schritt für Schritt bei seiner Aufgabe.
    """)]
)
```

---

## Limits & Kosten

### Session Limits

| Typ | Max Dauer |
|-----|-----------|
| Audio + Video | 2 Minuten |
| Audio only | 15 Minuten |

### Kosten (Gemini Developer API)

- **Free Tier:** Verfügbar für Entwicklung
- Live API Nutzung wird gegen Free-Tier-Limits gerechnet
- Für Demo mehr als ausreichend

---

## Troubleshooting

### "No Firebase App configured"

→ `FirebaseApp.configure()` fehlt in App init

### "Permission denied"

→ Gemini API nicht aktiviert in Firebase Console

### "Invalid API key"

→ GoogleService-Info.plist fehlt oder Bundle ID stimmt nicht

### "Session timeout after 2 minutes"

→ Normale Limitierung für Audio+Video Sessions
→ Neue Session starten wenn nötig

### Video wird nicht verarbeitet

→ Prüfen ob `sendVideoRealtime()` aufgerufen wird
→ JPEG Format und Größe prüfen (<5MB)
