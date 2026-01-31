/// ExtractedFrame.swift
///
/// Internal model representing a frame extracted from video before processing.
/// Used during frame extraction and deduplication stages.

import AppKit

/// A frame extracted from video at a specific timestamp
struct ExtractedFrame: @unchecked Sendable {
    /// The frame image
    let image: NSImage

    /// Timestamp in seconds from the start of the video
    let timestamp: Double
}
