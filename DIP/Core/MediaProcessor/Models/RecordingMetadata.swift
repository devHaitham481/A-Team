/// RecordingMetadata.swift
///
/// Metadata about the processed recording for debugging and display.

import Foundation

/// Metadata about a processed recording
struct RecordingMetadata {
    /// Total duration of the original recording in seconds
    let duration: Double

    /// Number of frames extracted at 1 FPS before deduplication
    let originalFrameCount: Int

    /// Number of frames after selection (3-10)
    let selectedFrameCount: Int

    /// When the recording was processed
    let processedAt: Date
}
