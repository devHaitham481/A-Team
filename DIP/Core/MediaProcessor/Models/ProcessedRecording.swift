/// ProcessedRecording.swift
///
/// The final output of the MediaProcessor pipeline.
/// Contains 3-10 key frames with anchored transcripts.
/// Consumed by Mode 1 (Clipboard), Mode 2 (Built-in LLM), and Mode 3 (Livestream).

import Foundation

/// The processed output from a screen recording
struct ProcessedRecording {
    /// Selected key frames with anchored transcript segments (3-10 frames)
    let frames: [AnnotatedFrame]

    /// Metadata about the processing
    let metadata: RecordingMetadata

    /// Reconstructs the full transcript from frame transcripts
    var fullTranscript: String {
        frames.compactMap { $0.transcript }.joined(separator: " ")
    }
}
