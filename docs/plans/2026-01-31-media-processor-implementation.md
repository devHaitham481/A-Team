# MediaProcessor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core media processing pipeline that transforms screen recordings into structured output (3-10 key frames with anchored transcripts).

**Architecture:** Two parallel pipelines (video + audio) orchestrated by MediaProcessor. Video pipeline extracts frames at 1 FPS, deduplicates via perceptual hashing, selects 3-10 key frames. Audio pipeline extracts WAV, sends to ElevenLabs Scribe v2, returns timestamped transcript. Results merge by anchoring transcript segments to frames.

**Tech Stack:** Swift, FFmpeg (system binary at /opt/homebrew/bin/ffmpeg), ElevenLabs Scribe v2 API, AppKit (NSImage)

**FFmpeg Requirement:** Install via `brew install ffmpeg` if not already installed.

---

## Task 1: Create Models

**Files:**
- Create: `DIP/Core/MediaProcessor/Models/ExtractedFrame.swift`
- Create: `DIP/Core/MediaProcessor/Models/TranscriptSegment.swift`
- Create: `DIP/Core/MediaProcessor/Models/RecordingMetadata.swift`
- Create: `DIP/Core/MediaProcessor/Models/AnnotatedFrame.swift`
- Create: `DIP/Core/MediaProcessor/Models/ProcessedRecording.swift`
- Create: `DIP/Core/MediaProcessor/Models/MediaProcessorConfig.swift`
- Create: `DIP/Core/MediaProcessor/Models/MediaProcessorError.swift`

**Step 1: Create directory structure**

```bash
mkdir -p DIP/Core/MediaProcessor/Models
mkdir -p DIP/Core/MediaProcessor/VideoProcessor
mkdir -p DIP/Core/MediaProcessor/AudioProcessor
```

**Step 2: Create ExtractedFrame.swift**

```swift
/// ExtractedFrame.swift
///
/// Internal model representing a frame extracted from video before processing.
/// Used during frame extraction and deduplication stages.

import AppKit

/// A frame extracted from video at a specific timestamp
struct ExtractedFrame {
    /// The frame image
    let image: NSImage

    /// Timestamp in seconds from the start of the video
    let timestamp: Double
}
```

**Step 3: Create TranscriptSegment.swift**

```swift
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
```

**Step 4: Create RecordingMetadata.swift**

```swift
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
```

**Step 5: Create AnnotatedFrame.swift**

```swift
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
```

**Step 6: Create ProcessedRecording.swift**

```swift
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
```

**Step 7: Create MediaProcessorConfig.swift**

```swift
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
```

**Step 8: Create MediaProcessorError.swift**

```swift
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
```

**Step 9: Commit**

```bash
git add DIP/Core/MediaProcessor/Models/
git commit -m "feat(media-processor): add data models

- ExtractedFrame: internal frame representation
- TranscriptSegment: timestamped speech segment
- RecordingMetadata: processing metadata
- AnnotatedFrame: frame with anchored transcript
- ProcessedRecording: final pipeline output
- MediaProcessorConfig: configuration with defaults
- MediaProcessorError: typed error handling"
```

---

## Task 2: Implement PerceptualHash

**Files:**
- Create: `DIP/Core/MediaProcessor/VideoProcessor/PerceptualHash.swift`

**Step 1: Create PerceptualHash.swift**

