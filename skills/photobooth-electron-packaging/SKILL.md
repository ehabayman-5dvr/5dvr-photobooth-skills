---
name: photobooth-electron-packaging
description: >-
  Vite and Electron packaging workflow to build standalone Windows Portable EXEs and macOS
  DMGs for interactive event photobooths.
---

# Photobooth Electron Packaging Skill

This skill guides configuring Vite, Electron, and `electron-builder` to bundle interactive kiosk photobooth web apps into zero-install portable Windows `.exe` binaries and macOS `.dmg` / `.app` bundles.

## Key Packaging Requirements

1. **Relative Asset Base**: Vite must build with `base: './'` so that Electron's `file://` protocol can resolve assets in the packaged bundle.
2. **Kiosk / Fullscreen Mode**: Electron `BrowserWindow` must launch borderless, full screen, with DevTools disabled or shortcut-protected.
3. **Webcam & Media Permissions**: Electron main process must intercept and automatically grant `media` / camera permission requests.
4. **Environment Variables**: Bundle default credentials or read `.env.local` from the running directory if external runtime configuration is required.

## 1. Vite Configuration (`vite.config.ts`)

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

## 2. Electron Main Process (`electron/main.cjs`)

```javascript
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: true, // Prevents users from exiting or accessing the OS desktop
    frame: false,
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

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## 3. Package Configuration (`package.json`)

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "cross-env NODE_ENV=development electron .",
    "dist:win": "vite build && electron-builder --win portable",
    "dist:mac": "vite build && electron-builder --mac dmg"
  },
  "build": {
    "appId": "com.5dvr.photobooth",
    "productName": "Photobooth",
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
      "icon": "public/icon.icns",
      "category": "public.app-category.entertainment"
    }
  }
}
```

## Build Execution

- To produce Windows Portable EXE:
  ```bash
  npm run dist:win
  ```
- The resulting single executable is located in `release/Photobooth 1.0.0.exe`, ready to copy to a USB drive or client kiosk machine.
