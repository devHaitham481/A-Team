import Foundation
import Combine

@MainActor
class ScreenAssistCoordinator: ObservableObject {

    // MARK: - Published Properties
    @Published var state: SessionState = .idle
    @Published var userTranscript: String = ""
    @Published var assistantTranscript: String = ""
    @Published var errorMessage: String?

    // MARK: - Services
    private let screenCapture = ScreenCaptureService()
    private let audioCapture = AudioCaptureService()
    private let audioPlayer = AudioPlayerService()
    private let geminiService = GeminiLiveService()

    // MARK: - Private
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Init

    init() {
        setupCallbacks()
    }

    // MARK: - Setup Callbacks

    private func setupCallbacks() {
        // Screen Capture → Gemini
        screenCapture.onFrameCaptured = { [weak self] frameData in
            Task { [weak self] in
                await self?.geminiService.sendVideo(frameData)
            }
        }

        screenCapture.onError = { [weak self] error in
            self?.handleError(error)
        }

        // Audio Capture → Gemini
        audioCapture.onAudioBuffer = { [weak self] audioData in
            Task { [weak self] in
                await self?.geminiService.sendAudio(audioData)
            }
        }

        audioCapture.onError = { [weak self] error in
            self?.handleError(error)
        }

        // Gemini → Audio Player
        geminiService.onAudioReceived = { [weak self] audioData in
            self?.state = .speaking
            self?.audioPlayer.play(data: audioData)
        }

        geminiService.onInputTranscript = { [weak self] text in
            self?.userTranscript = text
            self?.state = .processing
        }

        geminiService.onOutputTranscript = { [weak self] text in
            self?.assistantTranscript = text
        }

        geminiService.onError = { [weak self] error in
            self?.handleError(error)
        }

        // Audio Player → State
        audioPlayer.onPlaybackFinished = { [weak self] in
            guard self?.state == .speaking else { return }
            self?.state = .listening
        }
    }

    // MARK: - Check Permissions

    func checkPermissions() async -> (microphone: Bool, screen: Bool) {
        async let micPermission = audioCapture.checkPermission()
        async let screenPermission = screenCapture.checkPermission()
        return await (micPermission, screenPermission)
    }

    // MARK: - Start Session

    func startSession() async {
        // Check permissions first
        let permissions = await checkPermissions()

        guard permissions.microphone else {
            state = .error(message: "Mikrofon-Zugriff benötigt")
            errorMessage = AssistantError.microphonePermissionDenied.localizedDescription
            return
        }

        guard permissions.screen else {
            state = .error(message: "Bildschirmaufnahme benötigt")
            errorMessage = AssistantError.screenCapturePermissionDenied.localizedDescription
            return
        }

        // Start session
        state = .connecting
        errorMessage = nil
        userTranscript = ""
        assistantTranscript = ""

        do {
            // Setup audio player
            try audioPlayer.setup()

            // Connect to Gemini
            try await geminiService.connect()

            // Start screen capture
            try await screenCapture.startCapture()

            // Start audio capture
            try audioCapture.startRecording()

            state = .listening

        } catch {
            handleError(error)
        }
    }

    // MARK: - Stop Session

    func stopSession() {
        screenCapture.stopCapture()
        audioCapture.stopRecording()
        audioPlayer.stop()
        audioPlayer.cleanup()
        geminiService.disconnect()

        state = .idle
        errorMessage = nil
    }

    // MARK: - Toggle Session

    func toggleSession() async {
        if state == .idle || state.isError {
            await startSession()
        } else {
            stopSession()
        }
    }

    // MARK: - Error Handling

    private func handleError(_ error: Error) {
        let message: String
        if let assistantError = error as? AssistantError {
            message = assistantError.localizedDescription ?? "Unbekannter Fehler"
        } else {
            message = error.localizedDescription
        }

        state = .error(message: message)
        errorMessage = message

        // Stop everything
        screenCapture.stopCapture()
        audioCapture.stopRecording()
        audioPlayer.stop()
        geminiService.disconnect()
    }
}
