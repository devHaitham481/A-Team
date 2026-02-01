import asyncio
import io
import os
import time
import traceback
import threading
import pyaudio
import logging
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv
from google import genai
from google.genai.types import (
    LiveConnectConfig,
    PrebuiltVoiceConfig,
    SpeechConfig,
    VoiceConfig,
    Content,
    Part
)

load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s.%(msecs)03d - %(levelname)s - %(funcName)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("GeminiLive")
# INFO für normale Nutzung, DEBUG für Troubleshooting
logger.setLevel(logging.INFO)

import mss
from PIL import Image
from pynput import keyboard

# --- Configuration ---
API_KEY = os.environ.get("GOOGLE_API_KEY")

if not API_KEY:
    print("Error: GOOGLE_API_KEY environment variable is not set.")
    print("Get your key here: https://aistudio.google.com/")
    print("Then run: export GOOGLE_API_KEY='your_key_here'")
    exit(1)

MODEL = "gemini-2.5-flash-native-audio-latest"

# Audio Configuration
FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

# Video Configuration
SCREEN_FPS = 2  # Reduziert! 2 FPS reicht für Screen-Guidance
SCREEN_FPS_MIN = 1  # Minimum FPS unter Last
SCREEN_SEND_ONLY_DURING_TURN = True  # Nur Frames senden wenn User spricht

# VAD Helper: Stille nach PTT-Release senden um Turn-Ende zu signalisieren
SEND_SILENCE_AFTER_PTT_MS = 500  # 500ms Stille nach PTT-Release

# =============================================================================
# PROMPT 1: Queue-Limits und Drop-Policies
# =============================================================================
AUDIO_QUEUE_MAX_SIZE = 5  # Max 5 Audio-Chunks (~320ms bei 16kHz, 1024 samples)
SCREEN_QUEUE_SIZE = 1     # Nur neuester Frame (Latest-only Policy)

# =============================================================================
# PROMPT 3: Latenz-Budgets (in Millisekunden)
# =============================================================================
AUDIO_MAX_BACKLOG_MS = 200   # Audio älter als 200ms wird gedroppt
SCREEN_MAX_AGE_MS = 500      # Screen-Frames älter als 500ms werden gedroppt
STALL_TIMEOUT_S = 15         # Warnung nach 15s, Reconnect nach 30s
LATENCY_WINDOW_SIZE = 50     # Rolling average über 50 Samples


@dataclass
class TimestampedData:
    """Daten mit Zeitstempel für Latenz-Tracking."""
    data: bytes
    timestamp: float = field(default_factory=time.time)

    @property
    def age_ms(self) -> float:
        return (time.time() - self.timestamp) * 1000


@dataclass
class LatencyStats:
    """Rolling-Average Latenz-Statistiken."""
    audio_capture_to_send: deque = field(default_factory=lambda: deque(maxlen=LATENCY_WINDOW_SIZE))
    screen_capture_to_send: deque = field(default_factory=lambda: deque(maxlen=LATENCY_WINDOW_SIZE))
    model_response_latency: deque = field(default_factory=lambda: deque(maxlen=LATENCY_WINDOW_SIZE))

    def add_audio_latency(self, ms: float):
        self.audio_capture_to_send.append(ms)

    def add_screen_latency(self, ms: float):
        self.screen_capture_to_send.append(ms)

    def add_response_latency(self, ms: float):
        self.model_response_latency.append(ms)

    def avg_audio_ms(self) -> float:
        return sum(self.audio_capture_to_send) / len(self.audio_capture_to_send) if self.audio_capture_to_send else 0

    def avg_screen_ms(self) -> float:
        return sum(self.screen_capture_to_send) / len(self.screen_capture_to_send) if self.screen_capture_to_send else 0

    def avg_response_ms(self) -> float:
        return sum(self.model_response_latency) / len(self.model_response_latency) if self.model_response_latency else 0

    def log_stats(self):
        logger.info(
            f"📊 Latency Stats - Audio: {self.avg_audio_ms():.1f}ms, "
            f"Screen: {self.avg_screen_ms():.1f}ms, "
            f"Response: {self.avg_response_ms():.1f}ms"
        )

