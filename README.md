# 5DVR Photobooth Skills & Automation System

This directory contains standardized, modular skills designed for rapid development, consistent architecture, and reliable execution across all 5DVR AI photobooth activations.

## Global Installation Status

All skills in this directory are globally installed in:
```
C:\Users\<User>\.gemini\config\skills\
```
Because they reside in the Global Customizations Root, **Antigravity automatically discovers and activates these skills in any new or existing project** on this machine without requiring manual installation.

They are also mirrored in `.agents/skills/` and `.agent/skills/` within this repository so they remain version-controlled alongside the application code.

👉 **Looking to start a new project with these skills?** Read the [New Project Onboarding & Usage Guide](./NEW_PROJECT_ONBOARDING.md).

---

## Photobooth Skills Reference

### 1. `photobooth-qr-generator`
- **Location**: [photobooth-qr-generator/SKILL.md](./skills/photobooth-qr-generator/SKILL.md)
- **Purpose**: Generates high-contrast QR codes directing participants to the branded viewer (`https://photobooth-viewer.vercel.app/?url={ENCODED_IMAGE_URL}&branded=true`).
- **Features**:
  - Primary generation via `qrcode` package with error correction level `M` and custom theme palette.
  - Remote fallback endpoint via `api.qrserver.com` in case of client canvas errors.
  - Reusable module: [qrService.ts](./skills/photobooth-qr-generator/examples/qrService.ts).

### 2. `photobooth-metrics-api`
- **Location**: [photobooth-metrics-api/SKILL.md](./skills/photobooth-metrics-api/SKILL.md)
- **Purpose**: Live project counter tracking via the 5DVR photobooth dashboard (`POST https://ai-photobooth-dashboard.vercel.app/api/projects/{projectId}/generate`).
- **Features**:
  - Non-blocking execution so participant kiosk UX is never delayed.
  - Resolves `VITE_DASHBOARD_PROJECT_ID` or `DASHBOARD_PROJECT_ID` dynamically from `.env.local`.
  - Silent fail-safe error handling to maintain uninterrupted booth uptime even during network drops.
  - Reusable module: [metricsService.ts](./skills/photobooth-metrics-api/examples/metricsService.ts).

### 3. `cloudinary-photobooth-upload`
- **Location**: [cloudinary-photobooth-upload/SKILL.md](./skills/cloudinary-photobooth-upload/SKILL.md)
- **Purpose**: Secure client-side signed direct photo upload to Cloudinary.
- **Features**:
  - Generates SHA-1 signatures locally via the Web Crypto API (`crypto.subtle.digest`).
  - Sorted parameter handling with event folder namespacing (e.g. `Tech-Summit-26`).
  - Exponential backoff retry loop (3 attempts) to handle erratic exhibition Wi-Fi.
  - Reusable module: [cloudinaryService.ts](./skills/cloudinary-photobooth-upload/examples/cloudinaryService.ts).

### 4. `photobooth-face-prompt-crafting`
- **Location**: [photobooth-face-prompt-crafting/SKILL.md](./skills/photobooth-face-prompt-crafting/SKILL.md)
- **Purpose**: Real-time client face, age, and gender analysis with dynamic GenAI prompt engineering.
- **Features**:
  - SSD MobileNet V1 high-accuracy detector + FaceLandmark68Net + AgeGenderNet.
  - Local `/models` support with automatic CDN fallback.
  - Enforces strict 1:1 facial identity preservation (zero morphing, zero AI beautification).
  - Cultural & religious headcover preservation (Preserving women's hijab/sheila/headscarf if worn in the photo).
  - Multi-person group variety and lighting harmonization.
  - Reusable modules: [faceService.ts](./skills/photobooth-face-prompt-crafting/examples/faceService.ts) & [promptEngine.ts](./skills/photobooth-face-prompt-crafting/examples/promptEngine.ts).

### 5. `photobooth-photo-printing`
- **Location**: [photobooth-photo-printing/SKILL.md](./skills/photobooth-photo-printing/SKILL.md)
- **Purpose**: Borderless dye-sublimation printing for Canon SELPHY CP and DNP DP-QW410 printers.
- **Features**:
  - Electron silent background printing via hidden `BrowserWindow`.
  - CSS `@media print` rules removing margins.
  - Paper profiles: Postcard 4x6" (100x148mm / 102x152mm).

### 6. `photobooth-electron-packaging`
- **Location**: [photobooth-electron-packaging/SKILL.md](./skills/photobooth-electron-packaging/SKILL.md)
- **Purpose**: Vite + Electron configuration to bundle kiosks into single-file portable Windows EXEs and macOS DMGs.

---

## How to Import These Skills into Any Future Project

Whenever you begin a new photobooth project:

### Option 1: Automatic (Global Customization)
Because all skills are installed in `~/.gemini/config/skills/`, Antigravity will automatically detect and suggest them in ANY project you open on this machine.

### Option 2: One-Line Local Sync
To copy the skills locally into the new project's `.agents/` folder:
```powershell
powershell -Command "New-Item -ItemType Directory -Force -Path '.agents\skills'; Copy-Item -Recurse -Force \"$env:USERPROFILE\.gemini\config\skills\photobooth-*\" '.agents\skills'; Copy-Item -Recurse -Force \"$env:USERPROFILE\.gemini\config\skills\cloudinary-*\" '.agents\skills'; Write-Host 'Photobooth skills imported into .agents\skills' -ForegroundColor Green"
```