```swift
/// PerceptualHash.swift
///
/// Perceptual hashing (pHash) for image similarity comparison.
/// Used to deduplicate near-identical frames from screen recordings.
///
/// Algorithm:
/// 1. Resize image to 32x32
/// 2. Convert to grayscale
/// 3. Apply DCT (discrete cosine transform)
/// 4. Take top-left 8x8 of DCT coefficients
/// 5. Compute median, create 64-bit hash based on above/below median

import AppKit
import Accelerate

/// A perceptual hash for comparing image similarity
struct PerceptualHash {
    /// The 64-bit hash value
    let hash: UInt64

    /// Compute perceptual hash from an image
    init(image: NSImage) {
        // 1. Resize to 32x32
        let resized = Self.resize(image: image, to: CGSize(width: 32, height: 32))

        // 2. Convert to grayscale pixel values
        let grayscale = Self.toGrayscale(image: resized)

        // 3. Apply DCT
        let dct = Self.applyDCT(pixels: grayscale, width: 32, height: 32)

        // 4. Take top-left 8x8 (excluding DC component at [0,0])
        var values: [Float] = []
        for y in 0..<8 {
            for x in 0..<8 {
                if x == 0 && y == 0 { continue } // Skip DC component
                values.append(dct[y * 32 + x])
            }
        }

        // 5. Compute median and create hash
        let sorted = values.sorted()
        let median = sorted[sorted.count / 2]

        var hashValue: UInt64 = 0
        for (i, value) in values.enumerated() {
            if value > median {
                hashValue |= (1 << i)
            }
        }

        self.hash = hashValue
    }

    /// Calculate similarity to another hash (0.0 to 1.0)
    func similarity(to other: PerceptualHash) -> Double {
        let xor = hash ^ other.hash
        let differentBits = xor.nonzeroBitCount
        return 1.0 - (Double(differentBits) / 64.0)
    }

    // MARK: - Private Helpers

    private static func resize(image: NSImage, to size: CGSize) -> NSImage {
        let newImage = NSImage(size: size)
        newImage.lockFocus()
        NSGraphicsContext.current?.imageInterpolation = .high
        image.draw(in: NSRect(origin: .zero, size: size),
                   from: NSRect(origin: .zero, size: image.size),
                   operation: .copy,
                   fraction: 1.0)
        newImage.unlockFocus()
        return newImage
    }

    private static func toGrayscale(image: NSImage) -> [Float] {
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return Array(repeating: 0, count: 32 * 32)
        }

        let width = cgImage.width
        let height = cgImage.height
        var pixels = [Float](repeating: 0, count: width * height)

        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 32,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue | CGBitmapInfo.floatComponents.rawValue).rawValue
        ) else {
            return pixels
        }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return pixels
    }

    private static func applyDCT(pixels: [Float], width: Int, height: Int) -> [Float] {
        var input = pixels
        var output = [Float](repeating: 0, count: width * height)

        // Use Accelerate's vDSP for DCT
        let setup = vDSP_DCT_CreateSetup(nil, vDSP_Length(width * height), .II)
        defer { vDSP_DCT_DestroySetup(setup) }

        if let setup = setup {
            vDSP_DCT_Execute(setup, &input, &output)
        } else {
            // Fallback: simple 2D DCT implementation
            output = simpleDCT(pixels: pixels, width: width, height: height)
        }

        return output
    }

    private static func simpleDCT(pixels: [Float], width: Int, height: Int) -> [Float] {
        var result = [Float](repeating: 0, count: width * height)
        let pi = Float.pi

        for v in 0..<8 {
            for u in 0..<8 {
                var sum: Float = 0
                for y in 0..<height {
                    for x in 0..<width {
                        let pixel = pixels[y * width + x]
                        let cosX = cos(pi * Float(2 * x + 1) * Float(u) / Float(2 * width))
                        let cosY = cos(pi * Float(2 * y + 1) * Float(v) / Float(2 * height))
                        sum += pixel * cosX * cosY
                    }
                }
                let cu: Float = u == 0 ? 1.0 / sqrt(2.0) : 1.0
                let cv: Float = v == 0 ? 1.0 / sqrt(2.0) : 1.0
                result[v * width + u] = 0.25 * cu * cv * sum
            }
        }

        return result
    }
}
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/VideoProcessor/PerceptualHash.swift
git commit -m "feat(media-processor): add perceptual hashing

Implements pHash algorithm for image similarity:
- Resize to 32x32, convert to grayscale
- Apply DCT, extract 8x8 coefficients
- Generate 64-bit hash from median comparison
- Similarity calculation via Hamming distance"
```

