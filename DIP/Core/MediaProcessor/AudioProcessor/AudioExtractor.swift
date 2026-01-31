/// AudioExtractor.swift
///
/// Extracts audio from video files using FFmpeg.
/// Outputs WAV format suitable for transcription APIs.
///
/// Usage:
///   let extractor = AudioExtractor(config: .default)
///   let audioURL = try await extractor.extract(from: videoURL)
///   // Remember to delete audioURL when done
///
/// Dependencies:
///   - FFmpeg binary (at config.ffmpegPath)

import Foundation

/// Extracts audio from video files using FFmpeg
struct AudioExtractor {
    private let config: MediaProcessorConfig

    init(config: MediaProcessorConfig = .default) {
        self.config = config
    }

    /// Extract audio from video to WAV file
    /// - Parameter videoURL: URL of the video file
    /// - Returns: URL of the extracted WAV file (caller must delete when done)
    func extract(from videoURL: URL) async throws -> URL {
        // Verify FFmpeg exists
        guard FileManager.default.fileExists(atPath: config.ffmpegPath) else {
            throw MediaProcessorError.ffmpegNotFound(path: config.ffmpegPath)
        }

        // Create output URL in temp directory
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("audio-\(UUID().uuidString).wav")

        let process = Process()
        process.executableURL = URL(fileURLWithPath: config.ffmpegPath)
        process.arguments = [
            "-i", videoURL.path,
            "-vn",                          // No video
            "-acodec", "pcm_s16le",         // PCM 16-bit
            "-ar", "\(config.audioSampleRate)", // Sample rate
            "-ac", "\(config.audioChannels)",   // Channels
            "-y",                           // Overwrite output
            outputURL.path
        ]

        let errorPipe = Pipe()
        process.standardError = errorPipe
        process.standardOutput = FileHandle.nullDevice

        try process.run()
        process.waitUntilExit()

        // FFmpeg returns 0 on success, but may warn about no audio
        // Check if output file was created and has content
        if FileManager.default.fileExists(atPath: outputURL.path) {
            let attributes = try FileManager.default.attributesOfItem(atPath: outputURL.path)
            let fileSize = attributes[.size] as? Int ?? 0

            if fileSize > 44 { // WAV header is 44 bytes, need more for actual audio
                return outputURL
            }
        }

        // No audio track or extraction failed
        let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
        let errorMessage = String(data: errorData, encoding: .utf8) ?? "No audio track found"
        throw MediaProcessorError.audioExtractionFailed(errorMessage)
    }
}
