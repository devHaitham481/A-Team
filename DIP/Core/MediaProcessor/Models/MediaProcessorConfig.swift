/// MediaProcessorConfig.swift
///
/// Configuration for the MediaProcessor pipeline.
/// Provides sensible defaults for hackathon demo.

import Foundation

/// Configuration for the media processing pipeline
struct MediaProcessorConfig {
    // MARK: - Frame Extraction

    /// Frames to extract per second of video
    let framesPerSecond: Double

    // MARK: - Deduplication

    /// Similarity threshold for frame deduplication (0.0-1.0)
    /// Frames with similarity above this are considered duplicates
    let similarityThreshold: Double

    // MARK: - Selection

    /// Minimum number of frames to select
    let minFrames: Int

    /// Maximum number of frames to select
    let maxFrames: Int

    // MARK: - Audio

    /// Sample rate for extracted audio (Hz)
    let audioSampleRate: Int

    /// Number of audio channels (1 = mono)
    let audioChannels: Int

    // MARK: - ElevenLabs

    /// ElevenLabs API key for transcription
    let elevenLabsAPIKey: String

    /// ElevenLabs model to use
    let elevenLabsModel: String

    // MARK: - FFmpeg

    /// Path to FFmpeg binary
    let ffmpegPath: String

    // MARK: - Defaults

    /// Default configuration for hackathon demo
    static var `default`: MediaProcessorConfig {
        MediaProcessorConfig(
            framesPerSecond: 1.0,
            similarityThreshold: 0.90,
            minFrames: 3,
            maxFrames: 10,
            audioSampleRate: 16000,
            audioChannels: 1,
            elevenLabsAPIKey: ProcessInfo.processInfo.environment["ELEVENLABS_API_KEY"]
                ?? "sk_7316878f3f23d00d4c57afe2e27a475c389deb1d2a57d47c",
            elevenLabsModel: "scribe_v2",
            ffmpegPath: "/opt/homebrew/bin/ffmpeg"
        )
    }
}