---

## Task 3: Implement FrameExtractor

**Files:**
- Create: `DIP/Core/MediaProcessor/VideoProcessor/FrameExtractor.swift`

**Step 1: Create FrameExtractor.swift**

```swift
/// FrameExtractor.swift
///
/// Extracts frames from video files at a specified interval using FFmpeg.
///
/// Usage:
///   let extractor = FrameExtractor(config: .default)
///   let frames = try await extractor.extract(from: videoURL)
///
/// Dependencies:
///   - FFmpeg binary (at config.ffmpegPath, default: /opt/homebrew/bin/ffmpeg)

import AppKit
import Foundation

/// Extracts frames from video files using FFmpeg
struct FrameExtractor {
    private let config: MediaProcessorConfig

    init(config: MediaProcessorConfig = .default) {
        self.config = config
    }

    /// Extract frames from a video at the configured FPS
    /// - Parameter videoURL: URL of the video file
    /// - Returns: Array of extracted frames with timestamps
    func extract(from videoURL: URL) async throws -> [ExtractedFrame] {
        // Verify FFmpeg exists
        guard FileManager.default.fileExists(atPath: config.ffmpegPath) else {
            throw MediaProcessorError.ffmpegNotFound(path: config.ffmpegPath)
        }

        // Create temp directory for frames
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("MediaProcessor-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

        defer {
            // Cleanup temp directory
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Run FFmpeg to extract frames
        let outputPattern = tempDir.appendingPathComponent("frame_%04d.png").path

        let process = Process()
        process.executableURL = URL(fileURLWithPath: config.ffmpegPath)
        process.arguments = [
            "-i", videoURL.path,
            "-vf", "fps=\(config.framesPerSecond)",
            "-frame_pts", "1",
            outputPattern
        ]

        let errorPipe = Pipe()
        process.standardError = errorPipe
        process.standardOutput = FileHandle.nullDevice

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw MediaProcessorError.frameExtractionFailed(errorMessage)
        }

        // Load extracted frames
        let fileManager = FileManager.default
        let files = try fileManager.contentsOfDirectory(at: tempDir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "png" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }

        guard !files.isEmpty else {
            throw MediaProcessorError.noFramesExtracted
        }

        var frames: [ExtractedFrame] = []

        for (index, fileURL) in files.enumerated() {
            guard let image = NSImage(contentsOf: fileURL) else { continue }

            let timestamp = Double(index) / config.framesPerSecond
            frames.append(ExtractedFrame(image: image, timestamp: timestamp))
        }

        guard !frames.isEmpty else {
            throw MediaProcessorError.noFramesExtracted
        }

        return frames
    }
}
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/VideoProcessor/FrameExtractor.swift
git commit -m "feat(media-processor): add frame extraction

Extracts frames from video using FFmpeg:
- Configurable FPS (default 1.0)
- Outputs PNG frames to temp directory
- Returns ExtractedFrame array with timestamps
- Cleans up temp files automatically"
```

---

## Task 4: Implement FrameDeduplicator

**Files:**
- Create: `DIP/Core/MediaProcessor/VideoProcessor/FrameDeduplicator.swift`

**Step 1: Create FrameDeduplicator.swift**

```swift
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
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/VideoProcessor/FrameDeduplicator.swift
git commit -m "feat(media-processor): add frame deduplication

Removes near-identical frames using perceptual hashing:
- Configurable similarity threshold (default 90%)
- Always preserves first and last frames
- Compares each frame to last retained frame"
```

---

## Task 5: Implement FrameSelector

**Files:**
- Create: `DIP/Core/MediaProcessor/VideoProcessor/FrameSelector.swift`

**Step 1: Create FrameSelector.swift**

```swift
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
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/VideoProcessor/FrameSelector.swift
git commit -m "feat(media-processor): add frame selection

Selects 3-10 key frames using uniform sampling:
- Always includes first and last frame
- Uniformly samples middle frames
- Target: 10% of deduplicated frames, clamped to 3-10"
```

