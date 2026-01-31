import Foundation
import FirebaseCore
import FirebaseAI

@MainActor
class GeminiLiveService: ObservableObject {

    // MARK: - Published Properties
    @Published private(set) var isConnected = false

    // MARK: - Private Properties
    private var liveModel: LiveModel?
    private var session: LiveSession?
    private var responseTask: Task<Void, Never>?

    // MARK: - Callbacks
    var onAudioReceived: ((Data) -> Void)?
    var onInputTranscript: ((String) -> Void)?
    var onOutputTranscript: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    // MARK: - Configuration
    private let modelName = "gemini-2.0-flash-live-001"
    private let voiceName = "Kore"  // Weiblich, warm - gut für ältere User

    // MARK: - System Prompt
    private let systemPrompt = """
    Du bist ein freundlicher Assistent der älteren Menschen hilft ihren Computer zu bedienen.

    WICHTIGE REGELN:
    1. Gib immer nur EINEN einfachen Schritt auf einmal
    2. Beschreibe Buttons mit Farbe, Position und genauem Text
    3. Zum Beispiel: "Klicke auf den großen orangen Button rechts der 'In den Warenkorb' heißt"
    4. Halte Antworten KURZ - maximal 2-3 Sätze
    5. Sprich langsam und deutlich
    6. Sei geduldig und ermutigend
    7. Wenn du etwas nicht siehst, sag es ehrlich

    Der User teilt seinen Bildschirm mit dir. Du siehst was er sieht.
    Hilf ihm Schritt für Schritt bei seiner Aufgabe.
    """

    // MARK: - Initialize

    init() {
        setupModel()
    }

    private func setupModel() {
        let ai = FirebaseAI.firebaseAI(backend: .googleAI())

        let config = LiveGenerationConfig(
            responseModalities: [.audio],
            speechConfig: SpeechConfig(
                voiceConfig: VoiceConfig(
                    prebuiltVoiceConfig: PrebuiltVoiceConfig(voiceName: voiceName)
                )
            ),
            inputAudioTranscription: AudioTranscriptionConfig(),
            outputAudioTranscription: AudioTranscriptionConfig()
        )

        liveModel = ai.liveModel(
            modelName: modelName,
            generationConfig: config,
            systemInstruction: ModelContent(
                role: "system",
                parts: [.text(systemPrompt)]
            )
        )
    }

    // MARK: - Connect

    func connect() async throws {
        guard let liveModel = liveModel else {
            throw AssistantError.connectionFailed(
                underlying: NSError(domain: "Gemini", code: -1,
                                   userInfo: [NSLocalizedDescriptionKey: "Model nicht initialisiert"])
            )
        }

        do {
            session = try await liveModel.connect()
            isConnected = true
            startReceiving()
        } catch {
            throw AssistantError.connectionFailed(underlying: error)
        }
    }

    // MARK: - Disconnect

    func disconnect() {
        responseTask?.cancel()
        responseTask = nil
        session?.disconnect()
        session = nil
        isConnected = false
    }

    // MARK: - Send Audio

    func sendAudio(_ data: Data) async {
        guard let session = session, isConnected else { return }
        await session.sendAudioRealtime(data)
    }

    // MARK: - Send Video Frame

    func sendVideo(_ data: Data) async {
        guard let session = session, isConnected else { return }
        await session.sendVideoRealtime(data)
    }

    // MARK: - Receive Responses

    private func startReceiving() {
        guard let session = session else { return }

        responseTask = Task { [weak self] in
            do {
                for try await message in session.responses {
                    await self?.handleMessage(message)
                }
            } catch {
                await MainActor.run { [weak self] in
                    self?.onError?(error)
                    self?.isConnected = false
                }
            }
        }
    }

    private func handleMessage(_ message: LiveServerMessage) async {
        switch message.payload {
        case .content(let content):
            // Handle audio and text parts
            for part in content.modelTurn?.parts ?? [] {
                if let inlineData = part as? InlineDataPart {
                    if inlineData.mimeType.starts(with: "audio/pcm") {
                        await MainActor.run { [weak self] in
                            self?.onAudioReceived?(inlineData.data)
                        }
                    }
                }
            }

        case .inputTranscription(let transcript):
            await MainActor.run { [weak self] in
                self?.onInputTranscript?(transcript.text)
            }

        case .outputTranscription(let transcript):
            await MainActor.run { [weak self] in
                self?.onOutputTranscript?(transcript.text)
            }

        default:
            break
        }
    }
}
