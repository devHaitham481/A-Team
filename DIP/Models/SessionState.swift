import Foundation

enum SessionState: Equatable {
    case idle
    case connecting
    case listening
    case processing
    case speaking
    case error(message: String)

    var displayText: String {
        switch self {
        case .idle:
            return "Bereit"
        case .connecting:
            return "Verbinde..."
        case .listening:
            return "Höre zu..."
        case .processing:
            return "Denke nach..."
        case .speaking:
            return "Spricht..."
        case .error(let message):
            return "Fehler: \(message)"
        }
    }

    var isActive: Bool {
        switch self {
        case .listening, .processing, .speaking:
            return true
        default:
            return false
        }
    }

    var isError: Bool {
        if case .error = self {
            return true
        }
        return false
    }
}
