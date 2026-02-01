# Gemini Live API Demo

This project demonstrates how to use the Google Gemini Multimodal Live API to create a real-time voice and video assistant that can see your screen and hear you speak.

## Prerequisites

1.  **Python 3.10+**
2.  **PortAudio** (Required for PyAudio)
    -   macOS: `brew install portaudio`
    -   Linux: `sudo apt-get install python3-pyaudio portaudio19-dev`
    -   Windows: Usually pre-built wheels available, otherwise check PyAudio docs.

## Setup

1.  **Install Python packages:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Set your Google API Key:**
    You need an API key from [Google AI Studio](https://aistudio.google.com/).
    ```bash
    export GOOGLE_API_KEY="your_api_key_here"
    ```

## Usage

Run the script:
```bash
python gemini_live.py
```

The script will:
1.  Connect to the Gemini Live API.
2.  Start capturing audio from your default microphone.
3.  Start capturing your primary screen.
4.  Stream both audio and video to Gemini.
5.  Play back Gemini's audio responses in real-time.

Press `Ctrl+C` to stop the session.

## Troubleshooting

-   **Microphone/Speaker Issues:** Ensure your default input/output devices are correctly set in your system settings.
-   **Permissions:** On macOS, you may need to grant Terminal/VS Code permission to access the Microphone and Screen Recording in "System Settings > Privacy & Security".