---

## Task 6: Implement AudioExtractor

**Files:**
- Create: `DIP/Core/MediaProcessor/AudioProcessor/AudioExtractor.swift`

**Step 1: Create AudioExtractor.swift**

```swift
/// AudioExtractor.swift
///
/// Extracts audio from video files using FFmpeg.
/// Outputs WAV format suitable for transcription APIs.
///
/// Usage:
///   let extractor = AudioExtractor(config: .default)
///   let audioURL = try await extractor.extract(from: videoURL)
///   // Remember to delete audioURL when done
///
/// Dependencies:
///   - FFmpeg binary (at config.ffmpegPath)

import Foundation

/// Extracts audio from video files using FFmpeg
struct AudioExtractor {
    private let config: MediaProcessorConfig

    init(config: MediaProcessorConfig = .default) {
        self.config = config
    }

    /// Extract audio from video to WAV file
    /// - Parameter videoURL: URL of the video file
    /// - Returns: URL of the extracted WAV file (caller must delete when done)
    func extract(from videoURL: URL) async throws -> URL {
        // Verify FFmpeg exists
        guard FileManager.default.fileExists(atPath: config.ffmpegPath) else {
            throw MediaProcessorError.ffmpegNotFound(path: config.ffmpegPath)
        }

        // Create output URL in temp directory
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("audio-\(UUID().uuidString).wav")

        let process = Process()
        process.executableURL = URL(fileURLWithPath: config.ffmpegPath)
        process.arguments = [
            "-i", videoURL.path,
            "-vn",                          // No video
            "-acodec", "pcm_s16le",         // PCM 16-bit
            "-ar", "\(config.audioSampleRate)", // Sample rate
            "-ac", "\(config.audioChannels)",   // Channels
            "-y",                           // Overwrite output
            outputURL.path
        ]

        let errorPipe = Pipe()
        process.standardError = errorPipe
        process.standardOutput = FileHandle.nullDevice

        try process.run()
        process.waitUntilExit()

        // FFmpeg returns 0 on success, but may warn about no audio
        // Check if output file was created and has content
        if FileManager.default.fileExists(atPath: outputURL.path) {
            let attributes = try FileManager.default.attributesOfItem(atPath: outputURL.path)
            let fileSize = attributes[.size] as? Int ?? 0

            if fileSize > 44 { // WAV header is 44 bytes, need more for actual audio
                return outputURL
            }
        }

        // No audio track or extraction failed
        let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
        let errorMessage = String(data: errorData, encoding: .utf8) ?? "No audio track found"
        throw MediaProcessorError.audioExtractionFailed(errorMessage)
    }
}
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/AudioProcessor/AudioExtractor.swift
git commit -m "feat(media-processor): add audio extraction

Extracts audio from video using FFmpeg:
- Outputs WAV (PCM 16-bit, 16kHz mono)
- Returns temp file URL (caller must delete)
- Detects missing audio track"
```

---

## Task 7: Implement TranscriptionService

**Files:**
- Create: `DIP/Core/MediaProcessor/AudioProcessor/TranscriptionService.swift`

**Step 1: Create TranscriptionService.swift**

