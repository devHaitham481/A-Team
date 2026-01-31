/// AnnotatedFrame.swift
///
/// A key frame with its anchored transcript segment.
/// This is the primary output unit - each frame "owns" the speech
/// that occurred from its timestamp until the next frame.

import AppKit

/// A selected key frame with anchored transcript
struct AnnotatedFrame {
    /// The frame image
    let image: NSImage

    /// Timestamp in seconds from the start of the video
    let timestamp: Double

    /// Index in the selected frames array (0-based)
    let index: Int

    /// Speech that occurred during this frame's time window.
    /// nil if no speech occurred during this window.
    let transcript: String?
}
