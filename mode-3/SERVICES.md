# Services Implementation Guide

Dieses Dokument enthält detaillierte Implementierungsanleitungen für alle Services.

---

## 1. SessionState.swift

```swift
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
}
```

---

## 2. AssistantError.swift

```swift
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
```

---

## 3. ScreenCaptureService.swift

```swift
import Foundation
import ScreenCaptureKit
import CoreGraphics
import AppKit

@MainActor
class ScreenCaptureService: NSObject, ObservableObject {
    
    // MARK: - Published Properties
    @Published private(set) var isCapturing = false
    @Published private(set) var hasPermission = false
    
    // MARK: - Private Properties
    private var stream: SCStream?
    private var streamOutput: StreamOutput?
    private var captureTimer: Timer?
    
    // MARK: - Callbacks
    var onFrameCaptured: ((Data) -> Void)?
    var onError: ((Error) -> Void)?
    
    // MARK: - Configuration
    private let maxDimension: CGFloat = 1024
    private let jpegQuality: CGFloat = 0.7
    private let captureInterval: TimeInterval = 1.0  // 1 FPS
    
    // MARK: - Permission Check
    
    func checkPermission() async -> Bool {
        do {
            // Versuche Content abzufragen - wenn es klappt haben wir Permission
            let content = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: true
            )
            hasPermission = !content.displays.isEmpty
            return hasPermission
        } catch {
            hasPermission = false
            return false
        }
    }
    
    // MARK: - Get Available Displays
    
    func getAvailableDisplays() async throws -> [SCDisplay] {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )
        return content.displays
    }
    
    // MARK: - Start Capture
    
    func startCapture(display: SCDisplay? = nil) async throws {
        guard !isCapturing else { return }
        
        // Get display
        let targetDisplay: SCDisplay
        if let display = display {
            targetDisplay = display
        } else {
            let displays = try await getAvailableDisplays()
            guard let mainDisplay = displays.first else {
                throw AssistantError.screenCaptureSetupFailed(
                    underlying: NSError(domain: "ScreenCapture", code: -1, 
                                       userInfo: [NSLocalizedDescriptionKey: "Kein Display gefunden"])
                )
            }
            targetDisplay = mainDisplay
        }
        
        // Create filter (capture entire display)
        let filter = SCContentFilter(display: targetDisplay, excludingWindows: [])
        
        // Create configuration
        let config = SCStreamConfiguration()
        
        // Calculate scaled size (max 1024px on longest side)
        let scale = min(maxDimension / CGFloat(targetDisplay.width),
                       maxDimension / CGFloat(targetDisplay.height),
                       1.0)
        
        config.width = Int(CGFloat(targetDisplay.width) * scale)
        config.height = Int(CGFloat(targetDisplay.height) * scale)
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)  // 1 FPS max
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = true
        
        // Create stream output handler
        streamOutput = StreamOutput { [weak self] frame in
            self?.handleCapturedFrame(frame)
        }
        
        // Create and start stream
        stream = SCStream(filter: filter, configuration: config, delegate: nil)
        
        guard let stream = stream, let streamOutput = streamOutput else {
            throw AssistantError.screenCaptureSetupFailed(
                underlying: NSError(domain: "ScreenCapture", code: -2,
                                   userInfo: [NSLocalizedDescriptionKey: "Stream konnte nicht erstellt werden"])
            )
        }
        
        try stream.addStreamOutput(streamOutput, type: .screen, sampleHandlerQueue: .global(qos: .userInteractive))
        try await stream.startCapture()
        
        isCapturing = true
    }
    
    // MARK: - Stop Capture
    
    func stopCapture() {
        guard isCapturing else { return }
        
        Task {
            try? await stream?.stopCapture()
            stream = nil
            streamOutput = nil
            isCapturing = false
        }
    }
    
    // MARK: - Handle Frame
    
    private func handleCapturedFrame(_ sampleBuffer: CMSampleBuffer) {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        // Convert to CGImage
        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        let context = CIContext()
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return }
        
        // Convert to JPEG
        let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
        guard let tiffData = nsImage.tiffRepresentation,
              let bitmapRep = NSBitmapImageRep(data: tiffData),
              let jpegData = bitmapRep.representation(using: .jpeg, properties: [.compressionFactor: jpegQuality]) else {
            return
        }
        
        // Call callback on main thread
        DispatchQueue.main.async { [weak self] in
            self?.onFrameCaptured?(jpegData)
        }
    }
}

// MARK: - Stream Output Handler

private class StreamOutput: NSObject, SCStreamOutput {
    private let handler: (CMSampleBuffer) -> Void
    
    init(handler: @escaping (CMSampleBuffer) -> Void) {
        self.handler = handler
    }
    
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen else { return }
        handler(sampleBuffer)
    }
}
```

