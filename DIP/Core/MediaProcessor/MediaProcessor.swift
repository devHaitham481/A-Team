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
