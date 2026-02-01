/**
 * preload.ts
 * Exposes safe IPC methods to renderer for recording functionality.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

contextBridge.exposeInMainWorld('visionflow', {
  // Get available screen sources
  getSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('get-sources'),

  // Send recording data to main process
  sendRecording: (data: { size: number; type: string; data: number[] }): void => {
    ipcRenderer.send('recording-complete', data);
  },

  // Request start recording (from button click)
  startRecording: (): void => {
    ipcRenderer.send('start-recording');
  },

  // Request stop recording (from button click)
  stopRecording: (): void => {
    ipcRenderer.send('stop-recording');
  },

  // Update recording state
  updateState: (state: string): void => {
    ipcRenderer.send('recording-state-update', state);
  },

  // Listen for recording state changes (from hotkey or main process)
  onRecordingState: (callback: (isRecording: boolean) => void): void => {
    ipcRenderer.on('recording-state', (_event, isRecording: boolean) => callback(isRecording));
  },

  // Listen for state updates from main process
  onStateUpdate: (callback: (state: string) => void): void => {
    ipcRenderer.on('state-update', (_event, state: string) => callback(state));
  },

  // Listen for processing complete
  onProcessingComplete: (callback: () => void): void => {
    ipcRenderer.on('processing-complete', () => callback());
  }
});
