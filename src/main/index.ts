import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, NativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, queryOne } from './database';
import { registerIpcHandlers } from './ipc';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let forceQuit = false;
let appIcon: NativeImage = nativeImage.createEmpty();

// `npx electron .` on a built app is NOT a dev run: only an explicit flag means dev.
const isDev = !app.isPackaged && process.argv.includes('--dev');
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

function resolveIconPath(): string | null {
  const candidates = [
    // unpackaged: dist/main -> <project>/build
    path.join(__dirname, '../../build/icon.ico'),
    // packaged: resources/app.asar/dist/main -> app.asar/build
    path.join(__dirname, '../build/icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function loadAppIcon() {
  const iconPath = resolveIconPath();
  if (!iconPath) {
    console.error('[icon] no icon.ico found in any candidate path');
    return;
  }
  // createFromPath never throws on a bad file, it returns an empty image
  const loaded = nativeImage.createFromPath(iconPath);
  if (loaded.isEmpty()) {
    console.error('[icon] file exists but decoded to an empty image:', iconPath);
    return;
  }
  appIcon = loaded;
}

function createWindow() {
  loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // Disable background throttling
    },
    title: 'XorTime Clone',
    icon: appIcon,
  });

  // Surface load failures instead of silently showing a blank window
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[RENDERER did-fail-load] ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[RENDERER gone] ${JSON.stringify(details)}`);
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (forceQuit) return;
    try {
      const row = queryOne("SELECT value FROM settings WHERE key = 'minimize_to_tray'");
      const minimizeToTray = row?.value === '1';
      if (minimizeToTray) {
        event.preventDefault();
        mainWindow?.hide();
        return;
      }
    } catch {}
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  if (appIcon.isEmpty()) {
    console.error('[tray] skipping: no usable app icon');
    return;
  }

  // Vite does not emit tray-icon.png into dist, so derive the tray image from the app icon
  tray = new Tray(appIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '开始番茄钟',
      click: () => {
        mainWindow?.webContents.send('start-pomodoro');
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        forceQuit = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('XorTime Clone');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function createFloatingWindow() {
  floatingWindow = new BrowserWindow({
    width: 280,
    height: 64,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // Disable background throttling
    },
  });

  if (isDev) {
    floatingWindow.loadURL(`${devServerUrl}/floating.html`);
  } else {
    floatingWindow.loadFile(path.join(__dirname, '../renderer/floating.html'));
  }

  floatingWindow.once('ready-to-show', () => {
    floatingWindow?.show();
    // Set highest always-on-top level after showing
    floatingWindow?.setAlwaysOnTop(true, 'screen-saver');
  });

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
}

ipcMain.handle('show-floating-window', () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
  } else {
    floatingWindow.show();
    // Re-apply always-on-top after showing to ensure it stays on top
    floatingWindow.setAlwaysOnTop(true, 'screen-saver');
    // Also try setting it again after a short delay
    setTimeout(() => {
      if (floatingWindow && !floatingWindow.isDestroyed()) {
        floatingWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    }, 100);
  }
  return { success: true };
});

ipcMain.handle('hide-floating-window', () => {
  floatingWindow?.hide();
  return { success: true };
});

ipcMain.handle('update-floating-window', (_, data) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('floating-update', data);
  }
  return { success: true };
});

ipcMain.handle('close-floating-window', () => {
  floatingWindow?.close();
  floatingWindow = null;
  return { success: true };
});

ipcMain.handle('move-floating-window', (_, { deltaX, deltaY }) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    const [x, y] = floatingWindow.getPosition();
    floatingWindow.setPosition(x + deltaX, y + deltaY);
  }
  return { success: true };
});

ipcMain.handle('focus-main-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  return { success: true };
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  await initDatabase();
  registerIpcHandlers();
  createWindow();
  createTray();

  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-user-data-path', () => app.getPath('userData'));
});

app.on('before-quit', () => {
  forceQuit = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});
