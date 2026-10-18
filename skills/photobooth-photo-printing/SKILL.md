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

## Multiple printers and queue-aware dispatch

Use this routing behavior when an operator selects multiple printers (AHK production learning):

1. Persist an ordered, deduplicated list of exact OS device names. F2 supports add/remove/reorder/refresh, shows missing selected devices, and migrates a legacy single name.
2. Enumerate Electron printers and enrich with Windows `Win32_Printer` status and pending `Win32_PrintJob` counts. Use a static PowerShell script with `execFile`, `windowsHide`, timeout and bounded output; never interpolate printer names as shell code. OS status can be unknown or stale.
3. Keep only selected installed printers without known offline/error conditions. Choose the first ready printer in operator order. If all usable printers are busy, submit to the first usable printer's OS spooler. If status is unknown and none is ready, use the first usable candidate and log that fallback. If none is usable, show an actionable operator error.
4. Acquire the app's print-submission guard BEFORE awaiting printer enumeration. Release in `finally`. This guard prevents concurrent submissions; Windows owns the actual job queue. Do not claim a print callback proves physical completion, or implement a competing persistent job queue without a separate requirement.
5. Print through a hidden window after the image decodes, using silent print, exact deviceName, zero margins and the driver paper profile. Destroy the window on success/failure. Report failures; do not blindly retry ambiguous submissions that could duplicate a print.

### Print-only top/bottom protection

Canon CP1500 borderless cropping required independently configurable black top/bottom padding, both default 0. On AHK's 1200x1800 canvas, fill black and draw the whole composited image at `(0, top, 1200, 1800-top-bottom)`. This compresses height slightly while retaining full width and frame content. Aspect-preserving `contain` adds unwanted black side margins; do not use it when only top/bottom protection was requested. This is an explicit print tradeoff, not the framing policy for saved images.

Keep the archived image, QR download and result preview unchanged. Verify black top/bottom pixels AND colored left/right edges in the image area, zero padding, bounds, all-busy fallback, offline/error exclusion, missing devices, and rapid repeated clicks. Test the final paper output with the actual driver.
