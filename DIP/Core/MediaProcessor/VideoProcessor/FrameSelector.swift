/// FrameSelector.swift
///
/// Selects 3-10 key frames from a deduplicated frame sequence.
/// Uses uniform sampling to get representative frames across the recording.
///
/// Usage:
///   let selector = FrameSelector(minFrames: 3, maxFrames: 10)
///   let selected = selector.select(from: frames)

import Foundation

/// Selects key frames from a sequence
struct FrameSelector {
    private let minFrames: Int
    private let maxFrames: Int

    init(minFrames: Int = 3, maxFrames: Int = 10) {
        self.minFrames = minFrames
        self.maxFrames = maxFrames
    }

    /// Select key frames using uniform sampling
    /// - Parameter frames: Input frames (should be deduplicated)
    /// - Returns: Selected frames (3-10)
    func select(from frames: [ExtractedFrame]) -> [ExtractedFrame] {
        guard frames.count > maxFrames else {
            // Already within limits
            return frames.count >= minFrames ? frames : frames
        }

        // Calculate target count: 10% of frames, clamped to min/max
        var targetCount = max(minFrames, min(maxFrames, Int(Double(frames.count) * 0.10)))
        targetCount = max(minFrames, min(maxFrames, targetCount))

        // If we have fewer frames than target, return all
        if frames.count <= targetCount {
            return frames
        }

        // Uniform sampling: always include first and last
        var selected: [ExtractedFrame] = []

        // Add first frame
        selected.append(frames[0])

        // Calculate indices for middle frames
        let middleSlots = targetCount - 2 // Excluding first and last
        if middleSlots > 0 {
            let step = Double(frames.count - 2) / Double(middleSlots + 1)

            for i in 1...middleSlots {
                let index = Int(Double(i) * step)
                if index > 0 && index < frames.count - 1 {
                    selected.append(frames[index])
                }
            }
        }

        // Add last frame
        selected.append(frames[frames.count - 1])

        return selected
    }
}
