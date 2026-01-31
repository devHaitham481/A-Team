import SwiftUI

/// Pill-shaped floating view that displays recording state and toggles on click
struct PillView: View {
    @ObservedObject var recorder: ScreenRecorder

    private var statusText: String {
        if recorder.isRecording {
            return "REC"
        } else if recorder.copiedToClipboard {
            return "Copied!"
        } else {
            return "Ready"
        }
    }

    private var indicatorColor: Color {
        if recorder.isRecording {
            return .red
        } else if recorder.copiedToClipboard {
            return .green
        } else {
            return .gray
        }
    }

    private var backgroundColor: Color {
        if recorder.isRecording {
            return Color.red.opacity(0.9)
        } else if recorder.copiedToClipboard {
            return Color.green.opacity(0.8)
        } else {
            return Color.black.opacity(0.8)
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            // Status indicator circle
            Circle()
                .fill(indicatorColor)
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
            Text(statusText)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Capsule()
                .fill(backgroundColor)
        )
        .clipShape(Capsule())
        .onTapGesture {
            toggleRecording()
        }
        .animation(.easeInOut(duration: 0.2), value: recorder.copiedToClipboard)
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
