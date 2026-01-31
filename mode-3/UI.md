# Test UI Implementation

Minimales SwiftUI Interface zum Testen der Business Logic.

---

## ContentView.swift

```swift
import SwiftUI

struct ContentView: View {
    @StateObject private var coordinator = ScreenAssistCoordinator()
    
    var body: some View {
        VStack(spacing: 24) {
            // Header
            Text("ScreenAssist")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("KI-Assistent für Bildschirm-Hilfe")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Spacer()
            
            // Status Indicator
            StatusIndicator(state: coordinator.state)
            
            Spacer()
            
            // Transcripts
            TranscriptSection(
                userTranscript: coordinator.userTranscript,
                assistantTranscript: coordinator.assistantTranscript
            )
            
            Spacer()
            
            // Main Button
            MainButton(
                state: coordinator.state,
                action: {
                    Task {
                        await coordinator.toggleSession()
                    }
                }
            )
            
            // Error Banner
            if let error = coordinator.errorMessage {
                ErrorBanner(message: error) {
                    coordinator.errorMessage = nil
                }
            }
        }
        .padding(32)
        .frame(minWidth: 400, minHeight: 500)
    }
}

// MARK: - Preview

#Preview {
    ContentView()
}
```

---

## StatusIndicator.swift

```swift
import SwiftUI

struct StatusIndicator: View {
    let state: SessionState
    
    var body: some View {
        HStack(spacing: 12) {
            // Status Dot
            Circle()
                .fill(statusColor)
                .frame(width: 16, height: 16)
                .overlay(
                    Circle()
                        .stroke(statusColor.opacity(0.3), lineWidth: 4)
                        .scaleEffect(state.isActive ? 1.5 : 1.0)
                        .opacity(state.isActive ? 0 : 1)
                        .animation(
                            state.isActive ? 
                                .easeInOut(duration: 1).repeatForever(autoreverses: false) : 
                                .default,
                            value: state.isActive
                        )
                )
            
            // Status Text
            Text(state.displayText)
                .font(.headline)
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(statusColor.opacity(0.1))
        )
    }
    
    private var statusColor: Color {
        switch state {
        case .idle:
            return .gray
        case .connecting:
            return .orange
        case .listening:
            return .green
        case .processing:
            return .blue
        case .speaking:
            return .purple
        case .error:
            return .red
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        StatusIndicator(state: .idle)
        StatusIndicator(state: .connecting)
        StatusIndicator(state: .listening)
        StatusIndicator(state: .processing)
        StatusIndicator(state: .speaking)
        StatusIndicator(state: .error(message: "Test"))
    }
    .padding()
}
```

---

## MainButton.swift

```swift
import SwiftUI

struct MainButton: View {
    let state: SessionState
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: buttonIcon)
                    .font(.title2)
                
                Text(buttonText)
                    .font(.headline)
            }
            .foregroundColor(.white)
            .padding(.horizontal, 32)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(buttonColor)
            )
        }
        .buttonStyle(.plain)
        .disabled(state == .connecting)
    }
    
    private var buttonIcon: String {
        switch state {
        case .idle, .error:
            return "play.fill"
        case .connecting:
            return "ellipsis"
        default:
            return "stop.fill"
        }
    }
    
    private var buttonText: String {
        switch state {
        case .idle, .error:
            return "Session starten"
        case .connecting:
            return "Verbinde..."
        default:
            return "Session beenden"
        }
    }
    
    private var buttonColor: Color {
        switch state {
        case .idle, .error:
            return .blue
        case .connecting:
            return .gray
        default:
            return .red
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        MainButton(state: .idle, action: {})
        MainButton(state: .connecting, action: {})
        MainButton(state: .listening, action: {})
    }
    .padding()
}
```

---

## TranscriptSection.swift

```swift
import SwiftUI

struct TranscriptSection: View {
    let userTranscript: String
    let assistantTranscript: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // User Transcript
            if !userTranscript.isEmpty {
                TranscriptBubble(
                    label: "Du sagst:",
                    text: userTranscript,
                    color: .blue,
                    alignment: .trailing
                )
            }
            
            // Assistant Transcript
            if !assistantTranscript.isEmpty {
                TranscriptBubble(
                    label: "Assistent:",
                    text: assistantTranscript,
                    color: .purple,
                    alignment: .leading
                )
            }
            
            // Placeholder
            if userTranscript.isEmpty && assistantTranscript.isEmpty {
                Text("Starte eine Session und stelle eine Frage...")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
    }
}

struct TranscriptBubble: View {
    let label: String
    let text: String
    let color: Color
    let alignment: HorizontalAlignment
    
    var body: some View {
        VStack(alignment: alignment, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(text)
                .font(.body)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(color.opacity(0.1))
                )
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}

#Preview {
    TranscriptSection(
        userTranscript: "Wie füge ich das zu meinem Warenkorb hinzu?",
        assistantTranscript: "Klicke auf den großen orangen Button rechts der 'In den Warenkorb' heißt."
    )
    .padding()
    .frame(width: 400)
}
```

---

## ErrorBanner.swift

```swift
import SwiftUI

struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void
    
    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.white)
            
            Text(message)
                .font(.subheadline)
                .foregroundColor(.white)
                .lineLimit(2)
            
            Spacer()
            
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .foregroundColor(.white.opacity(0.8))
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.red)
        )
    }
}

#Preview {
    ErrorBanner(message: "Mikrofon-Zugriff wurde verweigert. Bitte in Systemeinstellungen erlauben.", onDismiss: {})
        .padding()
        .frame(width: 400)
}
```

---

## ScreenAssistApp.swift

```swift
import SwiftUI
import FirebaseCore

@main
struct ScreenAssistApp: App {
    
    init() {
        // Firebase initialisieren
        FirebaseApp.configure()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 450, height: 600)
    }
}
```

---

## UI Komponenten Zusammenfassung

| Datei | Zweck |
|-------|-------|
| `ContentView.swift` | Haupt-View, bindet alles zusammen |
| `StatusIndicator.swift` | Zeigt aktuellen Status mit Farbe |
| `MainButton.swift` | Start/Stop Button |
| `TranscriptSection.swift` | Zeigt was User/AI sagt |
| `ErrorBanner.swift` | Fehler-Anzeige |
| `ScreenAssistApp.swift` | App Entry Point |

---

## Farb-Schema

| Status | Farbe | Hex |
|--------|-------|-----|
| Idle | Grau | `#8E8E93` |
| Connecting | Orange | `#FF9500` |
| Listening | Grün | `#34C759` |
| Processing | Blau | `#007AFF` |
| Speaking | Lila | `#AF52DE` |
| Error | Rot | `#FF3B30` |
