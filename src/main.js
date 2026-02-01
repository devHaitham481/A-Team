require('dotenv').config();
const { app, BrowserWindow, screen, globalShortcut, ipcMain, desktopCapturer, clipboard, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const { transcribeAudio } = require('./gemini');

// Gemini Live API server process
let geminiLiveProcess = null;
const GEMINI_LIVE_API_PORT = 8000;
const GEMINI_LIVE_API_URL = `http://localhost:${GEMINI_LIVE_API_PORT}`;

let mainWindow = null;
let overlayWindow = null;
let tray = null;

function createWindow() {
  // Get primary display dimensions for positioning
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height: screenHeight } = primaryDisplay.workAreaSize;

  // Window dimensions for vertical pill (70% of original)
  const windowWidth = 35;
  const windowHeight = 175;

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
    movable: false,
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

// Create overlay window for AI responses
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 370,
    x: 20,
    y: 20,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

// Show overlay with content
function showOverlay(data) {
  const overlay = createOverlayWindow();
  overlay.webContents.once('did-finish-load', () => {
    overlay.webContents.send('overlay-content', data);
  });
  if (overlay.webContents.isLoading()) {
    // Wait for load
  } else {
    overlay.webContents.send('overlay-content', data);
  }
  overlay.show();
}

// Close overlay window
function closeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

// Start the Gemini Live API server
function startGeminiLiveServer() {
  if (geminiLiveProcess) {
    console.log('Gemini Live server already running');
    return true;
  }

  const backendPath = path.join(__dirname, '..', 'mode-3-backend');
  const apiPath = path.join(backendPath, 'api.py');

  console.log('Starting Gemini Live API server...');
  console.log('Backend path:', backendPath);

  try {
    geminiLiveProcess = spawn('python3', ['-m', 'uvicorn', 'api:app', '--host', '0.0.0.0', '--port', String(GEMINI_LIVE_API_PORT)], {
      cwd: backendPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    geminiLiveProcess.stdout.on('data', (data) => {
      console.log(`[Gemini Live] ${data}`);
    });

    geminiLiveProcess.stderr.on('data', (data) => {
      console.log(`[Gemini Live] ${data}`);
    });

    geminiLiveProcess.on('close', (code) => {
      console.log(`Gemini Live server exited with code ${code}`);
      geminiLiveProcess = null;
    });

    geminiLiveProcess.on('error', (err) => {
      console.error('Failed to start Gemini Live server:', err);
      geminiLiveProcess = null;
    });

    return true;
  } catch (error) {
    console.error('Error starting Gemini Live server:', error);
    return false;
  }
}

// Stop the Gemini Live API server
function stopGeminiLiveServer() {
  if (geminiLiveProcess) {
    console.log('Stopping Gemini Live server...');
    geminiLiveProcess.kill('SIGTERM');
    geminiLiveProcess = null;
  }
}

// Create menu bar tray icon
function createTray() {
  // Use an empty 1x1 transparent image and rely on title
  const emptyIcon = nativeImage.createEmpty();

  tray = new Tray(emptyIcon);
  tray.setTitle('◉'); // Show a circle in the menu bar
  tray.setToolTip('DipDip');

  const modifier = process.platform === 'darwin' ? '⌘' : 'Ctrl';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'DipDip',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Hotkeys',
      enabled: false
    },
    {
      label: `Record          ${modifier}+Shift+R`,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toggle-record');
        }
      }
    },
    {
      label: `Live               ${modifier}+Shift+L`,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toggle-live');
        }
      }
    },
    {
      label: `Ask AI            ${modifier}+Shift+A`,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toggle-askai');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show/Hide Pill',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit DipDip',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
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

  // Register toggle Ask AI hotkey: Cmd+Shift+A (macOS) or Ctrl+Shift+A (Windows/Linux)
  globalShortcut.register(`${modifier}+Shift+A`, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-askai');
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

  // Handler for saving video and copying to clipboard
  ipcMain.handle('save-and-copy-video', async (event, { data, mimeType }) => {
    try {
      // Determine file extension from MIME type
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4';

      // Create recordings directory
      const recordingsDir = path.join(app.getPath('userData'), 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `recording-${timestamp}.${ext}`;
      const filepath = path.join(recordingsDir, filename);

      // Save video file
      const buffer = Buffer.from(data);
      fs.writeFileSync(filepath, buffer);
      console.log('Video saved to:', filepath);

      // Copy file to clipboard using AppleScript (reliable macOS method)
      if (process.platform === 'darwin') {
        try {
          execSync(`osascript -e 'set the clipboard to POSIX file "${filepath}"'`);
          console.log('Video copied to clipboard');
        } catch (clipErr) {
          console.error('Clipboard copy failed:', clipErr);
        }
      }

      return { success: true, filepath };
    } catch (error) {
      console.error('Save and copy video error:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for showing overlay with AI response
  ipcMain.handle('show-overlay', async (event, data) => {
    showOverlay(data);
    return { success: true };
  });

  // Handler for closing overlay
  ipcMain.on('close-overlay', () => {
    closeOverlay();
  });

  // Handler for starting Gemini Live session
  ipcMain.handle('start-gemini-live', async (event, { pushToTalk = false } = {}) => {
    try {
      // Start the server if not running
      if (!geminiLiveProcess) {
        startGeminiLiveServer();
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Call the API to start session
      const response = await fetch(`${GEMINI_LIVE_API_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_to_talk: pushToTalk })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start session');
      }

      const result = await response.json();
      console.log('Gemini Live session started:', result.message);
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Error starting Gemini Live:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for stopping Gemini Live session
  ipcMain.handle('stop-gemini-live', async () => {
    try {
      const response = await fetch(`${GEMINI_LIVE_API_URL}/stop`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to stop session');
      }

      const result = await response.json();
      console.log('Gemini Live session stopped:', result.message);
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Error stopping Gemini Live:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for getting Gemini Live status
  ipcMain.handle('get-gemini-live-status', async () => {
    try {
      const response = await fetch(`${GEMINI_LIVE_API_URL}/status`);
      if (!response.ok) {
        return { is_running: false, mode: null };
      }
      return await response.json();
    } catch (error) {
      return { is_running: false, mode: null };
    }
  });

  // Handler for toggling mute in Gemini Live
  ipcMain.handle('toggle-gemini-live-mute', async () => {
    try {
      const response = await fetch(`${GEMINI_LIVE_API_URL}/toggle-mute`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to toggle mute');
      }

      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Error toggling mute:', error);
      return { success: false, error: error.message };
    }
  });
}

// App lifecycle: ready
app.whenReady().then(() => {
  createWindow();
  createTray();
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
  stopGeminiLiveServer();
});
