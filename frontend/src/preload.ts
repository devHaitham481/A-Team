/**
 * preload.ts
 * Exposes safe IPC methods to renderer for screen recording.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface SourceInfo {
  id: string;
  name: string;
  thumbnail: string;
}

contextBridge.exposeInMainWorld('visionflow', {
  // Get available screens/windows for recording
  getSources: (): Promise<SourceInfo[]> => ipcRenderer.invoke('get-sources'),

  // Save recording buffer to disk, returns filepath
  saveRecording: (buffer: ArrayBuffer): Promise<string> =>
    ipcRenderer.invoke('save-recording', buffer),
});
