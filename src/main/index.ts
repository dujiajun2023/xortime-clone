import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron';
import path from 'path';
import { initDatabase, queryOne } from './database';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let forceQuit = false;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'XorTime Clone',
    icon: path.join(__dirname, '../../build/icon.ico'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
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
  try {
    const iconPath = path.join(__dirname, '../renderer/assets/tray-icon.png');
    tray = new Tray(iconPath);
  } catch {
    try {
      const nativeImage = require('electron').nativeImage;
      const defaultIcon = nativeImage.createEmpty();
      tray = new Tray(defaultIcon);
    } catch {
      return;
    }
  }

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
    },
  });

  // Set highest always-on-top level after creation
  floatingWindow.setAlwaysOnTop(true, 'floating');

  if (isDev) {
    floatingWindow.loadURL('http://localhost:5173/floating.html');
  } else {
    floatingWindow.loadFile(path.join(__dirname, '../renderer/floating.html'));
  }

  floatingWindow.once('ready-to-show', () => {
    floatingWindow?.show();
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
