---
name: photobooth-photo-printing
description: >-
  Professional borderless photo printing setup for Canon SELPHY CP and DNP DP-QW410 dye-sublimation
  printers in Electron on Windows and macOS.
---

# Photobooth Photo Printing Skill

This skill provides the comprehensive hardware and software setup for professional dye-sublimation photo printing (Canon SELPHY CP1300/CP1500 and DNP DP-QW410) in Electron photobooth applications.

## Key Hardware Profiles

1. **Canon SELPHY CP Series (CP1300 / CP1500)**:
   - Paper Size: Postcard (4 x 6 in / 100 x 148 mm).
   - Driver Setup: Install official Canon SELPHY driver, set Page Size to Postcard / Borderless.
2. **DNP DP-QW410 Series**:
   - Paper Size: 4 x 6 in (102 x 152 mm) or 4.5 x 8 in.
   - Driver Setup: Install DNP QW410 driver, set Print Quality to Fine/Glossy, Auto Cut enabled.

## Electron Architecture for Silent Borderless Printing

Printing in kiosk photobooths must happen silently in the background without exposing browser print dialogs to attendees.

```
[Captured / Composited Photo Canvas]
                 │
                 ▼
[Renderer Process: IPC Send] ──► `window.electronAPI.printPhoto(base64Image, printerName)`
                 │
                 ▼
[Main Process (main.cjs)]
  ├── Option A: Hidden BrowserWindow.webContents.print({ silent: true, deviceName })
  └── Option B: Native CLI Fallback
        ├── Windows: PowerShell / PDFtoPrinter / rundll32
        └── macOS: CUPS `lp -d "PRINTER_NAME" -o media=Postcard -o fit-to-page`
```

## CSS Borderless Print Stylesheet

Electron print rendering requires exact CSS rules to eliminate 1/4-inch white margins:

```css
@page {
  size: 4in 6in;
  margin: 0mm !important;
}

@media print {
  html, body {
    width: 100%;
    height: 100%;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #000 !important;
  }

  .print-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-inside: avoid;
  }

  .print-image {
    width: 100%;
    height: 100%;
    object-fit: cover; /* or contain depending on frame bleed */
  }
}
```

## Electron Main Process Silent Print Implementation

```javascript
// In electron/main.cjs
ipcMain.handle('print-photo', async (event, { imageBase64, printerName }) => {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { size: 4in 6in; margin: 0; }
            body { margin: 0; padding: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
            img { width: 100%; height: 100%; object-fit: cover; }
          </style>
        </head>
        <body>
          <img src="${imageBase64}" />
        </body>
      </html>
    `;

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName || undefined,
          margins: { marginType: 'none' },
          pageSize: { width: 101600, height: 152400 }, // 4x6 in microns
        },
        (success, failureReason) => {
          printWindow.close();
          if (success) {
            resolve({ success: true });
          } else {
            reject(new Error(failureReason));
          }
        }
      );
    });
  });
});
```

## Best Practices

- **Printer Locking**: Save the selected printer name in `printer-config.json` so the kiosk automatically binds to the connected printer on reboot.
- **Debounce Printing**: Place a 3-5 second lock on print triggers to avoid duplicate ribbon waste from multiple rapid screen taps by users.
- **DPI Sizing**: Render final composited print canvas at 1200 x 1800 px (300 DPI for 4x6 inch paper) for ultra-sharp physical prints.
