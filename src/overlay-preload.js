const { contextBridge, ipcRenderer } = require('electron');

// Expose overlay-specific methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Close overlay window
  closeOverlay: () => ipcRenderer.send('close-overlay'),

  // Listen for content updates
  onOverlayContent: (callback) => {
    ipcRenderer.on('overlay-content', (event, data) => callback(data));
  }
});
