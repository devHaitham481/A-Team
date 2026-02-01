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

  // Set the selected source for recording (must call before startRecording)
  setSource: (sourceId: string): Promise<boolean> =>
    ipcRenderer.invoke('set-source', sourceId),

  // Save recording buffer to disk, returns filepath
  saveRecording: (buffer: ArrayBuffer): Promise<string> =>
    ipcRenderer.invoke('save-recording', buffer),
});
