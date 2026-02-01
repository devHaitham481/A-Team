/**
 * main.ts
 * Electron main process - handles recording control, IPC, and global hotkeys.
 */

import { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, Notification, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { uIOhook, UiohookKey } from 'uiohook-napi';

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let isRecording = false;
let recordingState: 'ready' | 'recording' | 'processing' | 'done' = 'ready';
let holdToRecordActive = false;

// Track pressed keys for hold-to-record
const pressedKeys = new Set<number>();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 350,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Uncomment for debugging:
  // mainWindow.webContents.openDevTools();
}

function setupHoldToRecord(): void {
  const OPTION_LEFT = UiohookKey.Alt;
  const OPTION_RIGHT = UiohookKey.AltRight;
  const KEY_D = UiohookKey.D;

  uIOhook.on('keydown', (e) => {
    pressedKeys.add(e.keycode);

    // Check if Option + D is pressed
    const optionPressed = pressedKeys.has(OPTION_LEFT) || pressedKeys.has(OPTION_RIGHT);
    const dPressed = pressedKeys.has(KEY_D);

    if (optionPressed && dPressed && !isRecording && recordingState === 'ready') {
      holdToRecordActive = true;
      startRecording();
    }
  });

  uIOhook.on('keyup', (e) => {
    pressedKeys.delete(e.keycode);

    // Stop recording when Option or D is released (if hold-to-record is active)
    if (holdToRecordActive && isRecording) {
      const optionPressed = pressedKeys.has(OPTION_LEFT) || pressedKeys.has(OPTION_RIGHT);
      const dPressed = pressedKeys.has(KEY_D);

      if (!optionPressed || !dPressed) {
        holdToRecordActive = false;
        stopRecording();
      }
    }
  });

  uIOhook.start();
}

function startRecording(): void {
  if (recordingState === 'processing') return;
  if (isRecording) return;

  isRecording = true;
  recordingState = 'recording';
  mainWindow?.webContents.send('recording-state', true);
  console.log('Recording started');
}

function stopRecording(): void {
  if (!isRecording) return;

  isRecording = false;
  mainWindow?.webContents.send('recording-state', false);
  console.log('Recording stopped');
}

// Get screen sources for recording
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 150, height: 150 }
  });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

// Handle recording state update from renderer
ipcMain.on('recording-state-update', (_event, state: string) => {
  recordingState = state as 'ready' | 'recording' | 'processing' | 'done';
  if (state === 'ready') {
    isRecording = false;
  }
});

// Handle start recording request from renderer (button click)
ipcMain.on('start-recording', () => {
  startRecording();
});

// Handle stop recording request from renderer (button click)
ipcMain.on('stop-recording', () => {
  stopRecording();
});

// Handle recording complete
ipcMain.on('recording-complete', (_event, data: { size: number; type: string; data: number[] }) => {
  console.log('Recording complete, size:', data.size, 'bytes');
  recordingState = 'processing';
  mainWindow?.webContents.send('state-update', 'processing');

  // Save recording to disk
  const recordingsDir = path.join(__dirname, '..', 'recordings');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `recording-${timestamp}.webm`;
  const filepath = path.join(recordingsDir, filename);

  const buffer = Buffer.from(data.data);
  fs.writeFileSync(filepath, buffer);
  console.log('Recording saved to:', filepath);

  // Copy video file to clipboard for easy pasting into LLMs
  const fileUrl = `file://${filepath}`;
  clipboard.writeBuffer('public.file-url', Buffer.from(fileUrl));
  console.log('Video copied to clipboard:', filepath);

  new Notification({
    title: 'VisionFlow',
    body: `Recording copied to clipboard`
  }).show();

  // Show done state briefly, then back to ready
  recordingState = 'done';
  mainWindow?.webContents.send('state-update', 'done');
  setTimeout(() => {
    recordingState = 'ready';
    mainWindow?.webContents.send('processing-complete');
  }, 2000);
});

// Check permissions on macOS
async function checkPermissions(): Promise<void> {
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    const screenStatus = systemPreferences.getMediaAccessStatus('screen');

    console.log('Microphone permission:', micStatus);
    console.log('Screen permission:', screenStatus);

    if (micStatus !== 'granted') {
      await systemPreferences.askForMediaAccess('microphone');
    }

    if (screenStatus !== 'granted') {
      console.log('Please grant screen recording permission in System Preferences > Privacy & Security > Screen Recording');
    }
  }
}

app.whenReady().then(async () => {
  await checkPermissions();
  createWindow();
  setupHoldToRecord();

  console.log('VisionFlow ready - Hold Option+D to record or use UI buttons');
});

app.on('will-quit', () => {
  uIOhook.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
