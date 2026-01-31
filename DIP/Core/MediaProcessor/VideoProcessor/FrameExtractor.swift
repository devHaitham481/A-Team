/// FrameExtractor.swift
///
/// Extracts frames from video files at a specified interval using FFmpeg.
///
/// Usage:
///   let extractor = FrameExtractor(config: .default)
///   let frames = try await extractor.extract(from: videoURL)
///
/// Dependencies:
///   - FFmpeg binary (at config.ffmpegPath, default: /opt/homebrew/bin/ffmpeg)

import AppKit
import Foundation

/// Extracts frames from video files using FFmpeg
struct FrameExtractor {
    private let config: MediaProcessorConfig

    init(config: MediaProcessorConfig = .default) {
        self.config = config
    }

    /// Extract frames from a video at the configured FPS
    /// - Parameter videoURL: URL of the video file
    /// - Returns: Array of extracted frames with timestamps
    func extract(from videoURL: URL) async throws -> [ExtractedFrame] {
        // Verify FFmpeg exists
        guard FileManager.default.fileExists(atPath: config.ffmpegPath) else {
            throw MediaProcessorError.ffmpegNotFound(path: config.ffmpegPath)
        }

        // Create temp directory for frames
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("MediaProcessor-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

        defer {
            // Cleanup temp directory
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Run FFmpeg to extract frames
        let outputPattern = tempDir.appendingPathComponent("frame_%04d.png").path

        let process = Process()
        process.executableURL = URL(fileURLWithPath: config.ffmpegPath)
        process.arguments = [
            "-i", videoURL.path,
            "-vf", "fps=\(config.framesPerSecond)",
            "-frame_pts", "1",
            outputPattern
        ]

        let errorPipe = Pipe()
        process.standardError = errorPipe
        process.standardOutput = FileHandle.nullDevice

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw MediaProcessorError.frameExtractionFailed(errorMessage)
        }

        // Load extracted frames
        let fileManager = FileManager.default
        let files = try fileManager.contentsOfDirectory(at: tempDir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "png" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }

        guard !files.isEmpty else {
            throw MediaProcessorError.noFramesExtracted
        }

        var frames: [ExtractedFrame] = []

        for (index, fileURL) in files.enumerated() {
            guard let image = NSImage(contentsOf: fileURL) else { continue }

            let timestamp = Double(index) / config.framesPerSecond
            frames.append(ExtractedFrame(image: image, timestamp: timestamp))
        }

        guard !frames.isEmpty else {
            throw MediaProcessorError.noFramesExtracted
        }

        return frames
    }
}
