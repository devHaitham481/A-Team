/**
 * ScreenRecorder class
 * Handles screen + microphone capture using Electron's desktopCapturer
 */

import './types';

export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private screenStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;

  /**
   * Start recording the specified source with microphone audio
   */
  async startRecording(sourceId: string): Promise<void> {
    try {
      // Get screen stream using the source ID from desktopCapturer
      this.screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-ignore - Electron-specific constraints
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          }
        }
      });

      // Get microphone stream
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // Combine video from screen and audio from microphone
      const combinedStream = new MediaStream([
        ...this.screenStream.getVideoTracks(),
        ...this.micStream.getAudioTracks()
      ]);

      // Create MediaRecorder with webm format
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second

      console.log('Recording started');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording and return the video blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.cleanup();
        console.log('Recording stopped, blob size:', blob.size);
        resolve(blob);
      };

      this.mediaRecorder.onerror = (event) => {
        this.cleanup();
        reject(new Error('MediaRecorder error'));
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Clean up streams and recorder
   */
  private cleanup(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    this.mediaRecorder = null;
    this.recordedChunks = [];
  }
}
