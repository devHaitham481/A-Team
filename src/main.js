require('dotenv').config();
const { app, BrowserWindow, screen, globalShortcut, ipcMain, desktopCapturer, clipboard } = require('electron');
const path = require('path');
const { transcribeAudio } = require('./gemini');

let mainWindow = null;

function createWindow() {
  // Get primary display dimensions for positioning
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height: screenHeight } = primaryDisplay.workAreaSize;

  // Window dimensions for vertical pill
  const windowWidth = 50;
  const windowHeight = 180;

  // Position: left edge, vertically centered
  const xPosition = 0;
  const yPosition = Math.round((screenHeight - windowHeight) / 2);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: xPosition,
    y: yPosition,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Set always on top with screen-saver level (highest priority)
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Make window visible on all workspaces/desktops
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Prevent window from being hidden when app loses focus
  mainWindow.setIgnoreMouseEvents(false);

  // Load the renderer HTML
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register global hotkeys
function registerGlobalShortcuts() {
  // Determine modifier based on platform (Cmd for macOS, Ctrl for Windows/Linux)
  const modifier = process.platform === 'darwin' ? 'CommandOrControl' : 'Control';

  // Register toggle record hotkey: Cmd+Shift+R (macOS) or Ctrl+Shift+R (Windows/Linux)
  globalShortcut.register(`${modifier}+Shift+R`, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-record');
    }
  });

  // Register toggle live hotkey: Cmd+Shift+L (macOS) or Ctrl+Shift+L (Windows/Linux)
  globalShortcut.register(`${modifier}+Shift+L`, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-live');
    }
  });
}

// Set up IPC handlers for renderer requests
function setupIpcHandlers() {
  // Handler for getting screen capture sources
  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  });

  // Handler for getting screen sources (screens only, for recording/streaming)
  ipcMain.handle('get-screen-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources;
  });

  // Handler for checking/requesting screen capture permissions (macOS)
  ipcMain.handle('check-screen-capture-permission', async () => {
    if (process.platform === 'darwin') {
      const { systemPreferences } = require('electron');
      // Check if screen capture is allowed
      const status = systemPreferences.getMediaAccessStatus('screen');
      return status;
    }
    // On other platforms, assume permission is granted
    return 'granted';
  });

  // Handler for transcribing audio/video via Gemini
  ipcMain.handle('transcribe', async (event, { base64Data, mimeType }) => {
    try {
      console.log('Transcribe called with mimeType:', mimeType);
      console.log('Base64 data length:', base64Data?.length);
      console.log('Base64 data preview:', base64Data?.substring(0, 100));
      const text = await transcribeAudio(base64Data, mimeType);
      return { success: true, text };
    } catch (error) {
      console.error('Transcription error:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for copying text to clipboard
  ipcMain.handle('copy-to-clipboard', async (event, text) => {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      console.error('Clipboard error:', error);
      return { success: false, error: error.message };
    }
  });
}

// App lifecycle: ready
app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();
  setupIpcHandlers();

  // macOS: re-create window when dock icon clicked and no windows exist
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Unregister all shortcuts when app is about to quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
