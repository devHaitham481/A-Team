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