```swift
/// TranscriptionService.swift
///
/// Transcribes audio using ElevenLabs Scribe v2 API.
/// Returns timestamped transcript segments for anchoring to frames.
///
/// Usage:
///   let service = TranscriptionService(apiKey: "...")
///   let result = try await service.transcribe(audioURL: fileURL)
///
/// API Docs: https://elevenlabs.io/docs/api-reference/speech-to-text

import Foundation

/// Result of transcription with timing information
struct TranscriptionResult {
    /// The full transcript text
    let fullText: String

    /// Transcript segments with timestamps
    let segments: [TranscriptSegment]
}

/// Transcribes audio using ElevenLabs Scribe v2
struct TranscriptionService {
    private let apiKey: String
    private let model: String
    private let endpoint = URL(string: "https://api.elevenlabs.io/v1/speech-to-text")!

    init(apiKey: String, model: String = "scribe_v2") {
        self.apiKey = apiKey
        self.model = model
    }

    init(config: MediaProcessorConfig) {
        self.apiKey = config.elevenLabsAPIKey
        self.model = config.elevenLabsModel
    }

    /// Transcribe an audio file
    /// - Parameter audioURL: URL of the audio file (WAV format)
    /// - Returns: Transcription result with segments
    func transcribe(audioURL: URL) async throws -> TranscriptionResult {
        // Validate API key
        guard !apiKey.isEmpty, apiKey != "YOUR_API_KEY" else {
            throw MediaProcessorError.invalidAPIKey
        }

        // Read audio file
        let audioData = try Data(contentsOf: audioURL)

        // Create multipart form data
        let boundary = UUID().uuidString
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")

        var body = Data()

        // Add model_id field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"model_id\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(model)\r\n".data(using: .utf8)!)

        // Add file field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)

        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        // Make request
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw MediaProcessorError.transcriptionFailed("Invalid response")
        }

        guard httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw MediaProcessorError.transcriptionFailed("HTTP \(httpResponse.statusCode): \(errorBody)")
        }

        // Parse response
        let decoded = try JSONDecoder().decode(ElevenLabsResponse.self, from: data)

        // Group words into segments (by sentence or pause)
        let segments = groupWordsIntoSegments(decoded.words ?? [])

        return TranscriptionResult(
            fullText: decoded.text ?? "",
            segments: segments
        )
    }

    /// Group words into segments based on punctuation and pauses
    private func groupWordsIntoSegments(_ words: [ElevenLabsWord]) -> [TranscriptSegment] {
        guard !words.isEmpty else { return [] }

        var segments: [TranscriptSegment] = []
        var currentWords: [ElevenLabsWord] = []
        var segmentStart: Double = words[0].start

        for (index, word) in words.enumerated() {
            currentWords.append(word)

            let isLast = index == words.count - 1
            let endsWithPunctuation = word.text.hasSuffix(".") ||
                                       word.text.hasSuffix("?") ||
                                       word.text.hasSuffix("!")

            // Check for pause before next word
            var hasPause = false
            if !isLast {
                let nextWord = words[index + 1]
                hasPause = (nextWord.start - word.end) > 0.5 // 500ms pause
            }

            // Create segment at sentence boundary, pause, or end
            if endsWithPunctuation || hasPause || isLast {
                let text = currentWords.map { $0.text }.joined(separator: " ")
                let segment = TranscriptSegment(
                    text: text,
                    startTime: segmentStart,
                    endTime: word.end
                )
                segments.append(segment)

                // Reset for next segment
                currentWords = []
                if !isLast {
                    segmentStart = words[index + 1].start
                }
            }
        }

        return segments
    }
}

// MARK: - ElevenLabs API Response Models

private struct ElevenLabsResponse: Decodable {
    let text: String?
    let words: [ElevenLabsWord]?
}

private struct ElevenLabsWord: Decodable {
    let text: String
    let start: Double
    let end: Double
}
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/AudioProcessor/TranscriptionService.swift
git commit -m "feat(media-processor): add transcription service

ElevenLabs Scribe v2 API client:
- Sends audio via multipart form data
- Returns timestamped word-level results
- Groups words into segments by punctuation/pauses"
```

---

## Task 8: Implement TranscriptAnchor

**Files:**
- Create: `DIP/Core/MediaProcessor/TranscriptAnchor.swift`

**Step 1: Create TranscriptAnchor.swift**

```swift
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
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/TranscriptAnchor.swift
git commit -m "feat(media-processor): add transcript anchoring

Anchors transcript segments to frames:
- Each frame owns speech from its timestamp to next frame
- Last frame owns all remaining speech
- Returns nil transcript for silent windows"
```

---

## Task 9: Implement MediaProcessor (Main Orchestrator)

