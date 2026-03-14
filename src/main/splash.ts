import { BrowserWindow, nativeImage } from 'electron';

let splashWindow: BrowserWindow | null = null;

// Embedded HTML — no build step or file-copy needed.
const SPLASH_HTML = /* html */ `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0a0c10;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      user-select: none;
      -webkit-app-region: drag;
      overflow: hidden;
    }

    /* subtle border so the frameless window has definition */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      border: 1px solid rgba(245, 158, 11, 0.18);
      border-radius: 10px;
      pointer-events: none;
      z-index: 10;
    }

    .icon {
      font-size: 52px;
      line-height: 1;
      margin-bottom: 14px;
      animation: pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .title {
      font-size: 26px;
      font-weight: 700;
      color: #f59e0b;
      letter-spacing: -0.4px;
      margin-bottom: 4px;
      animation: fade-up 0.4s ease 0.1s both;
    }

    .subtitle {
      font-size: 11.5px;
      color: #4b5563;
      letter-spacing: 0.3px;
      margin-bottom: 40px;
      animation: fade-up 0.4s ease 0.15s both;
    }

    .progress-wrap {
      width: 180px;
      margin-bottom: 14px;
      animation: fade-up 0.4s ease 0.2s both;
    }

    .progress-track {
      height: 2px;
      background: #1a1f2e;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #b45309, #f59e0b, #fcd34d);
      border-radius: 2px;
      transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .status {
      font-size: 11px;
      color: #374151;
      letter-spacing: 0.2px;
      min-height: 16px;
      transition: opacity 0.2s;
      animation: fade-up 0.4s ease 0.25s both;
    }

    @keyframes pop {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="icon">🍺</div>
  <div class="title">DBeer</div>
  <div class="subtitle">Natural Language Database Client</div>

  <div class="progress-wrap">
    <div class="progress-track">
      <div class="progress-fill" id="fill"></div>
    </div>
  </div>

  <div class="status" id="status">Iniciando…</div>

  <script>
    window.setStatus = function (text, pct) {
      document.getElementById('status').textContent = text;
      document.getElementById('fill').style.width = pct + '%';
    };
  </script>
</body>
</html>`;

export function createSplash(iconPath?: string): BrowserWindow {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 260,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0a0c10',
    roundedCorners: true,
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`
  );

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

export function setSplashStatus(text: string, progress: number): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents
    .executeJavaScript(
      `window.setStatus(${JSON.stringify(text)}, ${Math.min(100, progress)})`
    )
    .catch(() => {/* splash may have closed already */});
}

export function closeSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}
