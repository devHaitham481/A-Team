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
