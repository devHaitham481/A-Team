import AVFoundation
@preconcurrency import ScreenCaptureKit
import SwiftUI

/// Errors that can occur during recording
enum RecordingError: Error, LocalizedError {
    case noDisplay
    case noMicrophone
    case captureFailure(String)

    var errorDescription: String? {
        switch self {
        case .noDisplay:
            return "No display found for recording"
        case .noMicrophone:
            return "No microphone available for recording"
        case .captureFailure(let message):
            return "Capture failed: \(message)"
        }
    }
}

/// Screen recorder using ScreenCaptureKit with SCRecordingOutput (macOS 15+)
@MainActor
final class ScreenRecorder: NSObject, ObservableObject {
    @Published var isRecording: Bool = false
    @Published var recordingURL: URL? = nil
    @Published var error: String? = nil

    private var stream: SCStream?
    private var recordingOutput: SCRecordingOutput?

    override init() {
        super.init()
    }

    /// Start recording screen and microphone to MP4 file
    func startRecording() async throws {
        // Clear any previous error
        error = nil

        // 1. Get shareable content
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        // 2. Get the first display
        guard let display = content.displays.first else {
            throw RecordingError.noDisplay
        }

        // 3. Get microphone device
        guard let microphone = AVCaptureDevice.default(for: .audio) else {
            throw RecordingError.noMicrophone
        }

        // 4. Create content filter for full display
        let filter = SCContentFilter(display: display, excludingWindows: [])

        // 5. Configure stream
        let streamConfig = SCStreamConfiguration()
        streamConfig.width = display.width * 2  // Retina scaling
        streamConfig.height = display.height * 2
        streamConfig.minimumFrameInterval = CMTime(value: 1, timescale: 30)  // 30 fps
        streamConfig.capturesAudio = true  // System audio
        streamConfig.captureMicrophone = true
        streamConfig.microphoneCaptureDeviceID = microphone.uniqueID

        // 6. Create output URL with timestamp
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate, .withTime, .withColonSeparatorInTime]
        let timestamp = dateFormatter.string(from: Date()).replacingOccurrences(of: ":", with: "-")

        let moviesURL = FileManager.default.urls(for: .moviesDirectory, in: .userDomainMask).first!
        let outputURL = moviesURL.appendingPathComponent("DIP-\(timestamp).mp4")

        // 7. Configure recording output
        let recordingConfig = SCRecordingOutputConfiguration()
        recordingConfig.outputURL = outputURL
        recordingConfig.outputFileType = .mp4
        recordingConfig.videoCodecType = .h264

        // 8. Create stream and recording output
        let newStream = SCStream(filter: filter, configuration: streamConfig, delegate: nil)
        let newRecordingOutput = SCRecordingOutput(configuration: recordingConfig, delegate: self)

        // 9. Add recording output to stream
        try newStream.addRecordingOutput(newRecordingOutput)

        // 10. Start capture
        do {
            try await newStream.startCapture()
        } catch {
            throw RecordingError.captureFailure(error.localizedDescription)
        }

        // Store references and update state
        stream = newStream
        recordingOutput = newRecordingOutput
        isRecording = true
        recordingURL = outputURL
    }

    /// Stop the current recording
    func stopRecording() async throws {
        guard let stream = stream else {
            return
        }

        try await stream.stopCapture()

        self.stream = nil
        self.recordingOutput = nil
        isRecording = false
    }
}

// MARK: - SCRecordingOutputDelegate

extension ScreenRecorder: SCRecordingOutputDelegate {
    nonisolated func recordingOutputDidStartRecording(_ recordingOutput: SCRecordingOutput) {
        print("[ScreenRecorder] Recording started")
    }

    nonisolated func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) {
        print("[ScreenRecorder] Recording failed with error: \(error.localizedDescription)")
        Task { @MainActor in
            self.error = error.localizedDescription
            self.isRecording = false
        }
    }

    nonisolated func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) {
        print("[ScreenRecorder] Recording finished")
    }
}
