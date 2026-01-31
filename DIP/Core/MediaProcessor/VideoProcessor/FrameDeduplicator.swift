/// FrameDeduplicator.swift
///
/// Removes near-identical frames from a sequence using perceptual hashing.
/// Screen recordings often have static periods - this removes redundant frames.
///
/// Usage:
///   let deduplicator = FrameDeduplicator(threshold: 0.90)
///   let unique = deduplicator.deduplicate(frames)

import Foundation

/// Removes duplicate frames based on perceptual similarity
struct FrameDeduplicator {
    /// Similarity threshold (0.0-1.0). Frames above this are considered duplicates.
    private let threshold: Double

    init(threshold: Double = 0.90) {
        self.threshold = threshold
    }

    /// Remove near-duplicate frames from the sequence
    /// - Parameter frames: Input frames in chronological order
    /// - Returns: Deduplicated frames (always includes first and last)
    func deduplicate(_ frames: [ExtractedFrame]) -> [ExtractedFrame] {
        guard frames.count > 2 else {
            return frames
        }

        var result: [ExtractedFrame] = []
        var lastKeptHash: PerceptualHash?

        for (index, frame) in frames.enumerated() {
            let isFirst = index == 0
            let isLast = index == frames.count - 1

            // Always keep first and last frames
            if isFirst || isLast {
                result.append(frame)
                if isFirst {
                    lastKeptHash = PerceptualHash(image: frame.image)
                }
                continue
            }

            let currentHash = PerceptualHash(image: frame.image)

            // Check similarity to last kept frame
            if let lastHash = lastKeptHash {
                let similarity = currentHash.similarity(to: lastHash)

                if similarity < threshold {
                    // Different enough - keep this frame
                    result.append(frame)
                    lastKeptHash = currentHash
                }
                // Otherwise skip (too similar)
            } else {
                result.append(frame)
                lastKeptHash = currentHash
            }
        }

        return result
    }
}
