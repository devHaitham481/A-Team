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
    private var pendingBuffers = 0

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

        // Track pending buffers
        pendingBuffers += 1
        isPlaying = true

        // Schedule buffer
        playerNode.scheduleBuffer(buffer) { [weak self] in
            DispatchQueue.main.async {
                self?.bufferCompleted()
            }
        }
    }

    // MARK: - Stop

    func stop() {
        playerNode?.stop()
        pendingBuffers = 0
        isPlaying = false
    }

    // MARK: - Clear Queue

    func clearQueue() {
        playerNode?.stop()
        playerNode?.play()  // Restart for next audio
        pendingBuffers = 0
        isPlaying = false
    }

    // MARK: - Cleanup

    func cleanup() {
        playerNode?.stop()
        audioEngine?.stop()
        playerNode = nil
        audioEngine = nil
        pendingBuffers = 0
        isPlaying = false
    }

    // MARK: - Private

    private func bufferCompleted() {
        pendingBuffers -= 1
        if pendingBuffers <= 0 {
            pendingBuffers = 0
            isPlaying = false
            onPlaybackFinished?()
        }
    }
}
