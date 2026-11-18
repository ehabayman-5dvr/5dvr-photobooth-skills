---
name: photobooth-operator-settings
description: Build a Desktop-only F2 operator settings panel for Electron photobooth kiosks using the strict 2-layer configuration split (read-only Cloud Project Config from the 5DVR Dashboard vs. local hardware/printer/camera operator-settings.json).
---
# Desktop Kiosk Operator Settings (`F2`) — 2-Layer Architecture

> **Platform Scope (`desktop` ONLY):** This skill applies **only** to physical Electron Desktop Kiosks. Browser/mobile **Web Photobooth Apps (`projectType === 'web'`) do NOT have an `F2` operator panel, `operator-settings.json`, local camera rotation controls, or physical printing.**

`F2` (or a hidden 5-tap corner hot-zone) opens the local Operator Panel from any kiosk screen through a narrow preload IPC bridge. **Always include:**
1. **Password Lock Gate (`operatorPassword`)**: Prompt for the operator password before revealing settings whenever `operatorPassword` is non-empty (default `'5dvr'`, editable inside `F2`).
2. **On-Screen Touch `VirtualKeyboard`**: Include a built-in touch `VirtualKeyboard` (auto-shown on input focus and toggleable via a header button) so touch-only kiosks without a physical keyboard can enter passwords, custom printer names, and numeric timers.
3. **Form UX**: Provide a scrollable, keyboard-accessible form with Save/Cancel, visible save errors, and disabled duplicate submission. Preserve the participant flow when closing settings and keep attendee UI text unselectable while allowing form inputs inside the modal to be edited.

---

## Strict 2-Layer Configuration Split (CRITICAL)

Every Desktop Kiosk maintains **two strictly separate JSON files** on disk (inside `PORTABLE_EXECUTABLE_DIR` for portable builds or `app.getPath('userData')`). **Never merge them into one file, never overwrite local hardware settings with Cloud API responses, and never `POST`/`PUT` local settings to the Dashboard.**

| Layer | File on Disk | Source of Truth | Owned Fields | Sync Direction |
| :--- | :--- | :--- | :--- | :--- |
| **1. Cloud Project Config** | `cloud-config.cache.json` *(offline boot fallback)* | **5DVR Dashboard** (`GET /api/projects/{id}/settings` + `POST /generate`) | `dashboardProjectId`, `projectName`, `isActive`, `dailyLimit`, `currentGenerations`, `aiModelProvider` (`'openai' \| 'gemini'`), `openaiModel` *(locked AI model)*, `openaiApiKey`, `geminiApiKey`, `referenceImagesCount`, `cloudinaryCloudName`, `cloudinaryApiKey`, `cloudinaryApiSecret`, `cloudinaryFolder`, `totalPrintedCopies` | **Cloud → Booth ONLY (`GET`)** |
| **2. Local Operator Settings** | `operator-settings.json` | **Local Kiosk `F2` Panel** | `operatorPassword`, `previewMode`, `imageQuality` (`'low' \| 'medium' \| 'high'` for OpenAI), `selectedCameraId`, `cameraRotation` (`-90 \| 0 \| 90 \| 180`), `cameraMirror`, `enableTestImageUpload` *(default `false`)*, `enablePrinting`, `selectedPrinterName`, `printerNames` (ordered priority list), `printCopies`, `autoPrintOnResult`, `singlePrintPerSession`, `autoClearPrinterQueue`, `compositeFrameAndLogos`, `printFillColor`, `printScaleDownPercent`, `printTop/Bottom/Left/RightPaddingPx`, `countdownSeconds`, `previewAutoProceedSeconds`, `eraSelectionTimeoutSeconds`, `resultIdleTimeoutSeconds`, `soundEnabled`, `kioskLocked`, `autoRestartMode`, `photoViewerUrl` | **100% Local on Booth** *(never sent to Dashboard)* |

---

## Rules for the `F2` Operator Modal UI

