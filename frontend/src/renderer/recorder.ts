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
      console.log('Starting recording with sourceId:', sourceId);

      // Tell main process which source we want
      console.log('Setting source in main process...');
      await window.visionflow.setSource(sourceId);

      // Get screen stream using getDisplayMedia (intercepted by main process handler)
      console.log('Requesting screen stream via getDisplayMedia...');
      try {
        const displayMediaPromise = navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        // Add timeout to detect if promise never resolves
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('getDisplayMedia timed out after 10s')), 10000);
        });

        this.screenStream = await Promise.race([displayMediaPromise, timeoutPromise]);
        console.log('Screen stream obtained:', this.screenStream.getVideoTracks().length, 'video tracks');
      } catch (displayError) {
        console.error('getDisplayMedia failed:', displayError);
        console.error('Error type:', (displayError as Error).name);
        console.error('Error message:', (displayError as Error).message);
        throw displayError;
      }

      // Get microphone stream
      console.log('Requesting microphone stream...');
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      console.log('Microphone stream obtained:', this.micStream.getAudioTracks().length, 'audio tracks');

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
      console.error('Recording error:', error);
      console.error('Error name:', (error as Error).name);
      console.error('Error message:', (error as Error).message);
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
