import { app, BrowserWindow, shell, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerIPCHandlers, cleanup } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getIconPath(): string | undefined {
  // In dev: relative to dist/main/ → ../../assets/
  // In prod: relative to dist/main/ → ../../assets/
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(app.getAppPath(), 'assets', 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow(): void {
  const iconPath = getIconPath();

  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'DBeer',
    backgroundColor: '#0a0c10',
    // hiddenInset is macOS-only; use default frame on Windows/Linux
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  // Set dock icon on macOS
  if (process.platform === 'darwin' && iconPath) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    } catch {}
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIPCHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await cleanup();
});
