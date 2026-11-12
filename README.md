# 5DVR Photobooth Skills & Automation System

Standardized, modular Antigravity skills for rapid development, consistent 2-layer architecture, and reliable event execution across all **5DVR Desktop Kiosks (`desktop`)** and **Web Photobooths (`web`)**.

## Global Installation & Dashboard Integration

All 10 skills in this repository install into Antigravity's Global Customizations Root:
```text
C:\Users\<User>\.gemini\config\skills\
```
Antigravity automatically discovers these skills in every project opened on your machine.

👉 **Starting a new photobooth?**
1. Create the project on the **5DVR AI Photobooth Dashboard** and open its **Developer** tab to download `<project>-agent-integration.md`.
2. Start a chat in Antigravity with **`/grill-me`** + attach the `.md` file so the agent interviews you on eras/modes, framing (`ornate_frame` vs `logo_only` vs `unframed`), reference plates, and hardware before writing code.
3. Read the full [New Project Onboarding & Usage Guide](./NEW_PROJECT_ONBOARDING.md).

---

## All 10 Photobooth Skills

### Shared Skills (Desktop Kiosks & Web Apps)

#### 1. `photobooth-screen-flow`
- **Location**: [skills/photobooth-screen-flow/SKILL.md](./skills/photobooth-screen-flow/SKILL.md)
- **Purpose**: 6-screen state machine, mandatory `/grill-me` pre-implementation interview, clean camera framing (no face-oval HUDs), 5s Preview auto-proceed timer, and conditional output compositing (`ornate_frame` with BFS outer-alpha flood-fill mask, `logo_only`, or `unframed`).

#### 2. `photobooth-face-prompt-crafting`
- **Location**: [skills/photobooth-face-prompt-crafting/SKILL.md](./skills/photobooth-face-prompt-crafting/SKILL.md)
- **Purpose**: Client-side `face-api.js` (`SSD MobileNet V1`) + **7-Block `Egyptian-Museum` Prompt Engine**:
  - Supports **1-Image** (guest capture only) and **Dual-Image** (`IMAGE 1` guest capture + `IMAGE 2` empty scene/monument plate).
  - Soft-hint people count (`buildSubjectDirective`) so tilted faces are never dropped.
  - Strict 1:1 facial identity lock, full-coverage modesty mandate, and women's `(A) Hijab + long opaque sleeves` vs. `(B) Uncovered natural hair` split.
  - Conditional safe-area rules (`15%` top / `12%` sides for `ornate_frame`; natural headroom for `logo_only` and `unframed`).
  - Reusable modules: [faceService.ts](./skills/photobooth-face-prompt-crafting/examples/faceService.ts) & [promptEngine.ts](./skills/photobooth-face-prompt-crafting/examples/promptEngine.ts).

#### 3. `photobooth-model-providers`
- **Location**: [skills/photobooth-model-providers/SKILL.md](./skills/photobooth-model-providers/SKILL.md)
- **Purpose**: Dashboard-locked OpenAI (`POST /v1/images/edits` multipart `image[]`) and Google Gemini (`POST /v1beta/interactions`) image generation adapters, `IMAGE 2` reference caching, `AbortController` timeouts, zero paid auto-retries, and styled console prompt logging.

#### 4. `cloudinary-photobooth-upload`
- **Location**: [skills/cloudinary-photobooth-upload/SKILL.md](./skills/cloudinary-photobooth-upload/SKILL.md)
- **Purpose**: Signed direct Cloudinary uploads using credentials from `GET /settings`, 900-character `prompt_0, prompt_1, ...` `context` chunking (powering the Dashboard Gallery `ⓘ` Portrait Details drawer), event folder tagging, and 3x exponential backoff.
- **Reusable module**: [cloudinaryService.ts](./skills/cloudinary-photobooth-upload/examples/cloudinaryService.ts).

#### 5. `photobooth-qr-generator`
- **Location**: [skills/photobooth-qr-generator/SKILL.md](./skills/photobooth-qr-generator/SKILL.md)
- **Purpose**: High-contrast QR generation pointing to `https://photobooth-viewer.vercel.app/?url={ENCODED_IMAGE_URL}&branded=true` with remote fallback.
- **Reusable module**: [qrService.ts](./skills/photobooth-qr-generator/examples/qrService.ts).

#### 6. `photobooth-metrics-api`
- **Location**: [skills/photobooth-metrics-api/SKILL.md](./skills/photobooth-metrics-api/SKILL.md)
- **Purpose**: Full Dashboard API integration: `GET /settings` cloud config sync, non-blocking `POST /generate` returning live `{ isActive, currentGenerations, dailyLimit, remaining }`, and Desktop-only `POST /print` copy tracking.
- **Reusable module**: [metricsService.ts](./skills/photobooth-metrics-api/examples/metricsService.ts).

#### 7. `photobooth-3d-scene-optimization`
- **Location**: [skills/photobooth-3d-scene-optimization/SKILL.md](./skills/photobooth-3d-scene-optimization/SKILL.md)
- **Purpose**: Three.js & React Three Fiber non-PBR material tuning (`metalness = 0`, `roughness = 1`) and constant ambient lighting for integrated kiosk GPUs.

---

### Desktop-Only Skills (`projectType === 'desktop'`)

#### 8. `photobooth-operator-settings`
- **Location**: [skills/photobooth-operator-settings/SKILL.md](./skills/photobooth-operator-settings/SKILL.md)
- **Purpose**: `F2` local operator modal implementing the strict **2-Layer Configuration Split** (`cloud-config.cache.json` read-only from Dashboard `GET /settings` vs. local `operator-settings.json` for camera, printer priority list, print padding, timers, and OpenAI quality).

#### 9. `photobooth-photo-printing`
- **Location**: [skills/photobooth-photo-printing/SKILL.md](./skills/photobooth-photo-printing/SKILL.md)
- **Purpose**: Silent borderless 4x6 dye-sublimation printing for DNP DP-QW410 and Canon SELPHY CP printers, ready-first / busy-queue routing, and independent print-only padding.

#### 10. `photobooth-electron-packaging`
- **Location**: [skills/photobooth-electron-packaging/SKILL.md](./skills/photobooth-electron-packaging/SKILL.md)
- **Purpose**: Vite + Electron configuration to package single-folder/portable Windows EXEs and macOS DMGs.

---

## Syncing Skills Into Global Antigravity Config (`~/.gemini/config/skills/`)

After pulling updates in this repository, sync all 10 skills to your machine's global Antigravity skills folder:

```powershell
Copy-Item -Recurse -Force "D:\5DVR\Projects\5dvr-photobooth-skills\skills\*" "$env:USERPROFILE\.gemini\config\skills\"
```

Or mount this repository as `.agents` inside any team project:
```bash
git submodule add https://github.com/ehabayman-5dvr/5dvr-photobooth-skills.git .agents
```