---

## 4. AudioCaptureService.swift

```swift
import Foundation
import AVFoundation

@MainActor
class AudioCaptureService: ObservableObject {
    
    // MARK: - Published Properties
    @Published private(set) var isRecording = false
    @Published private(set) var hasPermission = false
    
    // MARK: - Private Properties
    private var audioEngine: AVAudioEngine?
    private let targetSampleRate: Double = 16000
    private let bufferSize: AVAudioFrameCount = 1024
    
    // MARK: - Callbacks
    var onAudioBuffer: ((Data) -> Void)?
    var onError: ((Error) -> Void)?
    
    // MARK: - Permission Check
    
    func checkPermission() async -> Bool {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        
        switch status {
        case .authorized:
            hasPermission = true
            return true
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .audio)
            hasPermission = granted
            return granted
        default:
            hasPermission = false
            return false
        }
    }
    
    // MARK: - Start Recording
    
    func startRecording() throws {
        guard !isRecording else { return }
        
        audioEngine = AVAudioEngine()
        guard let audioEngine = audioEngine else {
            throw AssistantError.audioSetupFailed(
                underlying: NSError(domain: "Audio", code: -1,
                                   userInfo: [NSLocalizedDescriptionKey: "AudioEngine konnte nicht erstellt werden"])
            )
        }
        
        let inputNode = audioEngine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        
        // Create converter to 16kHz mono
        guard let targetFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: targetSampleRate,
            channels: 1,
            interleaved: true
        ) else {
            throw AssistantError.audioSetupFailed(
                underlying: NSError(domain: "Audio", code: -2,
                                   userInfo: [NSLocalizedDescriptionKey: "Zielformat konnte nicht erstellt werden"])
            )
        }
        
        guard let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
            throw AssistantError.audioSetupFailed(
                underlying: NSError(domain: "Audio", code: -3,
                                   userInfo: [NSLocalizedDescriptionKey: "Converter konnte nicht erstellt werden"])
            )
        }
        
        // Install tap
        inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, time in
            self?.processAudioBuffer(buffer, converter: converter, targetFormat: targetFormat)
        }
        
        try audioEngine.start()
        isRecording = true
    }
    
    // MARK: - Stop Recording
    
    func stopRecording() {
        guard isRecording else { return }
        
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        isRecording = false
    }
    
    // MARK: - Process Audio Buffer
    
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, converter: AVAudioConverter, targetFormat: AVAudioFormat) {
        // Calculate output frame count
        let ratio = targetFormat.sampleRate / buffer.format.sampleRate
        let outputFrameCount = AVAudioFrameCount(Double(buffer.frameLength) * ratio)
        
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: outputFrameCount) else {
            return
        }
        
        var error: NSError?
        let status = converter.convert(to: outputBuffer, error: &error) { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }
        
        guard status != .error, error == nil else {
            DispatchQueue.main.async { [weak self] in
                self?.onError?(error ?? NSError(domain: "Audio", code: -4, userInfo: nil))
            }
            return
        }
        
        // Convert to Data
        guard let channelData = outputBuffer.int16ChannelData else { return }
        let data = Data(bytes: channelData[0], count: Int(outputBuffer.frameLength) * 2)
        
        DispatchQueue.main.async { [weak self] in
            self?.onAudioBuffer?(data)
        }
    }
}
```

---

## 5. AudioPlayerService.swift

