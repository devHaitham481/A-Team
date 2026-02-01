import subprocess
import os
import datetime
import signal
import sys

def get_downloads_folder():
    """Returns the path to the user's Downloads folder."""
    return os.path.join(os.path.expanduser("~"), "Downloads")

def record_screen_and_audio():
    # Define filenames
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"screen_recording_{timestamp}.mp4"
    output_path = os.path.join(get_downloads_folder(), filename)

    # Device indices based on your system:
    # Video: [4] Capture screen 0
    # Audio: [1] MacBook Air-Mikrofon
    # Input format "video_device_index:audio_device_index" -> "4:1"
    input_device = "4:1"

    print(f"Preparing to record to: {output_path}")
    print("Press Ctrl+C to stop recording.")

    # FFmpeg command
    # -f avfoundation: use macOS AVFoundation framework
    # -i "4:1": Input devices (Screen:Mic)
    # -r 30: Frame rate
    # -c:v libx264: Video codec (H.264)
    # -preset ultrafast: Low CPU usage for recording
    # -c:a aac: Audio codec
    # -pix_fmt yuv420p: Pixel format for compatibility
    command = [
        "ffmpeg",
        "-f", "avfoundation",
        "-i", input_device,
        "-r", "30",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        "-y", # Overwrite if exists (though timestamp prevents this)
        output_path
    ]

    try:
        # Run ffmpeg
        process = subprocess.Popen(command)
        
        # Wait for user to stop
        process.wait()
    except KeyboardInterrupt:
        print("\nStopping recording...")
        # Send 'q' to ffmpeg to stop gracefully if possible, or simple kill
        # ffmpeg usually handles SIGINT (Ctrl+C) by stopping gracefully
        process.send_signal(signal.SIGINT)
        process.wait()
        print(f"\nRecording saved to: {output_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    record_screen_and_audio()
