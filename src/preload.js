const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  send: (channel, data) => {
    // Whitelist channels for security
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Receive messages from main process
  receive: (channel, callback) => {
    const validChannels = ['fromMain', 'toggle-record', 'toggle-live', 'toggle-askai'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Invoke main process and wait for response
  invoke: async (channel, data) => {
    const validChannels = ['invoke'];
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
  },

  // Remove listener
  removeListener: (channel, callback) => {
    const validChannels = ['fromMain', 'toggle-record', 'toggle-live'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },

  // Get screen sources for recording/streaming
  getSources: () => ipcRenderer.invoke('get-sources'),

  // Check screen capture permission (macOS)
  checkScreenCapturePermission: () => ipcRenderer.invoke('check-screen-capture-permission'),

  // Transcribe audio/video via Gemini
  transcribe: (base64Data, mimeType) => ipcRenderer.invoke('transcribe', { base64Data, mimeType }),

  // Copy text to clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

  // Save video and copy to clipboard
  saveAndCopyVideo: (data, mimeType) => ipcRenderer.invoke('save-and-copy-video', { data, mimeType }),

  // Show overlay window with AI response
  showOverlay: (data) => ipcRenderer.invoke('show-overlay', data),

  // Gemini Live API controls
  startGeminiLive: (options) => ipcRenderer.invoke('start-gemini-live', options),
  stopGeminiLive: () => ipcRenderer.invoke('stop-gemini-live'),
  getGeminiLiveStatus: () => ipcRenderer.invoke('get-gemini-live-status'),
  toggleGeminiLiveMute: () => ipcRenderer.invoke('toggle-gemini-live-mute'),
});