```swift
import Foundation
import AVFoundation

@MainActor
class AudioPlayerService: ObservableObject {
    
    // MARK: - Published Properties
    @Published private(set) var isPlaying = false
    
    // MARK: - Private Properties
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var audioFormat: AVAudioFormat?
    
    // MARK: - Callbacks
    var onPlaybackFinished: (() -> Void)?
    
    // MARK: - Configuration
    private let sampleRate: Double = 24000
    
    // MARK: - Setup
    
    func setup() throws {
        audioEngine = AVAudioEngine()
        playerNode = AVAudioPlayerNode()
        
        guard let audioEngine = audioEngine, let playerNode = playerNode else {
            throw AssistantError.audioSetupFailed(
                underlying: NSError(domain: "AudioPlayer", code: -1,
                                   userInfo: [NSLocalizedDescriptionKey: "Setup fehlgeschlagen"])
            )
        }
        
        // Create format for 24kHz mono 16-bit
        audioFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: true
        )
        
        guard let audioFormat = audioFormat else {
            throw AssistantError.audioSetupFailed(
                underlying: NSError(domain: "AudioPlayer", code: -2,
                                   userInfo: [NSLocalizedDescriptionKey: "Format konnte nicht erstellt werden"])
            )
        }
        
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: audioFormat)
        
        try audioEngine.start()
        playerNode.play()
    }
    
    // MARK: - Play Audio
    
    func play(data: Data) {
        guard let audioFormat = audioFormat,
              let playerNode = playerNode else {
            return
        }
        
        // Convert Data to AVAudioPCMBuffer
        let frameCount = AVAudioFrameCount(data.count / 2)  // 16-bit = 2 bytes per sample
        
        guard let buffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: frameCount) else {
            return
        }
        
        buffer.frameLength = frameCount
        
        // Copy data to buffer
        data.withUnsafeBytes { rawBufferPointer in
            guard let baseAddress = rawBufferPointer.baseAddress else { return }
            memcpy(buffer.int16ChannelData![0], baseAddress, data.count)
        }
        
        // Schedule buffer
        playerNode.scheduleBuffer(buffer) { [weak self] in
            DispatchQueue.main.async {
                // Check if more buffers are scheduled
                // If not, playback is finished
                self?.checkPlaybackStatus()
            }
        }
        
        isPlaying = true
    }
    
    // MARK: - Stop
    
    func stop() {
        playerNode?.stop()
        isPlaying = false
    }
    
    // MARK: - Clear Queue
    
    func clearQueue() {
        playerNode?.stop()
        playerNode?.play()  // Restart for next audio
        isPlaying = false
    }
    
    // MARK: - Cleanup
    
    func cleanup() {
        playerNode?.stop()
        audioEngine?.stop()
        playerNode = nil
        audioEngine = nil
        isPlaying = false
    }
    
    // MARK: - Private
    
    private func checkPlaybackStatus() {
        // Simple check - in production würde man NodeTime prüfen
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            guard let self = self else { return }
            // Hier könnte man prüfen ob weitere Buffers anstehen
            // Für Einfachheit setzen wir isPlaying nach jedem Buffer
            if self.isPlaying {
                self.onPlaybackFinished?()
            }
        }
    }
}
```

---

## 6. GeminiLiveService.swift

