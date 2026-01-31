# MediaProcessor Pipeline Design

**Date:** 2026-01-31
**Status:** Approved
**Context:** VisionFlow hackathon project - core media processing pipeline

---

## Overview

The MediaProcessor transforms a screen recording (.mov/.mp4) into a structured `ProcessedRecording` containing 3-10 key frames with anchored transcript segments. This pipeline is the foundation for all three modes (Clipboard, Built-in LLM, Livestream).

---

## Data Models

```swift
// Output structure - consumed by Mode 1, 2, 3
struct ProcessedRecording {
    let frames: [AnnotatedFrame]
    let metadata: RecordingMetadata

    var fullTranscript: String {  // Computed, not stored
        frames.compactMap { $0.transcript }.joined(separator: " ")
    }
}

struct AnnotatedFrame {
    let image: NSImage
    let timestamp: Double             // Seconds from start
    let index: Int
    let transcript: String?           // Speech during this frame's window (nil if silent)
}

struct RecordingMetadata {
    let duration: Double
    let originalFrameCount: Int
    let selectedFrameCount: Int
    let processedAt: Date
}

// Internal only
struct ExtractedFrame {
    let image: NSImage
    let timestamp: Double
}

struct TranscriptSegment {
    let text: String
    let startTime: Double
    let endTime: Double
}
```

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MediaProcessor                          │
│                                                             │
│  process(videoURL) async throws -> ProcessedRecording       │
│                                                             │
│         ┌──────────────┴──────────────┐                     │
│         │                             │                     │
│         ▼                             ▼                     │
│  ┌─────────────┐              ┌─────────────┐               │
│  │   Video     │              │   Audio     │               │
│  │  Pipeline   │              │  Pipeline   │               │
│  │             │              │             │               │
│  │ extract     │              │ extract     │               │
│  │ dedupe      │              │ transcribe  │               │
│  │ select      │              │ (ElevenLabs)│               │
│  └──────┬──────┘              └──────┬──────┘               │
│         │                            │                      │
│         └────────────┬───────────────┘                      │
│                      ▼                                      │
│              ┌─────────────┐                                │
│              │   Anchor    │                                │
│              │ Transcripts │                                │
│              └──────┬──────┘                                │
│                     ▼                                       │
│              ProcessedRecording                             │
│                     │                                       │
│                     ▼                                       │
│              Delete source video                            │
└─────────────────────────────────────────────────────────────┘
```

**Parallelism:** Video and audio pipelines run concurrently via `async let`. Total time ≈ max(video, audio).

---

## File Structure

```
DIP/
├── Core/
│   └── MediaProcessor/
│       ├── MediaProcessor.swift           # Entry point, orchestration
│       ├── VideoProcessor/
│       │   ├── FrameExtractor.swift       # FFmpeg frame extraction
│       │   ├── FrameDeduplicator.swift    # pHash + deduplication
│       │   ├── FrameSelector.swift        # 3-10 frame selection
│       │   └── PerceptualHash.swift       # pHash implementation
│       ├── AudioProcessor/
│       │   ├── AudioExtractor.swift       # FFmpeg audio extraction
│       │   └── TranscriptionService.swift # ElevenLabs API client
│       ├── TranscriptAnchor.swift         # Anchors segments to frames
│       └── Models/
│           ├── ProcessedRecording.swift
│           ├── AnnotatedFrame.swift
│           ├── RecordingMetadata.swift
│           ├── ExtractedFrame.swift       # Internal
│           └── TranscriptSegment.swift    # Internal
└── .env                                   # API keys
```

---

## Configuration

```swift
struct MediaProcessorConfig {
    // Frame extraction
    let framesPerSecond: Double = 1.0

    // Deduplication
    let similarityThreshold: Double = 0.90

    // Selection
    let minFrames: Int = 3
    let maxFrames: Int = 10

    // Audio
    let audioSampleRate: Int = 16000
    let audioChannels: Int = 1

    // ElevenLabs
    let elevenLabsAPIKey: String
    let elevenLabsModel: String = "scribe_v2"

    // FFmpeg
    let ffmpegPath: String = "/opt/homebrew/bin/ffmpeg"

    static var `default`: MediaProcessorConfig {
        MediaProcessorConfig(
            elevenLabsAPIKey: ProcessInfo.processInfo.environment["ELEVENLABS_API_KEY"]
                ?? "sk_7316878f3f23d00d4c57afe2e27a475c389deb1d2a57d47c"
        )
    }
}
```

---

## Error Handling

```swift
enum MediaProcessorError: Error {
    case ffmpegNotFound(path: String)
    case frameExtractionFailed(String)
    case noFramesExtracted
    case audioExtractionFailed(String)
    case transcriptionFailed(String)
    case invalidAPIKey
}
```

**Graceful degradation:**
- No audio track → Process frames only, all `transcript` fields are `nil`
- Transcription fails → Log warning, return frames without transcript
- No frames extracted → Throw error (can't proceed)

---

## Key Implementation Details

### Perceptual Hash (pHash)

```swift
struct PerceptualHash {
    let hash: UInt64

    init(image: NSImage) {
        // 1. Resize to 32x32
        // 2. Convert to grayscale
        // 3. Apply DCT (discrete cosine transform)
        // 4. Take top-left 8x8 of DCT coefficients
        // 5. Compute median, set bits above/below median
        // Result: 64-bit hash
    }

    func similarity(to other: PerceptualHash) -> Double {
        let xor = hash ^ other.hash
        let differentBits = xor.nonzeroBitCount
        return 1.0 - (Double(differentBits) / 64.0)
    }
}
```

### ElevenLabs Scribe v2 API

```
POST https://api.elevenlabs.io/v1/speech-to-text
Headers: xi-api-key: YOUR_KEY
Body: multipart/form-data with "file" and "model_id=scribe_v2"

Response:
{
    "text": "Full transcript...",
    "words": [
        { "text": "So", "start": 0.0, "end": 0.15 },
        { "text": "I'm", "start": 0.15, "end": 0.28 }
    ]
}
```

Words grouped into `TranscriptSegment` by sentence boundaries or pauses (>0.5s gap).

### Transcript Anchoring

Each frame "owns" speech from its timestamp until the next frame's timestamp. Last frame owns everything until the end.

---

## Post-Processing

After successful processing, delete the source video file to save disk space. The `ProcessedRecording` becomes the canonical artifact.

---

## Expected Performance

| Recording Length | Frame Processing | Transcription | Total |
|------------------|------------------|---------------|-------|
| 15 seconds       | ~0.8s            | ~1.5-2s       | ~2-3s |
| 30 seconds       | ~1.0s            | ~2-3s         | ~3-4s |
| 60 seconds       | ~1.5s            | ~3-4s         | ~4-5s |

Parallel execution means total ≈ max(video, audio), not sum.