1. **Cloud Config Is Read-Only in `F2`:**
   - Do **not** render editable dropdowns for the AI model or text inputs for OpenAI/Gemini/Cloudinary API keys in `F2`. Those are controlled centrally from the 5DVR Dashboard.
   - Instead, render a **Read-Only Cloud Status Card** inside `F2` showing:
     - Project Name & Status (`In Use` vs `Finished`)
     - Locked AI Model (`cloudConfig.openaiModel` + `cloudConfig.aiModelProvider`)
     - Active Cloudinary Folder (`cloudConfig.cloudinaryFolder`)
     - Live Portrait & Print Counters (`currentGenerations / dailyLimit` and `totalPrintedCopies`)
     - Last Cloud Sync timestamp + a **"Sync Cloud Config Now"** button (triggers `GET /api/projects/{id}/settings` and updates `cloud-config.cache.json`). Also trigger a non-blocking `GET /settings` refresh automatically whenever `F2` opens so multi-kiosk or Dashboard edits are immediately reflected.
   - **Single Cloud Source of Truth for All `Gen | Print` Indicators**: Every generation and print counter badge in `F2` (including header pills like `Gen: X | Print: Y` and the Cloud Status Card) **must** read directly from `cloudConfig.currentGenerations` and `cloudConfig.totalPrintedCopies`—never from a separate per-app-launch in-memory `sessionStats` object that resets to `0` when restarting the `.exe`.
   - Do **not** render raw API keys or secrets in the `F2` DOM (only show boolean key-ready badges like `OpenAI Key: Synced ✓`).
2. **Editable Local Hardware & Operational Controls in `F2` (Standard 5-Tab Layout):**
   Organize `F2` into **5 clean tabs** (matching `Egyptian-Museum-Photobooth`), with the underlying modal blurred and re-locked behind the password gate every time `F2` opens:
   - **Tab 1 — `Experience & AI`**: Read-Only Cloud Status Card + `previewMode` (dry-run simulation toggle), OpenAI `imageQuality` (`low` / `medium` / `high` — hidden or disabled when `aiModelProvider === 'gemini'`), and `photoViewerUrl`.
   - **Tab 2 — `Camera & Mount`**: Device selector + `Refresh Devices`, physical rotation (`-90°`, `0°`, `90°`, `180°`), horizontal mirror toggle (`cameraMirror`), and `enableTestImageUpload` (**default `false`**).
   - **Tab 3 — `Printers & Padding`**: `enablePrinting`, `compositeFrameAndLogos`, `singlePrintPerSession`, `autoPrintOnResult`; **Slot-Based Multi-Printer Priority Routing** (`Photo printer 1..N` dropdowns, minimum 2 slots, `+ Add Printer` up to 10, `Refresh Printers`, `↑`/`↓`/`Trash` reorder/remove, live ready/busy/offline status); **Print Calibration** (`printFillColor`: `'black' | 'white'`, `printScaleDownPercent`: `0..35%` scale-down, `printTop/Bottom/Left/RightPaddingPx`: `0..300px`, `printCopies` with `-`/`+` buttons); plus **`Send Test Print`** and **`Clear Print Queue`** action buttons. See [printing skill](../photobooth-photo-printing/SKILL.md).
   - **Tab 4 — `Prompts`**: Overview/editor for the booth's eras/modes and variation prompts.
   - **Tab 5 — `Kiosk, Restart & JSON`**: `countdownSeconds`, `previewAutoProceedSeconds`, `eraSelectionTimeoutSeconds`, `resultIdleTimeoutSeconds`, `operatorPassword` (with show/hide toggle), `kioskLocked`, `Exit Fullscreen Window` / `Relaunch App Now`, and `Export JSON` / `Import JSON` / `Reset Defaults`.

---

## Persistence, Portable Seeding & Offline Boot Resilience

1. **Minimal Build-Time Seed:** Only `VITE_DASHBOARD_URL` and `VITE_DASHBOARD_PROJECT_ID` are needed in `.env.local` (safe non-secret identifiers that can be bundled into the portable `.exe`).
2. **Offline Boot Resilience (`cloud-config.cache.json`):**
   - On app startup, fetch `GET {VITE_DASHBOARD_URL}/api/projects/{VITE_DASHBOARD_PROJECT_ID}/settings` and atomically write the result to `cloud-config.cache.json`.
   - If exhibition Wi-Fi is down when the kiosk PC boots, load `cloud-config.cache.json` immediately so the booth starts cleanly and retry syncing in the background.
3. **Portable Folder Preservation (`operator-settings.json`):**
   - Store `operator-settings.json` in `PORTABLE_EXECUTABLE_DIR` (when running as a portable launcher) or alongside the unpacked executable / `userData` as agreed for the deployment, using atomic temp-file write + rename so power loss never corrupts the JSON.
   - Additive fields must merge with `DEFAULT_OPERATOR_SETTINGS` so older JSON files upgrade cleanly without resetting operator printer/camera calibration.
