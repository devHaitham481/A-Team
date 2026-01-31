/// TranscriptSegment.swift
///
/// Internal model representing a segment of transcribed speech with timing.
/// Used to anchor transcript text to frames.

import Foundation

/// A segment of transcribed speech with start and end times
struct TranscriptSegment {
    /// The transcribed text for this segment
    let text: String

    /// Start time in seconds from the beginning of the recording
    let startTime: Double

    /// End time in seconds from the beginning of the recording
    let endTime: Double
}
