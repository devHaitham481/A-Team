/**
 * main.ts
 * Electron main process - creates window, handles IPC for recording.
 */

import { app, BrowserWindow, desktopCapturer, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

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

app.whenReady().then(createWindow);

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
