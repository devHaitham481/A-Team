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

    // MARK: - Callbacks
    var onFrameCaptured: ((Data) -> Void)?
    var onError: ((Error) -> Void)?

    // MARK: - Configuration
    private let maxDimension: CGFloat = 1024
    private let jpegQuality: CGFloat = 0.7

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
