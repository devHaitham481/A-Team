/// MediaProcessorError.swift
///
/// Errors that can occur during media processing.

import Foundation

/// Errors that can occur during media processing
enum MediaProcessorError: Error, LocalizedError {
    /// FFmpeg binary not found at the configured path
    case ffmpegNotFound(path: String)

    /// Frame extraction failed
    case frameExtractionFailed(String)

    /// No frames were extracted from the video
    case noFramesExtracted

    /// Audio extraction failed
    case audioExtractionFailed(String)

    /// Transcription API call failed
    case transcriptionFailed(String)

    /// Invalid or missing API key
    case invalidAPIKey

    var errorDescription: String? {
        switch self {
        case .ffmpegNotFound(let path):
            return "FFmpeg not found at \(path). Install with: brew install ffmpeg"
        case .frameExtractionFailed(let message):
            return "Frame extraction failed: \(message)"
        case .noFramesExtracted:
            return "No frames were extracted from the video"
        case .audioExtractionFailed(let message):
            return "Audio extraction failed: \(message)"
        case .transcriptionFailed(let message):
            return "Transcription failed: \(message)"
        case .invalidAPIKey:
            return "Invalid or missing ElevenLabs API key"
        }
    }
}
