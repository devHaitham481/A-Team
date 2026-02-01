/**
 * main.ts
 * Electron main process - creates window, handles IPC for recording.
 */

import { app, BrowserWindow, desktopCapturer, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let selectedSourceId: string | null = null;

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

  // Enable dev tools for debugging
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Set up display media handler BEFORE creating window
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    console.log('Display media requested, selectedSourceId:', selectedSourceId);

    if (!selectedSourceId) {
      console.error('No source selected');
      callback({});
      return;
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window']
      });

      const source = sources.find(s => s.id === selectedSourceId);

      if (source) {
        console.log('Found source:', source.name);
        console.log('Calling callback with video source...');
        callback({ video: source });
        console.log('Callback called successfully');
      } else {
        console.error('Source not found:', selectedSourceId);
        callback({});
      }
    } catch (error) {
      console.error('Error getting sources:', error);
      callback({});
    }
  });

  createWindow();
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

// IPC Handlers

// Set the selected source for recording
ipcMain.handle('set-source', async (_event, sourceId: string) => {
  console.log('Setting source:', sourceId);
  selectedSourceId = sourceId;
  return true;
});

// Get available screen/window sources for recording
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

// Save recording to disk
ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer) => {
  const documentsPath = app.getPath('documents');
  const visionflowDir = path.join(documentsPath, 'VisionFlow');

  // Create directory if it doesn't exist
  if (!fs.existsSync(visionflowDir)) {
    fs.mkdirSync(visionflowDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `recording-${timestamp}.webm`;
  const filepath = path.join(visionflowDir, filename);

  fs.writeFileSync(filepath, Buffer.from(buffer));

  return filepath;
});
