import { app, BrowserWindow, shell, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerIPCHandlers, cleanup } from './ipc/handlers';
import { createSplash, setSplashStatus, closeSplash } from './splash';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getIconPath(): string | undefined {
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

function createWindow(iconPath?: string): void {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'DBeer',
    backgroundColor: '#0a0c10',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    // Keep hidden until the splash closes.
    show: false,
  });

  if (process.platform === 'darwin' && iconPath) {
    try { app.dock.setIcon(nativeImage.createFromPath(iconPath)); } catch {}
  }

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
  const iconPath = getIconPath();

  // --- Splash: show immediately ---
  createSplash(iconPath);
  setSplashStatus('Registrando serviços…', 15);

  // --- IPC handlers ---
  registerIPCHandlers();
  setSplashStatus('Carregando interface…', 45);

  // --- Main window (invisible while loading) ---
  createWindow(iconPath);
  setSplashStatus('Aguardando renderer…', 70);

  // Fallback: if ready-to-show never fires, close the splash after 12 s.
  const fallback = setTimeout(() => {
    closeSplash();
    mainWindow?.show();
  }, 12_000);

  mainWindow!.once('ready-to-show', () => {
    clearTimeout(fallback);
    setSplashStatus('Pronto!', 100);
    // Short pause so the user sees 100 % before the main window appears.
    setTimeout(() => {
      closeSplash();
      mainWindow?.show();
    }, 350);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(iconPath);
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
