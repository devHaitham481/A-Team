/// TranscriptAnchor.swift
///
/// Anchors transcript segments to their corresponding frames.
/// Each frame "owns" the speech that occurred from its timestamp
/// until the next frame's timestamp.
///
/// Usage:
///   let annotated = TranscriptAnchor.anchor(
///       frames: selectedFrames,
///       segments: transcriptSegments
///   )

import Foundation

/// Anchors transcript segments to frames
enum TranscriptAnchor {
    /// Anchor transcript segments to their corresponding frames
    /// - Parameters:
    ///   - frames: Selected key frames with timestamps
    ///   - segments: Transcript segments with timing
    /// - Returns: Annotated frames with anchored transcript
    static func anchor(
        frames: [ExtractedFrame],
        segments: [TranscriptSegment]
    ) -> [AnnotatedFrame] {

        return frames.enumerated().map { (index, frame) in
            // Determine time window for this frame
            let windowStart = frame.timestamp
            let windowEnd: Double

            if index + 1 < frames.count {
                windowEnd = frames[index + 1].timestamp
            } else {
                // Last frame owns everything until the end
                windowEnd = .infinity
            }

            // Collect transcript segments that start within this window
            let relevantSegments = segments.filter { segment in
                segment.startTime >= windowStart && segment.startTime < windowEnd
            }

            // Combine text from relevant segments
            let transcript = relevantSegments
                .map { $0.text }
                .joined(separator: " ")
                .trimmingCharacters(in: .whitespaces)

            return AnnotatedFrame(
                image: frame.image,
                timestamp: frame.timestamp,
                index: index,
                transcript: transcript.isEmpty ? nil : transcript
            )
        }
    }
}