```swift
import Foundation
import FirebaseCore
import FirebaseAI

@MainActor
class GeminiLiveService: ObservableObject {
    
    // MARK: - Published Properties
    @Published private(set) var isConnected = false
    
    // MARK: - Private Properties
    private var liveModel: LiveModel?
    private var session: LiveSession?
    private var responseTask: Task<Void, Never>?
    
    // MARK: - Callbacks
    var onAudioReceived: ((Data) -> Void)?
    var onInputTranscript: ((String) -> Void)?
    var onOutputTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?
    
    // MARK: - Configuration
    private let modelName = "gemini-2.5-flash-native-audio-preview-12-2025"
    private let voiceName = "Kore"  // Weiblich, warm - gut für ältere User
    
    // MARK: - System Prompt
    private let systemPrompt = """
    Du bist ein freundlicher Assistent der älteren Menschen hilft ihren Computer zu bedienen.
    
    WICHTIGE REGELN:
    1. Gib immer nur EINEN einfachen Schritt auf einmal
    2. Beschreibe Buttons mit Farbe, Position und genauem Text
    3. Zum Beispiel: "Klicke auf den großen orangen Button rechts der 'In den Warenkorb' heißt"
    4. Halte Antworten KURZ - maximal 2-3 Sätze
    5. Sprich langsam und deutlich
    6. Sei geduldig und ermutigend
    7. Wenn du etwas nicht siehst, sag es ehrlich
    
    Der User teilt seinen Bildschirm mit dir. Du siehst was er sieht.
    Hilf ihm Schritt für Schritt bei seiner Aufgabe.
    """
    
    // MARK: - Initialize
    
    init() {
        setupModel()
    }
    
    private func setupModel() {
        let ai = FirebaseAI.firebaseAI(backend: .googleAI())
        
        let config = LiveGenerationConfig(
            responseModalities: [.audio],
            speechConfig: SpeechConfig(
                voiceConfig: VoiceConfig(
                    prebuiltVoiceConfig: PrebuiltVoiceConfig(voiceName: voiceName)
                )
            ),
            inputAudioTranscription: AudioTranscriptionConfig(),
            outputAudioTranscription: AudioTranscriptionConfig()
        )
        
        liveModel = ai.liveModel(
            modelName: modelName,
            generationConfig: config,
            systemInstruction: ModelContent(
                role: "system",
                parts: [.text(systemPrompt)]
            )
        )
    }
    
    // MARK: - Connect
    
    func connect() async throws {
        guard let liveModel = liveModel else {
            throw AssistantError.connectionFailed(
                underlying: NSError(domain: "Gemini", code: -1,
                                   userInfo: [NSLocalizedDescriptionKey: "Model nicht initialisiert"])
            )
        }
        
        do {
            session = try await liveModel.connect()
            isConnected = true
            startReceiving()
        } catch {
            throw AssistantError.connectionFailed(underlying: error)
        }
    }
    
    // MARK: - Disconnect
    
    func disconnect() {
        responseTask?.cancel()
        responseTask = nil
        session?.disconnect()
        session = nil
        isConnected = false
    }
    
    // MARK: - Send Audio
    
    func sendAudio(_ data: Data) async {
        guard let session = session, isConnected else { return }
        await session.sendAudioRealtime(data)
    }
    
    // MARK: - Send Video Frame
    
    func sendVideo(_ data: Data) async {
        guard let session = session, isConnected else { return }
        await session.sendVideoRealtime(data)
    }
    
    // MARK: - Receive Responses
    
    private func startReceiving() {
        guard let session = session else { return }
        
        responseTask = Task { [weak self] in
            do {
                for try await message in session.responses {
                    await self?.handleMessage(message)
                }
            } catch {
                await MainActor.run { [weak self] in
                    self?.onError?(error)
                    self?.isConnected = false
                }
            }
        }
    }
    
    private func handleMessage(_ message: LiveServerMessage) async {
        switch message.payload {
        case .content(let content):
            // Handle audio and text parts
            for part in content.modelTurn?.parts ?? [] {
                if let inlineData = part as? InlineDataPart {
                    if inlineData.mimeType.starts(with: "audio/pcm") {
                        await MainActor.run { [weak self] in
                            self?.onAudioReceived?(inlineData.data)
                        }
                    }
                }
            }
            
        case .inputTranscription(let transcript):
            await MainActor.run { [weak self] in
                self?.onInputTranscript?(transcript.text)
            }
            
        case .outputTranscription(let transcript):
            await MainActor.run { [weak self] in
                self?.onOutputTranscript?(transcript.text)
            }
            
        default:
            break
        }
    }
}
```

---

## 7. ScreenAssistCoordinator.swift

```swift
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

// MARK: - Helper Extension

extension SessionState {
    var isError: Bool {
        if case .error = self {
            return true
        }
        return false
    }
}
```

---

## Wichtige Hinweise

### Audio Format Conversion

- **Input:** Mikrofon liefert oft 44.1kHz oder 48kHz Float32
- **Gemini erwartet:** 16kHz Int16 Mono
- **Conversion nötig:** AVAudioConverter verwenden

### Video Frame Rate

- Nicht zu oft senden (1 FPS reicht)
- Jeder Frame kostet Tokens
- Zu viele Frames = Session Timeout schneller

### Memory Management

- Audio Buffers werden in Callbacks übergeben → nicht halten
- Screen Frames sofort nach Senden vergessen
- Bei Stop alles explizit aufräumen

### Threading

- Services arbeiten auf Background Threads
- Callbacks immer auf Main Thread dispatchen
- `@MainActor` für ObservableObject Klassen
