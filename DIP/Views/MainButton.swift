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
