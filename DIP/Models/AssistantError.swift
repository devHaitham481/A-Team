import Foundation

enum AssistantError: LocalizedError {
    case microphonePermissionDenied
    case screenCapturePermissionDenied
    case connectionFailed(underlying: Error)
    case connectionLost
    case sessionTimeout
    case apiError(message: String)
    case audioSetupFailed(underlying: Error)
    case screenCaptureSetupFailed(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .microphonePermissionDenied:
            return "Mikrofon-Zugriff wurde verweigert. Bitte in Systemeinstellungen erlauben."
        case .screenCapturePermissionDenied:
            return "Bildschirmaufnahme wurde verweigert. Bitte in Systemeinstellungen erlauben."
        case .connectionFailed(let error):
            return "Verbindung fehlgeschlagen: \(error.localizedDescription)"
        case .connectionLost:
            return "Verbindung verloren. Bitte erneut versuchen."
        case .sessionTimeout:
            return "Session abgelaufen. Maximale Dauer erreicht."
        case .apiError(let message):
            return "API Fehler: \(message)"
        case .audioSetupFailed(let error):
            return "Audio Setup fehlgeschlagen: \(error.localizedDescription)"
        case .screenCaptureSetupFailed(let error):
            return "Bildschirmaufnahme Setup fehlgeschlagen: \(error.localizedDescription)"
        }
    }
}
