/**
 * Generates icon.png from icon.svg using Electron's offscreen rendering.
 * Run: npx electron scripts/generate-icon.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
  const pngPath = path.join(__dirname, '..', 'assets', 'icon.png');

  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    webPreferences: { offscreen: true },
  });

  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  const html = `<html><body style="margin:0;padding:0;background:transparent;">${svgContent}</body></html>`;
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

  await win.loadURL(dataUrl);

  // Wait for render
  await new Promise(resolve => setTimeout(resolve, 500));

  const image = await win.webContents.capturePage();
  const png = image.toPNG();
  fs.writeFileSync(pngPath, png);

  console.log(`✅ Generated ${pngPath} (${png.length} bytes)`);

  app.quit();
});
