---
name: photobooth-electron-packaging
description: >-
  Vite and Electron packaging workflow to build standalone Windows Portable EXEs and macOS
  DMGs for interactive event photobooths.
---

# Photobooth Electron Packaging Skill

This skill guides configuring Vite, Electron, and `electron-builder` to bundle interactive kiosk photobooth web apps into zero-install portable Windows `.exe` binaries and macOS `.dmg` / `.app` bundles.

## Key Packaging Requirements

1. **Relative Asset Base & Helper**: Vite must build with `base: './'` so that Electron's `file://` protocol can resolve assets in the packaged bundle. Always use a `getAssetUrl` utility helper for dynamic assets (`assets/images/...`, `assets/models/...`).
2. **Kiosk / Fullscreen Mode with Frame**: Electron `BrowserWindow` starts in locked full-screen kiosk mode (`kiosk: true`, `fullscreen: true`) with native frame enabled (`frame: true`) so that when the operator exits kiosk mode, the title bar and window controls are available.
3. **OS Navigation Suppression**: Intercept `before-input-event` in the main process to suppress `Escape` and `Alt` keys, preventing visitors from escaping kiosk mode or showing the desktop taskbar/menu.
4. **Dedicated Operator Key (F2)**: Register `F2` in Electron to toggle kiosk mode and notify the frontend renderer via IPC to open/close the Admin Settings modal.
5. **ASAR Packaging**: Configure `"asar": true` in `package.json` to securely package source code and assets inside the portable executable without file-locking issues.
6. **Webcam & Media Permissions**: Electron main process must intercept and automatically approve `media` / camera permission requests.

## 1. Asset Helper (`src/utils/assetHelper.ts`)

In packaged Electron builds running via `file://`, absolute root paths (like `/assets/images/...`) fail. Always normalize asset paths with a helper:

```typescript
export function getAssetUrl(relativePath: string): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('data:')) {
    return relativePath;
  }
  const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${import.meta.env.BASE_URL}${clean}`;
}
```

## 2. Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // CRITICAL: Ensures assets use relative paths for Electron file:// protocol
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  }
});
```

## 3. Electron Main Process (`electron/main.cjs`)

```javascript
const { app, BrowserWindow, ipcMain, session, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: true, // Starts locked in full kiosk mode
    frame: true, // Native title bar available when exiting kiosk
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Automatically approve camera/microphone permissions
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  // Block Escape and Alt from exiting fullscreen or revealing window menu
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' || input.key === 'Alt') {
      event.preventDefault();
    }
  });

  // Toggle Kiosk mode handler for Admin / Operator
  const toggleKiosk = () => {
    if (!mainWindow) return;
    const isCurrentlyKiosk = mainWindow.isKiosk();
    const nextState = !isCurrentlyKiosk;
    mainWindow.setKiosk(nextState);
    mainWindow.setFullScreen(nextState);
    mainWindow.webContents.send('toggle-admin');
  };

  ipcMain.handle('exit-kiosk', () => {
    if (mainWindow) {
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
    }
  });

  ipcMain.handle('enter-kiosk', () => {
    if (mainWindow) {
      mainWindow.setKiosk(true);
      mainWindow.setFullScreen(true);
    }
  });

  // Register F2 exclusively for operator kiosk toggle
  globalShortcut.register('F2', toggleKiosk);

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## 4. Package Configuration (`package.json`)

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "cross-env NODE_ENV=development electron .",
    "electron:build": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.5dvr.photobooth",
    "productName": "5DVR AI Photobooth",
    "asar": true,
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "package.json"
    ],
    "win": {
      "target": ["portable"],
      "icon": "public/icon.ico"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "public/icon.png",
      "category": "public.app-category.entertainment"
    }
  }
}
```

## Build Execution

- To build the production Windows Portable EXE:
  ```bash
  npm run electron:build
  ```
- The standalone binary will be generated in `release/5DVR AI Photobooth-Windows-Portable.exe`, ready to run on any kiosk machine without installation.
