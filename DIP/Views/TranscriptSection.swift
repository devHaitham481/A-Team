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
