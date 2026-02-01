# VisionFlow

A desktop app that gives LLMs visual context through screen recordings.

**Problem:** Users struggle to explain what they're looking at when asking LLMs for help with confusing interfaces.

**Solution:** Record your screen, speak your question, get instant guidance — or paste the context into any LLM.

Built at **Cursor AI Hackathon Hamburg 2026**.

---

## Features

### Three Modes

| Mode | Description |
|------|-------------|
| **Clipboard** | Record → Copy to clipboard → Paste into any LLM |
| **Instant Answer** | Record → Get response displayed/spoken immediately |
| **Livestream** | Real-time guidance as you navigate |

---

## Tech Stack

- **Frontend:** Electron, JavaScript
- **Backend:** Python, FastAPI (for Gemini Live streaming)
- **AI:** Google Gemini (vision + audio analysis)
- **Screen Recording:** MediaRecorder API, MSS (Python)
- **Audio:** PyAudio, Web Audio API

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **FFmpeg** (optional, for advanced video processing)
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

### System Dependencies

**macOS:**
```bash
brew install portaudio
```

**Linux:**
```bash
sudo apt-get install python3-pyaudio portaudio19-dev
```

---

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/your-org/VisionFlow.git
cd VisionFlow

# Install Node.js dependencies
npm install

# Install Python dependencies (for Live mode)
cd mode-3-backend
pip install -r requirements.txt
cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
GEMINI_API_KEY=your_api_key_here
```

Create `mode-3-backend/.env` for the Python backend:

```bash
GOOGLE_API_KEY=your_api_key_here
```

### 3. Run

```bash
npm start
```

For development with logging:

```bash
npm run dev
```

---

## Usage

### Hotkeys

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + R` | Toggle Recording (Mode 1) |
| `Cmd/Ctrl + Shift + A` | Toggle Ask AI (Mode 2) |
| `Cmd/Ctrl + Shift + L` | Toggle Live (Mode 3) |

### Live Mode Controls

| Key | Action |
|-----|--------|
| `F9` | Toggle Mute / Push-to-Talk |
| `F10` | End Session |

### Mode 1: Clipboard Recorder

1. Press `Cmd/Ctrl + Shift + R` or click the record button (⊙)
2. Record your screen and speak your question
3. Press again to stop
4. Video is automatically copied to clipboard
5. Paste into any LLM (ChatGPT, Claude, etc.)

### Mode 2: Instant Answer

1. Press `Cmd/Ctrl + Shift + A` or click Ask AI (✦)
2. Record your screen and ask your question
3. Stop recording to get an instant response
4. Response appears in an overlay window
5. Click **Reply** to continue the conversation

### Mode 3: Livestream

1. Press `Cmd/Ctrl + Shift + L` or click Live (◯)
2. Your screen and audio stream in real-time to Gemini
3. Ask questions naturally — get instant responses
4. Press `F10` to end the session

---

## Project Structure

```
VisionFlow/
├── src/
│   ├── main.js              # Electron main process
│   ├── gemini.js            # Gemini API integration
│   ├── preload.js           # Security bridge
│   └── renderer/
│       ├── index.html       # Main UI
│       ├── renderer.js      # UI logic
│       ├── capture.js       # Screen/audio recording
│       ├── overlay.html     # Response overlay
│       └── overlay.js       # Overlay logic
├── mode-3-backend/
│   ├── api.py               # FastAPI server
│   ├── gemini_live.py       # Gemini Live streaming client
│   └── requirements.txt     # Python dependencies
├── prompts/                  # Configurable AI prompts
│   ├── 1-detailed-extractor.txt
│   ├── 2-narrative-flow.txt
│   ├── 3-structured-sections.txt
│   └── 4-ai-ready-context.txt
├── package.json
└── .env
```

---

## Prompt Templates

Switch between different AI response styles:

```bash
npm run prompt:1  # Detailed Extractor — Maximum screen detail
npm run prompt:2  # Narrative Flow — Story-like explanations
npm run prompt:3  # Structured Sections — Organized by sections
npm run prompt:4  # AI-Ready Context — Formatted for other AI tools
```

---

## Configuration

### Screen Capture (Live Mode)

| Setting | Default | Description |
|---------|---------|-------------|
| FPS | 2 | Frames per second (adaptive 1-2) |
| Audio Sample Rate | 16kHz | Mono audio capture |
| Queue Limit | 5 audio, 1 video | Prevents buffer bloat |

### Audio Settings

- **Channels:** Mono
- **Sample Rate:** 16kHz (send), 24kHz (receive)
- **Echo Cancellation:** Enabled
- **Noise Suppression:** Enabled

---

## API Models Used

| Mode | Model | Purpose |
|------|-------|---------|
| 1 & 2 | `gemini-3-flash-preview` | Video analysis |
| 3 | `gemini-2.5-flash-native-audio-latest` | Real-time streaming |

---

## Development

### Architecture

```
User Input (Hotkeys/UI)
        ↓
    main.js (IPC Router)
    ├─→ Mode 1: capture → transcribe → Gemini → clipboard
    ├─→ Mode 2: capture → transcribe → Gemini → overlay
    └─→ Mode 3: api.py → gemini_live.py → SSE → overlay
```

### IPC Channels

**Main → Renderer:**
- `toggle-record`, `toggle-live`, `toggle-askai`
- `live-transcript`
- `start-reply`, `stop-reply`

**Renderer → Main:**
- `get-sources`, `transcribe`, `transcribe-with-context`
- `start-gemini-live`, `stop-gemini-live`
- `save-and-copy-video`

---

## Troubleshooting

### "Browser not installed" error
Reinstall Electron:
```bash
npm rebuild electron
```

### PyAudio installation fails
Install PortAudio first:
```bash
# macOS
brew install portaudio

# Linux
sudo apt-get install portaudio19-dev
```

### Live mode not starting
Check if the backend server is running:
```bash
curl http://localhost:8000/health
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT

---

## Credits

Built with love at **Cursor AI Hackathon Hamburg 2026**.

Powered by [Google Gemini](https://ai.google.dev/), [Electron](https://www.electronjs.org/), and [FastAPI](https://fastapi.tiangolo.com/).
