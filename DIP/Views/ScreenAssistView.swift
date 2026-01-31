import SwiftUI

struct ScreenAssistView: View {
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

#Preview {
    ScreenAssistView()
}
