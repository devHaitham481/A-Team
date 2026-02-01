/**
 * renderer.ts
 * Handles UI state transitions and actual recording logic for VisionFlow.
 */

// Declare the visionflow API exposed by preload
interface VisionFlowAPI {
  getSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
  sendRecording: (data: { size: number; type: string; data: number[] }) => void;
  startRecording: () => void;
  stopRecording: () => void;
  updateState: (state: string) => void;
  onRecordingState: (callback: (isRecording: boolean) => void) => void;
  onStateUpdate: (callback: (state: string) => void) => void;
  onProcessingComplete: (callback: () => void) => void;
}

declare const visionflow: VisionFlowAPI;

type AppState = 'ready' | 'recording' | 'processing' | 'done';

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

class VisionFlowUI {
  private recordBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private statusText: HTMLSpanElement;
  private sourceSelect: HTMLSelectElement;
  private processCheckbox: HTMLInputElement;
  private currentState: AppState = 'ready';

  // Recording state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private selectedSourceId: string | null = null;
  private sources: ScreenSource[] = [];

  constructor() {
    this.recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
    this.stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    this.statusText = document.getElementById('statusText') as HTMLSpanElement;
    this.sourceSelect = document.getElementById('sourceSelect') as HTMLSelectElement;
    this.processCheckbox = document.getElementById('processCheckbox') as HTMLInputElement;

    this.init();
  }

  private async init(): Promise<void> {
    // Set up button handlers
    this.recordBtn.addEventListener('click', () => this.handleRecord());
    this.stopBtn.addEventListener('click', () => this.handleStop());
    this.sourceSelect.addEventListener('change', () => this.handleSourceChange());

    // Load available sources
    await this.loadSources();

    // Listen for recording state changes from main process (hotkey)
    visionflow.onRecordingState((shouldRecord: boolean) => {
      if (shouldRecord && this.currentState === 'ready') {
        this.startRecording();
      } else if (!shouldRecord && this.currentState === 'recording') {
        this.stopRecording();
      }
    });

    // Listen for state updates from main process
    visionflow.onStateUpdate((state: string) => {
      this.setState(state as AppState);
    });

    // Listen for processing complete
    visionflow.onProcessingComplete(() => {
      this.setState('ready');
    });

    console.log('VisionFlow recorder initialized');
  }

  private async loadSources(): Promise<void> {
    try {
      this.sources = await visionflow.getSources();

      // Clear existing options except the placeholder
      while (this.sourceSelect.options.length > 1) {
        this.sourceSelect.remove(1);
      }

      // Add sources to dropdown
      this.sources.forEach((source) => {
        const option = document.createElement('option');
        option.value = source.id;
        option.textContent = source.name;
        this.sourceSelect.appendChild(option);
      });

      // Auto-select first screen if available
      const firstScreen = this.sources.find(s => s.id.startsWith('screen:'));
      if (firstScreen) {
        this.sourceSelect.value = firstScreen.id;
        this.selectedSourceId = firstScreen.id;
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  }

  private setState(state: AppState): void {
    this.currentState = state;
    this.updateUI();
  }

  private updateUI(): void {
    // Reset classes
    this.recordBtn.classList.remove('recording');
    this.statusText.classList.remove('recording', 'processing', 'done');

    switch (this.currentState) {
      case 'ready':
        this.recordBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusText.textContent = 'Ready';
        break;

      case 'recording':
        this.recordBtn.disabled = true;
        this.recordBtn.classList.add('recording');
        this.stopBtn.disabled = false;
        this.statusText.textContent = 'Recording...';
        this.statusText.classList.add('recording');
        break;

      case 'processing':
        this.recordBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.statusText.textContent = 'Processing...';
        this.statusText.classList.add('processing');
        break;

      case 'done':
        this.recordBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusText.textContent = 'Done!';
        this.statusText.classList.add('done');
        break;
    }
  }

  private handleRecord(): void {
    console.log('Record clicked');
    console.log('Selected source:', this.sourceSelect.value);
    console.log('Process before copy:', this.processCheckbox.checked);

    // Request recording start from main process
    visionflow.startRecording();
  }

  private handleStop(): void {
    console.log('Stop clicked');
    // Request recording stop from main process
    visionflow.stopRecording();
  }

  private async startRecording(): Promise<void> {
    try {
      // Get the selected source ID
      const sourceId = this.selectedSourceId || this.sourceSelect.value;

      if (!sourceId || sourceId === '') {
        // If no source selected, use first available screen
        const sources = await visionflow.getSources();
        if (sources.length === 0) {
          console.error('No screen sources available');
          return;
        }
        this.selectedSourceId = sources[0].id;
      }

      // Get screen stream
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: this.selectedSourceId || this.sourceSelect.value
          }
        } as MediaTrackConstraints
      });

      // Get microphone stream
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        });
      } catch (err) {
        console.warn('Could not get microphone access:', err);
      }

      // Combine streams
      const tracks = [...screenStream.getTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }
      const combinedStream = new MediaStream(tracks);

      // Create MediaRecorder
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        console.log('Recording blob size:', blob.size);

        const arrayBuffer = await blob.arrayBuffer();
        visionflow.sendRecording({
          size: blob.size,
          type: blob.type,
          data: Array.from(new Uint8Array(arrayBuffer))
        });

        combinedStream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(1000);
      this.setState('recording');
      console.log('Recording started');

    } catch (err) {
      console.error('Error starting recording:', err);
      this.setState('ready');
      visionflow.updateState('ready');
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      console.log('Recording stopped');
    }
  }

  private handleSourceChange(): void {
    this.selectedSourceId = this.sourceSelect.value;
    console.log('Source changed to:', this.selectedSourceId);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new VisionFlowUI();
});
