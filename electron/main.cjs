// Electron main process — wraps the published PayPulse web app in a native window.
// Build & package locally (see DESKTOP_BUILD.md). Do NOT run inside Lovable's sandbox.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// The published URL of your Lovable app. Change if you move to a custom domain.
const APP_URL = process.env.PAYPULSE_URL || 'https://staffpayroll.lovable.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'PayPulse',
    backgroundColor: '#0b0b12',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(APP_URL);

  // Open external links (mailto:, target=_blank) in the user's default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Show a friendly page if the user is offline
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    if (code === -106 || code === -105 || code === -21) {
      win.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(`
          <html><head><title>PayPulse — Offline</title>
          <style>
            body{margin:0;height:100vh;display:grid;place-items:center;
              font-family:-apple-system,Segoe UI,Roboto,sans-serif;
              background:#0b0b12;color:#e5e7eb;text-align:center}
            .card{padding:32px;max-width:420px}
            h1{font-size:22px;margin:0 0 8px}
            p{color:#9ca3af;margin:0 0 20px;line-height:1.5}
            button{background:#6366f1;color:white;border:0;padding:10px 20px;
              border-radius:8px;font-size:14px;cursor:pointer}
          </style></head><body>
          <div class="card">
            <h1>You're offline</h1>
            <p>PayPulse needs internet to load your employee, attendance and payroll data.
            Reconnect and try again.</p>
            <button onclick="location.href='${APP_URL}'">Retry</button>
          </div></body></html>
        `),
      );
    }
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { role: 'resetZoom' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
    ]),
  );
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