class GeminiLiveClient:
    def __init__(self, push_to_talk_mode: bool = False):
        """
        Args:
            push_to_talk_mode: True = PTT (Hotkey gedrückt = senden),
                               False = Toggle-Mute (F9 zum Umschalten)
        """
        self.client = genai.Client(api_key=API_KEY, http_options={"api_version": "v1alpha"})
        self.audio_queue_out = asyncio.Queue()
        # PROMPT 1: Bounded Queues mit Drop-Policy
        self.audio_queue_in = asyncio.Queue(maxsize=AUDIO_QUEUE_MAX_SIZE)
        self.video_queue_in = asyncio.Queue(maxsize=SCREEN_QUEUE_SIZE)
        self.pya_in = None
        self.pya_out = None
        self.running = True

        # Mute state (thread-safe)
        self._muted = threading.Event()
        self._muted.set()  # Startet gemutet für sauberen Start
        self._shutdown_event = threading.Event()

        # PROMPT 2: Push-to-Talk Mode
        self.push_to_talk_mode = push_to_talk_mode
        self._ptt_active = threading.Event()  # Wird gesetzt wenn PTT-Taste gedrückt

        # PROMPT 2: Turn Management
        self._current_turn_id: Optional[str] = None
        self._turn_end_requested = asyncio.Event()
        self._last_turn_end_time: float = 0
        self._session_ref = None
        self._audio_chunks_sent_this_turn: int = 0
        self._silence_chunks_to_send: int = 0  # Stille-Chunks nach PTT-Release

        # PROMPT 3: Latenz-Tracking und Statistiken
        self.latency_stats = LatencyStats()
        self._last_response_time: float = time.time()
        self._current_screen_fps = SCREEN_FPS
        self._audio_drop_count = 0
        self._screen_drop_count = 0

        # Hotkey listener
        self._hotkey_listener = None
        self._loop = None

    @property
    def muted(self):
        if self.push_to_talk_mode:
            # PTT: Nicht gemutet wenn Taste gedrückt
            return not self._ptt_active.is_set()
        return self._muted.is_set()

    def _clear_audio_queue(self):
        """PROMPT 1: Hard-Cut - Leert die Audio-Queue sofort."""
        dropped = 0
        while not self.audio_queue_in.empty():
            try:
                self.audio_queue_in.get_nowait()
                dropped += 1
            except asyncio.QueueEmpty:
                break
        if dropped > 0:
            logger.info(f"🗑️ Audio-Queue geleert: {dropped} Chunks verworfen (Hard-Cut)")

    def _clear_video_queue(self):
        """Leert die Video-Queue für frischen Frame bei Turn-Start."""
        dropped = 0
        while not self.video_queue_in.empty():
            try:
                self.video_queue_in.get_nowait()
                dropped += 1
            except asyncio.QueueEmpty:
                break
        if dropped > 0:
            logger.info(f"🗑️ Video-Queue geleert: {dropped} Frames verworfen")

    def toggle_mute(self):
        """Toggle mute state mit Turn-Ende."""
        was_muted = self._muted.is_set()

        if was_muted:
            # Unmute: Queue leeren für frischen Start
            self._clear_audio_queue()
            self._clear_video_queue()
            self._muted.clear()
            self._current_turn_id = str(uuid.uuid4())[:8]
            self._audio_chunks_sent_this_turn = 0
            logger.info(f"🎙️ Turn gestartet: {self._current_turn_id}")
            print(f"\n🎙️ MIC UNMUTED - Turn {self._current_turn_id} gestartet")
        else:
            # Mute: NICHT Queue leeren - restliches Audio muss gesendet werden
            self._muted.set()
            chunks_sent = self._audio_chunks_sent_this_turn

            if self._current_turn_id and chunks_sent > 0:
                # Stille-Chunks für VAD
                silence_chunks = max(1, SEND_SILENCE_AFTER_PTT_MS // 64)
                self._silence_chunks_to_send = silence_chunks

                logger.info(f"🔇 Turn beendet: {self._current_turn_id} ({chunks_sent} Chunks)")
                self._request_turn_end()
                print(f"\n🔇 MIC MUTED - {chunks_sent} Chunks, warte auf Antwort...")
            else:
                logger.info("🔇 Muted ohne Audio-Daten")
                print("\n🔇 MIC MUTED")

    def _request_turn_end(self):
        """PROMPT 2: Signalisiert Turn-Ende für sofortige Modell-Antwort."""
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._turn_end_requested.set)
            self._last_turn_end_time = time.time()

    def _on_ptt_press(self):
        """PROMPT 2: Push-to-Talk aktiviert."""
        # Ignoriere Key-Repeat wenn PTT bereits aktiv
        if self._ptt_active.is_set():
            return

        self._clear_audio_queue()
        self._clear_video_queue()
        self._ptt_active.set()
        self._current_turn_id = str(uuid.uuid4())[:8]
        self._audio_chunks_sent_this_turn = 0  # Reset Zähler
        logger.info(f"🎤 PTT aktiviert - Turn {self._current_turn_id}")
        print(f"\n🎤 PTT ACTIVE - Turn {self._current_turn_id}")

    def _on_ptt_release(self):
        """PROMPT 2: Push-to-Talk losgelassen - Turn beenden."""
        if not self._ptt_active.is_set():
            return

        self._ptt_active.clear()
        # WICHTIG: Audio-Queue NICHT leeren!
        # Die restlichen Chunks müssen noch gesendet werden.

        if self._current_turn_id:
            chunks_sent = self._audio_chunks_sent_this_turn
            logger.info(f"🎤 PTT losgelassen - Turn {self._current_turn_id} ({chunks_sent} Chunks)")

            if chunks_sent > 0:
                # Berechne wie viele Stille-Chunks zu senden sind
                # CHUNK_SIZE=1024 bei 16kHz = 64ms pro Chunk
                silence_chunks = max(1, SEND_SILENCE_AFTER_PTT_MS // 64)
                self._silence_chunks_to_send = silence_chunks
                logger.info(f"📤 Sende {silence_chunks} Stille-Chunks für VAD")

                self._request_turn_end()
                print(f"\n🎤 PTT RELEASED - {chunks_sent} Chunks, warte auf Antwort...")
            else:
                logger.warning("⚠️ Keine Audio-Daten gesendet")
                print("\n🎤 PTT RELEASED - Keine Audio-Daten (zu kurz?)")

    def request_shutdown(self):
        """Request graceful shutdown."""
        print("\n⏹️ Shutdown requested via hotkey...")
        self._shutdown_event.set()
        self.running = False
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._cancel_tasks)

    def _cancel_tasks(self):
        """Cancel all running tasks."""
        for task in asyncio.all_tasks(self._loop):
            if not task.done():
                task.cancel()

    def _on_hotkey_press(self, key):
        """Handle hotkey presses."""
        try:
            if self.push_to_talk_mode:
                # PTT Mode: F9 gedrückt = senden
                if key == keyboard.Key.f9:
                    self._on_ptt_press()
            else:
                # Toggle Mode: F9 = umschalten
                if key == keyboard.Key.f9:
                    self.toggle_mute()

            if key == keyboard.Key.f10:
                self.request_shutdown()
                return False
        except Exception as e:
            logger.error(f"Hotkey error: {e}")

    def _on_hotkey_release(self, key):
        """Handle hotkey releases (für PTT)."""
        try:
            if self.push_to_talk_mode and key == keyboard.Key.f9:
                self._on_ptt_release()
        except Exception as e:
            logger.error(f"Hotkey release error: {e}")

    def start_hotkey_listener(self):
        """Start the global hotkey listener."""
        self._hotkey_listener = keyboard.Listener(
            on_press=self._on_hotkey_press,
            on_release=self._on_hotkey_release
        )
        self._hotkey_listener.start()
        if self.push_to_talk_mode:
            print("⌨️ Hotkeys: F9 (gedrückt halten) = Push-to-Talk | F10 = Quit")
        else:
            print("⌨️ Hotkeys: F9 = Toggle Mute | F10 = Quit")

    def stop_hotkey_listener(self):
        """Stop the hotkey listener."""
        if self._hotkey_listener:
            self._hotkey_listener.stop()
            self._hotkey_listener = None

    async def listen_audio(self):
        """
        Captures audio from the microphone and puts it in the input queue.

        PROMPT 1: Drop-Policy für Audio
        - Queue ist auf AUDIO_QUEUE_MAX_SIZE begrenzt
        - Bei voller Queue: Drop OLDEST (ältesten Chunk verwerfen)
        - Grund: Neuere Audio-Daten sind relevanter für Echtzeit-Konversation
        """
        while self.running:
            stream = None
            try:
                if self.pya_in:
                    try:
                        self.pya_in.terminate()
                    except:
                        pass
                self.pya_in = pyaudio.PyAudio()

                mic_info = self.pya_in.get_default_input_device_info()
                print(f"🎤 Using input device: {mic_info['name']}")
                logger.info("Microphone listening started")

                stream = await asyncio.to_thread(
                    self.pya_in.open,
                    format=FORMAT,
                    channels=CHANNELS,
                    rate=SEND_SAMPLE_RATE,
                    input=True,
                    input_device_index=mic_info["index"],
                    frames_per_buffer=CHUNK_SIZE,
                )
                print("🎤 Microphone listening...")

                while self.running:
                    data = await asyncio.to_thread(stream.read, CHUNK_SIZE, exception_on_overflow=False)
                    if data and not self.muted:
                        timestamped = TimestampedData(data=data)

                        # PROMPT 1: Drop oldest wenn Queue voll
                        if self.audio_queue_in.full():
                            try:
                                dropped = self.audio_queue_in.get_nowait()
                                self._audio_drop_count += 1
                                logger.warning(
                                    f"⚠️ Audio-Queue voll - DROP OLDEST "
                                    f"(age: {dropped.age_ms:.0f}ms, total drops: {self._audio_drop_count})"
                                )
                            except asyncio.QueueEmpty:
                                pass

                        try:
                            self.audio_queue_in.put_nowait(timestamped)
                        except asyncio.QueueFull:
                            # Sollte nicht passieren nach dem Drop, aber safety first
                            self._audio_drop_count += 1
                            logger.warning(f"⚠️ Audio dropped (Queue still full)")

            except Exception as e:
                logger.error(f"Audio input error: {e}")
                print(f"Audio input error: {e}")
                print("Attempting to reconnect audio input in 2 seconds...")
                await asyncio.sleep(2)
            finally:
                if stream:
                    try:
                        stream.stop_stream()
                        stream.close()
                    except:
                        pass

    async def capture_screen(self):
        """
        Captures screen frames and puts them in the video queue.

        PROMPT 1: Latest-only Policy für Screen
        - Queue-Größe exakt 1
        - Bei neuem Frame: alten Frame verwerfen, nur neuesten behalten
        - Frame-Age wird beim Senden geloggt

        PROMPT 3: Adaptive FPS
        - FPS wird reduziert wenn Latenz zu hoch
        """
        print("🖥️ Screen capturing started...")
        logger.info(f"Screen capturing started (FPS: {self._current_screen_fps})")

        with mss.mss() as sct:
            monitor = sct.monitors[1]
            frame_count = 0

            while self.running:
                start_time = time.time()

                # Capture screen
                sct_img = sct.grab(monitor)
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                img.thumbnail((1024, 1024))

                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='JPEG', quality=80)
                img_bytes = img_byte_arr.getvalue()

                timestamped = TimestampedData(data=img_bytes)

                # PROMPT 1: Latest-only - alten Frame verwerfen
                if self.video_queue_in.full():
                    try:
                        old_frame = self.video_queue_in.get_nowait()
                        self._screen_drop_count += 1
                        logger.debug(
                            f"🖼️ Screen: DROP OLD FRAME "
                            f"(age: {old_frame.age_ms:.0f}ms, total drops: {self._screen_drop_count})"
                        )
                    except asyncio.QueueEmpty:
                        pass

                try:
                    self.video_queue_in.put_nowait(timestamped)
                except asyncio.QueueFull:
                    self._screen_drop_count += 1

                # PROMPT 3: Adaptive FPS basierend auf Screen-Latenz
                frame_count += 1
                if frame_count % 30 == 0:  # Alle 30 Frames prüfen
                    avg_latency = self.latency_stats.avg_screen_ms()
                    if avg_latency > SCREEN_MAX_AGE_MS * 0.8:  # 80% des Budgets
                        # FPS reduzieren
                        self._current_screen_fps = max(SCREEN_FPS_MIN, self._current_screen_fps - 1)
                        logger.warning(
                            f"📉 Screen FPS reduziert auf {self._current_screen_fps} "
                            f"(Latenz: {avg_latency:.0f}ms)"
                        )
                    elif avg_latency < SCREEN_MAX_AGE_MS * 0.3 and self._current_screen_fps < SCREEN_FPS:
                        # FPS erhöhen wenn Latenz gut
                        self._current_screen_fps = min(SCREEN_FPS, self._current_screen_fps + 1)
                        logger.info(f"📈 Screen FPS erhöht auf {self._current_screen_fps}")

                # Control frame rate (mit adaptivem FPS)
                elapsed = time.time() - start_time
                delay = max(0, (1.0 / self._current_screen_fps) - elapsed)
                await asyncio.sleep(delay)

    async def play_audio(self):
        """Plays audio received from the API."""
        while self.running:
            stream = None
            try:
                # Create fresh PyAudio instance to detect current devices
                if self.pya_out:
                    try:
                        self.pya_out.terminate()
                    except:
                        pass
                self.pya_out = pyaudio.PyAudio()

                output_info = self.pya_out.get_default_output_device_info()
                print(f"🔊 Using output device: {output_info['name']}")

                stream = await asyncio.to_thread(
                    self.pya_out.open,
                    format=FORMAT,
                    channels=CHANNELS,
                    rate=RECEIVE_SAMPLE_RATE,
                    output=True,
                    output_device_index=output_info["index"],
                )
                print("🔊 Audio output ready...")
                logger.info("Audio output ready")

                while self.running:
                    bytestream = await self.audio_queue_out.get()
                    logger.debug(f"Playing audio response: {len(bytestream)} bytes")
                    await asyncio.to_thread(stream.write, bytestream)
                    self.audio_queue_out.task_done()

            except Exception as e:
                logger.error(f"Audio output error: {e}")
                print(f"Audio output error: {e}")
                print("Attempting to reconnect audio output in 2 seconds...")
                await asyncio.sleep(2)
            finally:
                if stream:
                    try:
                        stream.stop_stream()
                        stream.close()
                    except:
                        pass

    async def send_to_api(self, session):
        """
        Sends audio and video data to the Live API session.

        PROMPT 2: Turn-Management
        - Prüft auf Turn-Ende Signal und sendet end_of_turn
        - Audio hat Priorität vor Screen (PROMPT 3)

        PROMPT 3: Latenz-Budgets
        - Audio älter als AUDIO_MAX_BACKLOG_MS wird gedroppt
        - Screen älter als SCREEN_MAX_AGE_MS wird gedroppt
        """
        self._session_ref = session
        stats_log_counter = 0

        while self.running:
            # PROMPT 2: Turn-Ende verarbeiten
            # Sende Stille-Chunks um VAD zu helfen das Ende zu erkennen
            if self._turn_end_requested.is_set():
                self._turn_end_requested.clear()
                logger.info(f"📤 Turn {self._current_turn_id} beendet - sende Stille für VAD")

            # Stille-Chunks senden (hilft VAD das Ende zu erkennen)
            if self._silence_chunks_to_send > 0:
                # Erzeuge Stille (Nullen)
                silence_data = bytes(CHUNK_SIZE * 2)  # 16-bit = 2 bytes pro Sample
                await session.send_realtime_input(
                    audio={"data": silence_data, "mime_type": "audio/pcm"}
                )
                self._silence_chunks_to_send -= 1
                if self._silence_chunks_to_send == 0:
                    logger.info("✅ Stille gesendet - VAD sollte Turn-Ende erkennen")

            # PROMPT 3: Audio hat Priorität - alle Audio-Chunks zuerst
            audio_sent = 0
            while not self.audio_queue_in.empty():
                try:
                    timestamped: TimestampedData = self.audio_queue_in.get_nowait()

                    # PROMPT 3: Latenz-Budget prüfen
                    if timestamped.age_ms > AUDIO_MAX_BACKLOG_MS:
                        self._audio_drop_count += 1
                        logger.warning(
                            f"⚠️ Audio DROP (age: {timestamped.age_ms:.0f}ms > {AUDIO_MAX_BACKLOG_MS}ms budget)"
                        )
                        continue

                    await session.send_realtime_input(
                        audio={"data": timestamped.data, "mime_type": "audio/pcm"}
                    )
                    self.latency_stats.add_audio_latency(timestamped.age_ms)
                    audio_sent += 1
                    self._audio_chunks_sent_this_turn += 1

                except asyncio.QueueEmpty:
                    break

            # Screen-Frames senden (niedrigere Priorität)
            # Option: Nur während aktivem Turn senden, um Kontext-Pollution zu vermeiden
            should_send_screen = True
            if SCREEN_SEND_ONLY_DURING_TURN:
                # Nur senden wenn User gerade spricht (nicht gemutet)
                should_send_screen = not self.muted

            if not self.video_queue_in.empty():
                try:
                    timestamped: TimestampedData = self.video_queue_in.get_nowait()
                    frame_age = timestamped.age_ms

                    if not should_send_screen:
                        # Frame verwerfen wenn nicht während Turn (kein Log - zu spammy)
                        pass
                    elif frame_age > SCREEN_MAX_AGE_MS:
                        self._screen_drop_count += 1
                        logger.warning(
                            f"⚠️ Screen DROP (age: {frame_age:.0f}ms > {SCREEN_MAX_AGE_MS}ms budget)"
                        )
                    else:
                        await session.send_realtime_input(
                            media={"data": timestamped.data, "mime_type": "image/jpeg"}
                        )
                        self.latency_stats.add_screen_latency(frame_age)
                        logger.info(f"🖼️ FRAME SENT - age: {frame_age:.0f}ms")

                except asyncio.QueueEmpty:
                    pass

            # PROMPT 3: Periodisch Statistiken loggen
            stats_log_counter += 1
            if stats_log_counter >= 500:  # Alle ~5 Sekunden
                self.latency_stats.log_stats()
                logger.info(f"📊 Drops - Audio: {self._audio_drop_count}, Screen: {self._screen_drop_count}")
                stats_log_counter = 0

            await asyncio.sleep(0.01)

    async def receive_from_api(self, session):
        """
        Receives responses from the Live API session.
        """
        logger.info("📥 Receive-Loop gestartet...")
        response_count = 0

        while self.running:
            try:
                async for response in session.receive():
                    response_count += 1
                    self._last_response_time = time.time()

                    # Log JEDE Response für Debugging
                    logger.info(f"📥 Response #{response_count} empfangen")

                    if response.server_content is None:
                        logger.info("   (server_content ist None)")
                        continue

                    # Log was in server_content ist
                    sc = response.server_content
                    logger.info(f"   server_content: model_turn={sc.model_turn is not None}, "
                               f"turn_complete={getattr(sc, 'turn_complete', 'N/A')}")

                    if sc.model_turn is not None:
                        # Response-Latenz messen
                        if self._last_turn_end_time > 0:
                            response_latency = (time.time() - self._last_turn_end_time) * 1000
                            self.latency_stats.add_response_latency(response_latency)
                            logger.info(f"🎯 Erste Response nach {response_latency:.0f}ms")
                            self._last_turn_end_time = 0

                        for part in sc.model_turn.parts:
                            if part.inline_data is not None:
                                data_len = len(part.inline_data.data)
                                logger.info(f"🔊 Audio-Response: {data_len} bytes")
                                self.audio_queue_out.put_nowait(part.inline_data.data)
                            elif hasattr(part, 'text') and part.text:
                                logger.info(f"📝 Text: {part.text[:100]}...")

                    if getattr(sc, 'turn_complete', False):
                        logger.info(f"✅ Model Turn abgeschlossen")
                        self._last_turn_end_time = 0

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Receive error: {e}")
                import traceback
                traceback.print_exc()
                break

        logger.info(f"📥 Receive-Loop beendet ({response_count} Responses empfangen)")

    async def stall_detector(self):
        """
        PROMPT 3: Erkennt "stalled" Sessions und initiiert Reconnect.

        Prüft periodisch ob nach Turn-Ende eine Antwort kam.
        _last_turn_end_time > 0 bedeutet: Wir warten auf eine Antwort.
        _last_turn_end_time == 0 bedeutet: Kein aktiver Turn oder Antwort erhalten.
        """
        while self.running:
            await asyncio.sleep(2)

            # Nur prüfen wenn wir tatsächlich auf eine Antwort warten
            if self._last_turn_end_time > 0 and self._current_turn_id is not None:
                wait_time = time.time() - self._last_turn_end_time

                if wait_time > STALL_TIMEOUT_S:
                    logger.warning(
                        f"⚠️ Warte auf Antwort: {wait_time:.1f}s seit Turn {self._current_turn_id}"
                    )

                # Nur nach 2x Timeout wirklich reconnecten
                if wait_time > STALL_TIMEOUT_S * 2:
                    logger.error(f"🚨 STALL DETECTED nach {wait_time:.1f}s")
                    self.latency_stats.log_stats()
                    raise Exception(f"Session stalled after {wait_time:.1f}s")

    async def run(self):
        """
        Hauptloop mit Reconnect-Logik.

        PROMPT 3: Bei Stall wird Session neu aufgebaut.
        """
        self._loop = asyncio.get_running_loop()
        self.start_hotkey_listener()

        config = LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=SpeechConfig(
                voice_config=VoiceConfig(
                    prebuilt_voice_config=PrebuiltVoiceConfig(
                        voice_name="Puck"
                    )
                )
            ),
            system_instruction=Content(parts=[Part(text="""You are a helpful and patient digital guide for users unfamiliar with software.

CRITICAL RULE - SCREEN CONTEXT:
- You receive a continuous stream of screen captures.
- ALWAYS describe and reference ONLY the MOST RECENT screen image you received.
- NEVER reference or describe older screens from earlier in the conversation.
- If the screen has changed, immediately focus on the NEW content only.
- Treat each new screen capture as the CURRENT state - previous captures are outdated and irrelevant.

Your task:
1. Observe ONLY the most recent screen to understand current context.
2. Listen to the user's voice to understand their goal.
3. Provide clear, step-by-step verbal instructions based on what you see RIGHT NOW.
4. Be specific about location and color (e.g., 'Click the orange Buy Now button on the right').
5. If the user asks about something not visible on the CURRENT screen, say so.
6. Maintain a calm, encouraging, and polite tone.

Remember: The screen you see is a LIVE feed. Only the latest frame matters.""")])
        )

        reconnect_count = 0
        max_reconnects = 5

        while self.running and reconnect_count < max_reconnects:
            print(f"\n{'=' * 50}")
            print(f"Connecting to Gemini Live API... (Attempt {reconnect_count + 1})")
            print(f"{'=' * 50}")

            try:
                async with self.client.aio.live.connect(model=MODEL, config=config) as session:
                    if reconnect_count > 0:
                        print(f"🔄 Reconnected successfully after {reconnect_count} attempts")
                    print("✅ Connected! Start talking and showing your screen.")
                    if self.push_to_talk_mode:
                        print("📢 Push-to-Talk Modus: Halte F9 gedrückt zum Sprechen")
                    else:
                        print("📢 Toggle Modus: F9 zum Muten/Unmuten (startet gemutet)")

                    reconnect_count = 0  # Reset bei erfolgreicher Verbindung

                    # Reset ALL state für neue Session
                    self._last_turn_end_time = 0
                    self._last_response_time = time.time()
                    self._current_turn_id = None
                    self._ptt_active.clear()
                    self._muted.set()  # Startet gemutet
                    self._turn_end_requested.clear()
                    self._silence_chunks_to_send = 0
                    self._audio_chunks_sent_this_turn = 0
                    # Queues leeren
                    self._clear_audio_queue()
                    self._clear_video_queue()

                    # Start concurrent tasks inkl. Stall-Detector
                    tasks = [
                        asyncio.create_task(self.listen_audio(), name="listen_audio"),
                        asyncio.create_task(self.capture_screen(), name="capture_screen"),
                        asyncio.create_task(self.play_audio(), name="play_audio"),
                        asyncio.create_task(self.send_to_api(session), name="send_to_api"),
                        asyncio.create_task(self.receive_from_api(session), name="receive_from_api"),
                        asyncio.create_task(self.stall_detector(), name="stall_detector"),
                    ]

                    try:
                        await asyncio.gather(*tasks)
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        logger.error(f"Session error: {e}")
                        traceback.print_exc()
                    finally:
                        for task in tasks:
                            task.cancel()
                        await asyncio.gather(*tasks, return_exceptions=True)

            except Exception as e:
                reconnect_count += 1
                logger.error(f"Connection failed: {e}")
                if reconnect_count < max_reconnects:
                    wait_time = min(30, 2 ** reconnect_count)  # Exponential backoff
                    logger.info(f"🔄 Reconnecting in {wait_time}s... ({reconnect_count}/{max_reconnects})")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"❌ Max reconnect attempts ({max_reconnects}) reached. Giving up.")
                    break

        # Cleanup
        self.stop_hotkey_listener()
        if self.pya_in:
            try:
                self.pya_in.terminate()
            except:
                pass
        if self.pya_out:
            try:
                self.pya_out.terminate()
            except:
                pass

        # Finale Statistiken
        print("\n" + "=" * 50)
        print("📊 FINALE STATISTIKEN")
        print("=" * 50)
        self.latency_stats.log_stats()
        print(f"Audio Drops: {self._audio_drop_count}")
        print(f"Screen Drops: {self._screen_drop_count}")
        print("👋 Cleanup complete. Goodbye!")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Gemini Live API Client mit Screen + Mic Streaming")
    parser.add_argument(
        "--ptt", "--push-to-talk",
        action="store_true",
        dest="push_to_talk",
        help="Push-to-Talk Modus: F9 gedrückt halten zum Sprechen (Standard: Toggle-Mute)"
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("🚀 GEMINI LIVE CLIENT - Optimiert für Low-Latency")
    print("=" * 60)
    print(f"📊 Konfiguration:")
    print(f"   Audio Queue Max: {AUDIO_QUEUE_MAX_SIZE} Chunks")
    print(f"   Audio Max Backlog: {AUDIO_MAX_BACKLOG_MS}ms")
    print(f"   Screen Queue: Latest-only (Size: {SCREEN_QUEUE_SIZE})")
    print(f"   Screen Max Age: {SCREEN_MAX_AGE_MS}ms")
    print(f"   Screen FPS: {SCREEN_FPS} (min: {SCREEN_FPS_MIN})")
    print(f"   Screen nur während Turn: {SCREEN_SEND_ONLY_DURING_TURN}")
    print(f"   Stall Timeout: {STALL_TIMEOUT_S}s")
    print(f"   Modus: {'Push-to-Talk' if args.push_to_talk else 'Toggle-Mute'}")
    print("=" * 60 + "\n")

    client = GeminiLiveClient(push_to_talk_mode=args.push_to_talk)
    try:
        asyncio.run(client.run())
    except KeyboardInterrupt:
        print("\nStopping...")