**Files:**
- Create: `DIP/Core/MediaProcessor/MediaProcessor.swift`

**Step 1: Create MediaProcessor.swift**

```swift
/// MediaProcessor.swift
///
/// Main entry point for the media processing pipeline.
/// Orchestrates parallel video and audio processing, then combines results.
///
/// Usage:
///   let processor = MediaProcessor(config: .default)
///   let result = try await processor.process(videoURL: recordingURL)
///   // result.frames contains 3-10 AnnotatedFrames
///   // Video file is deleted after processing
///
/// Pipeline:
///   1. Extract frames at 1 FPS (parallel with audio)
///   2. Deduplicate frames using perceptual hashing
///   3. Select 3-10 key frames
///   4. Extract audio to WAV (parallel with video)
///   5. Transcribe via ElevenLabs
///   6. Anchor transcript segments to frames
///   7. Delete source video
///   8. Return ProcessedRecording

import Foundation

/// Main media processing pipeline
@MainActor
final class MediaProcessor: ObservableObject {
    private let config: MediaProcessorConfig

    // Pipeline components
    private let frameExtractor: FrameExtractor
    private let frameDeduplicator: FrameDeduplicator
    private let frameSelector: FrameSelector
    private let audioExtractor: AudioExtractor
    private let transcriptionService: TranscriptionService

    /// Processing state for UI binding
    @Published var isProcessing: Bool = false
    @Published var processingStatus: String = ""
    @Published var error: String? = nil

    init(config: MediaProcessorConfig = .default) {
        self.config = config
        self.frameExtractor = FrameExtractor(config: config)
        self.frameDeduplicator = FrameDeduplicator(threshold: config.similarityThreshold)
        self.frameSelector = FrameSelector(minFrames: config.minFrames, maxFrames: config.maxFrames)
        self.audioExtractor = AudioExtractor(config: config)
        self.transcriptionService = TranscriptionService(config: config)
    }

    /// Process a video recording into structured output
    /// - Parameter videoURL: URL of the video file to process
    /// - Returns: Processed recording with frames and transcript
    /// - Note: The source video is deleted after successful processing
    func process(videoURL: URL) async throws -> ProcessedRecording {
        isProcessing = true
        error = nil

        defer {
            isProcessing = false
            processingStatus = ""
        }

        let startTime = Date()

        // Run video and audio processing in parallel
        processingStatus = "Processing video and audio..."

        async let videoTask = processVideo(videoURL)
        async let audioTask = processAudio(videoURL)

        // Wait for both to complete
        let frames: [ExtractedFrame]
        let transcription: TranscriptionResult?

        do {
            frames = try await videoTask
        } catch {
            self.error = error.localizedDescription
            throw error
        }

        // Audio can fail gracefully (no audio track)
        do {
            transcription = try await audioTask
        } catch {
            print("[MediaProcessor] Audio processing failed (continuing without transcript): \(error)")
            transcription = nil
        }

        // Anchor transcript to frames
        processingStatus = "Finalizing..."

        let segments = transcription?.segments ?? []
        let annotatedFrames = TranscriptAnchor.anchor(frames: frames, segments: segments)

        // Build metadata
        let metadata = RecordingMetadata(
            duration: frames.last?.timestamp ?? 0,
            originalFrameCount: frames.count, // After extraction, before selection
            selectedFrameCount: annotatedFrames.count,
            processedAt: Date()
        )

        let result = ProcessedRecording(
            frames: annotatedFrames,
            metadata: metadata
        )

        // Delete source video
        try? FileManager.default.removeItem(at: videoURL)

        let elapsed = Date().timeIntervalSince(startTime)
        print("[MediaProcessor] Completed in \(String(format: "%.2f", elapsed))s")

        return result
    }

    // MARK: - Private Pipeline Methods

    private func processVideo(_ url: URL) async throws -> [ExtractedFrame] {
        processingStatus = "Extracting frames..."
        let extracted = try await frameExtractor.extract(from: url)

        processingStatus = "Deduplicating frames..."
        let deduplicated = frameDeduplicator.deduplicate(extracted)

        processingStatus = "Selecting key frames..."
        let selected = frameSelector.select(from: deduplicated)

        print("[MediaProcessor] Video: \(extracted.count) extracted -> \(deduplicated.count) deduplicated -> \(selected.count) selected")

        return selected
    }

    private func processAudio(_ url: URL) async throws -> TranscriptionResult {
        processingStatus = "Extracting audio..."
        let audioURL = try await audioExtractor.extract(from: url)

        defer {
            // Clean up temp audio file
            try? FileManager.default.removeItem(at: audioURL)
        }

        processingStatus = "Transcribing..."
        let transcription = try await transcriptionService.transcribe(audioURL: audioURL)

        print("[MediaProcessor] Audio: \(transcription.segments.count) segments, \(transcription.fullText.count) chars")

        return transcription
    }
}
```

