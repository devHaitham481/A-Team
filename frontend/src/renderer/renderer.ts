/**
 * renderer.ts
 * Handles UI and integrates with ScreenRecorder for actual recording.
 */

import './types';
import { ScreenRecorder } from './recorder';

type AppState = 'ready' | 'recording' | 'processing' | 'done' | 'error';

class VisionFlowUI {
  private recordBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private statusText: HTMLSpanElement;
  private sourceSelect: HTMLSelectElement;
  private processCheckbox: HTMLInputElement;
  private currentState: AppState = 'ready';
  private recorder: ScreenRecorder;
  private lastSavedPath: string | null = null;

  constructor() {
    this.recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
    this.stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    this.statusText = document.getElementById('statusText') as HTMLSpanElement;
    this.sourceSelect = document.getElementById('sourceSelect') as HTMLSelectElement;
    this.processCheckbox = document.getElementById('processCheckbox') as HTMLInputElement;
    this.recorder = new ScreenRecorder();

    this.init();
  }

  private async init(): Promise<void> {
    this.recordBtn.addEventListener('click', () => this.handleRecord());
    this.stopBtn.addEventListener('click', () => this.handleStop());

    // Load available sources on startup
    await this.loadSources();
  }

  private async loadSources(): Promise<void> {
    try {
      const sources = await window.visionflow.getSources();

      // Clear existing options except the placeholder
      this.sourceSelect.innerHTML = '<option value="" disabled selected>Select screen/window...</option>';

      // Add screen sources first
      const screens = sources.filter(s => s.id.startsWith('screen:'));
      const windows = sources.filter(s => s.id.startsWith('window:'));

      if (screens.length > 0) {
        const screenGroup = document.createElement('optgroup');
        screenGroup.label = 'Screens';
        screens.forEach(source => {
          const option = document.createElement('option');
          option.value = source.id;
          option.textContent = source.name;
          screenGroup.appendChild(option);
        });
        this.sourceSelect.appendChild(screenGroup);
      }

      if (windows.length > 0) {
        const windowGroup = document.createElement('optgroup');
        windowGroup.label = 'Windows';
        windows.forEach(source => {
          const option = document.createElement('option');
          option.value = source.id;
          option.textContent = source.name;
          windowGroup.appendChild(option);
        });
        this.sourceSelect.appendChild(windowGroup);
      }

      console.log(`Loaded ${sources.length} sources`);
    } catch (error) {
      console.error('Failed to load sources:', error);
      this.setStatus('error', 'Failed to load sources');
    }
  }

  private setState(state: AppState): void {
    this.currentState = state;
    this.updateUI();
  }

  private setStatus(state: AppState, message?: string): void {
    this.currentState = state;
    if (message) {
      this.statusText.textContent = message;
    }
    this.updateUI();
  }

  private updateUI(): void {
    // Reset classes
    this.recordBtn.classList.remove('recording');
    this.statusText.classList.remove('recording', 'processing', 'done', 'error');

    switch (this.currentState) {
      case 'ready':
        this.recordBtn.disabled = !this.sourceSelect.value;
        this.stopBtn.disabled = true;
        this.sourceSelect.disabled = false;
        if (!this.statusText.textContent?.startsWith('Saved')) {
          this.statusText.textContent = 'Ready';
        }
        break;

      case 'recording':
        this.recordBtn.disabled = true;
        this.recordBtn.classList.add('recording');
        this.stopBtn.disabled = false;
        this.sourceSelect.disabled = true;
        this.statusText.textContent = 'Recording...';
        this.statusText.classList.add('recording');
        break;

      case 'processing':
        this.recordBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.sourceSelect.disabled = true;
        this.statusText.textContent = 'Saving...';
        this.statusText.classList.add('processing');
        break;

      case 'done':
        this.recordBtn.disabled = !this.sourceSelect.value;
        this.stopBtn.disabled = true;
        this.sourceSelect.disabled = false;
        this.statusText.classList.add('done');
        break;

      case 'error':
        this.recordBtn.disabled = !this.sourceSelect.value;
        this.stopBtn.disabled = true;
        this.sourceSelect.disabled = false;
        this.statusText.classList.add('error');
        break;
    }
  }

  private async handleRecord(): Promise<void> {
    const sourceId = this.sourceSelect.value;
    if (!sourceId) {
      this.setStatus('error', 'Please select a source');
      return;
    }

    try {
      console.log('Starting recording for source:', sourceId);
      await this.recorder.startRecording(sourceId);
      this.setState('recording');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.setStatus('error', 'Failed to start recording');
    }
  }

  private async handleStop(): Promise<void> {
    try {
      this.setState('processing');

      // Stop recording and get the blob
      const blob = await this.recorder.stopRecording();
      console.log('Recording blob size:', blob.size);

      // Convert blob to ArrayBuffer for IPC
      const buffer = await blob.arrayBuffer();

      // Save to disk via main process
      const filepath = await window.visionflow.saveRecording(buffer);
      this.lastSavedPath = filepath;

      console.log('Recording saved to:', filepath);
      this.setStatus('done', `Saved: ${filepath.split('/').pop()}`);

      // Reset to ready after a delay
      setTimeout(() => {
        this.setState('ready');
      }, 3000);

    } catch (error) {
      console.error('Failed to save recording:', error);
      this.setStatus('error', 'Failed to save recording');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new VisionFlowUI();
});
