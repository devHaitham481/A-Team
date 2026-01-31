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