**Step 2: Commit**

```bash
git add DIP/Core/MediaProcessor/MediaProcessor.swift
git commit -m "feat(media-processor): add main orchestrator

MediaProcessor orchestrates the full pipeline:
- Parallel video and audio processing
- Graceful degradation if audio fails
- Progress status for UI binding
- Deletes source video after processing
- Returns ProcessedRecording with annotated frames"
```

---

## Task 10: Add Files to Xcode Project

**Step 1: Open Xcode and add files**

The files need to be added to the Xcode project. After creating all files:

1. Open `DIP.xcodeproj` in Xcode
2. Right-click on the `DIP` folder in the navigator
3. Select "Add Files to DIP..."
4. Navigate to `DIP/Core/MediaProcessor`
5. Select the `MediaProcessor` folder
6. Ensure "Copy items if needed" is unchecked
7. Ensure "Create groups" is selected
8. Click "Add"

**Step 2: Build and verify**

```bash
cd /Users/mohammadtallab/Documents/GitHub/A-Team
xcodebuild -project DIP.xcodeproj -scheme DIP -configuration Debug build
```

Expected: Build succeeds with no errors.

**Step 3: Commit project file changes**

```bash
git add DIP.xcodeproj/
git commit -m "chore: add MediaProcessor files to Xcode project"
```

---

## Task 11: Integration Test

**Step 1: Create a test recording**

Use the existing app to create a short test recording (5-10 seconds) with speech.

**Step 2: Test the pipeline manually**

Add temporary test code to `ContentView.swift` or create a test button that:

```swift
// Temporary test - add to ContentView or similar
Task {
    let processor = MediaProcessor(config: .default)

    // Use a known test video path
    let testURL = URL(fileURLWithPath: "/path/to/test/recording.mp4")

    do {
        let result = try await processor.process(videoURL: testURL)
        print("Frames: \(result.frames.count)")
        print("Transcript: \(result.fullTranscript)")
        for frame in result.frames {
            print("[\(frame.timestamp)s] \(frame.transcript ?? "(silent)")")
        }
    } catch {
        print("Error: \(error)")
    }
}
```

**Step 3: Verify output**

- 3-10 frames selected
- Transcript segments anchored to frames
- No crashes or memory leaks
- Source video deleted

**Step 4: Remove test code and commit**

```bash
git add -A
git commit -m "test: verify MediaProcessor pipeline integration"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Data models | 7 files in Models/ |
| 2 | Perceptual hash | PerceptualHash.swift |
| 3 | Frame extraction | FrameExtractor.swift |
| 4 | Frame deduplication | FrameDeduplicator.swift |
| 5 | Frame selection | FrameSelector.swift |
| 6 | Audio extraction | AudioExtractor.swift |
| 7 | Transcription | TranscriptionService.swift |
| 8 | Transcript anchoring | TranscriptAnchor.swift |
| 9 | Main orchestrator | MediaProcessor.swift |
| 10 | Xcode integration | Project file updates |
| 11 | Integration test | Manual verification |

**Total: 11 tasks, ~15 files**
