const { contextBridge, ipcRenderer } = require('electron');

// Expose overlay-specific methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Close overlay window
  closeOverlay: () => ipcRenderer.send('close-overlay'),

  // Listen for content updates
  onOverlayContent: (callback) => {
    ipcRenderer.on('overlay-content', (event, data) => callback(data));
  },

  // Start reply recording
  startReply: () => ipcRenderer.send('start-reply'),

  // Stop reply recording
  stopReply: () => ipcRenderer.send('stop-reply'),

  // Listen for reply state changes
  onReplyStateChange: (callback) => {
    ipcRenderer.on('reply-state-change', (event, state) => callback(state));
  }
});
