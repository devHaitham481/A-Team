/**
 * preload.ts
 * Exposes safe IPC methods to renderer. Placeholder for now.
 */

import { contextBridge } from 'electron';

// Will add IPC methods in future steps
contextBridge.exposeInMainWorld('visionflow', {
  // Placeholder - recording functions will go here
  ping: () => 'pong'
});
