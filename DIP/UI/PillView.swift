import SwiftUI

/// Pill-shaped floating view that displays recording state and toggles on click
struct PillView: View {
    @ObservedObject var recorder: ScreenRecorder

    var body: some View {
        HStack(spacing: 8) {
            // Status indicator circle
            Circle()
                .fill(recorder.isRecording ? Color.red : Color.gray)
                .frame(width: 8, height: 8)
                .overlay {
                    if recorder.isRecording {
                        Circle()
                            .stroke(Color.red.opacity(0.5), lineWidth: 2)
                            .scaleEffect(1.5)
                            .opacity(0.8)
                    }
                }

            // Status text
            Text(recorder.isRecording ? "REC" : "Ready")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Capsule()
                .fill(recorder.isRecording ? Color.red.opacity(0.9) : Color.black.opacity(0.8))
        )
        .clipShape(Capsule())
        .onTapGesture {
            toggleRecording()
        }
    }

    private func toggleRecording() {
        Task {
            if recorder.isRecording {
                try? await recorder.stopRecording()
            } else {
                do {
                    try await recorder.startRecording()
                } catch {
                    recorder.error = error.localizedDescription
                }
            }
        }
    }
}
