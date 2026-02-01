import asyncio
import io
import os
import traceback
import sys
from dotenv import load_dotenv

# Check for required packages
try:
    import pyaudio
    import mss
    from PIL import Image
    from google import genai
    from google.genai import types
except ImportError as e:
    print("Missing dependencies. Please run: pip install -r requirements.txt")
    print(f"Error: {e}")
    sys.exit(1)

load_dotenv()

# Configuration
# You need a Gemini API Key. Get it from https://aistudio.google.com/
API_KEY = os.environ.get("GOOGLE_API_KEY")
MODEL = "gemini-2.5-flash-native-audio-latest"  # Gemini Live API model with native audio

# Audio Configuration
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE_IN = 16000  # Input rate for microphone
CHUNK = 512
RATE_OUT = 24000 # Output rate for Gemini response

class AudioHandler:
    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.stream_in = None
        self.stream_out = None

    def start(self):
        # Input Stream (Microphone)
        self.stream_in = self.p.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RATE_IN,
            input=True,
            frames_per_buffer=CHUNK
        )
        # Output Stream (Speaker)
        self.stream_out = self.p.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RATE_OUT,
            output=True
        )

    def stop(self):
        if self.stream_in:
            self.stream_in.stop_stream()
            self.stream_in.close()
        if self.stream_out:
            self.stream_out.stop_stream()
            self.stream_out.close()
        self.p.terminate()

async def audio_sender(audio_handler, session):
    """Continuously reads audio from microphone and sends to Gemini."""
    while True:
        try:
            # Read raw PCM data
            if audio_handler.stream_in.get_read_available() >= CHUNK:
                data = audio_handler.stream_in.read(CHUNK, exception_on_overflow=False)
                # Send to Gemini
                await session.send(input={"data": data, "mime_type": "audio/pcm"}, end_of_turn=False)
            
            await asyncio.sleep(0.001) # Yield to event loop
        except Exception as e:
            print(f"Audio sender error: {e}")
            break

async def video_sender(session):
    """Continuously captures screen and sends to Gemini."""
    with mss.mss() as sct:
        # Capture the first monitor. Adjust 'monitors[1]' if you have multiple screens.
        monitor = sct.monitors[1]
        
        while True:
            try:
                # Screen capture
                sct_img = sct.grab(monitor)
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                
                # Resize to reduce bandwidth/latency (e.g. 1024px max dimension)
                img.thumbnail((1024, 1024))
                
                # Compress to JPEG
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=50)
                image_bytes = buf.getvalue()
                
                # Send to Gemini
                await session.send(input={"data": image_bytes, "mime_type": "image/jpeg"}, end_of_turn=False)
                
                # Frame rate control: 2 FPS is usually sufficient for "seeing" the screen context
                # Increase sleep to reduce bandwidth, decrease for smoother video (but higher latency risk)
                await asyncio.sleep(0.5) 
            except Exception as e:
                print(f"Video sender error: {e}")
                break

async def response_receiver(audio_handler, session):
    """Receives audio responses from Gemini and plays them."""
    async for response in session.receive():
        server_content = response.server_content
        if server_content is not None:
            model_turn = server_content.model_turn
            if model_turn is not None:
                for part in model_turn.parts:
                    if part.inline_data is not None and part.inline_data.mime_type.startswith("audio/"):
                        # Play audio data
                        audio_data = part.inline_data.data
                        audio_handler.stream_out.write(audio_data)

async def main():
    if not API_KEY:
        print("Error: GOOGLE_API_KEY environment variable is not set.")
        print("Get your key here: https://aistudio.google.com/")
        print("Then run: export GOOGLE_API_KEY='your_key_here'")
        return

    print("Initializing Gemini Live Client...")
    
    # Initialize Client (v1alpha needed for Live API as of now)
    client = genai.Client(api_key=API_KEY, http_options={"api_version": "v1alpha"})
    
    audio = AudioHandler()
    audio.start()

    # Configure session to receive AUDIO responses
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=types.Content(parts=[types.Part(text="You are a helpful and patient digital guide, designed to assist users who may be unfamiliar with the software or website they are currently using. Your primary task is to guide the user through processes on their screen, such as making a purchase, changing settings, or finding information. 1. Observe the user's screen continuously to understand their context. 2. Listen to the user's voice to understand their goal or confusion. 3. Provide clear, step-by-step verbal instructions based on the visual elements on the screen. 4. When describing actions, be specific about location and color (e.g., 'Click the orange 'Buy Now' button on the right'). 5. Explain what is happening if the user seems confused. 6. Maintain a calm, encouraging, and polite tone.")])
    )
    
    print("Connecting to Gemini...")
    try:
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            print("\nConnected! Gemini is watching your screen and listening.")
            print("Talk to it naturally. Press Ctrl+C to stop.\n")
            
            # Start background tasks
            task_audio = asyncio.create_task(audio_sender(audio, session))
            task_video = asyncio.create_task(video_sender(session))
            task_receive = asyncio.create_task(response_receiver(audio, session))
            
            # Keep running until one fails or user stops
            await asyncio.gather(task_audio, task_video, task_receive)
            
    except asyncio.CancelledError:
        pass
    except Exception as e:
        traceback.print_exc()
    finally:
        print("Closing audio streams...")
        audio.stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSession ended by user.")
