# Guide: Initiating & Using 5DVR Photobooth Skills in a New Project

This guide explains how to launch a new **Desktop Kiosk** or **Web Photobooth** using the **5DVR AI Photobooth Dashboard (`Developer` Tab)**, `/grill-me`, and your global photobooth skills.

---

## 1. Recommended Workflow: Dashboard `.md` Guide + `/grill-me`

Every new photobooth starts from the **5DVR AI Photobooth Dashboard**:

1. **Create the Project on the Dashboard**:
   - Choose Platform Type (**Desktop** Kiosk vs. **Web** App), select the locked **AI Model** (`OpenAI` or `Gemini`), pick the **Cloudinary Account & Folder**, and set the **Portrait Limit** and **Reference Image Count**.
2. **Download the Agent Integration `.md` Guide**:
   - Open the project's **Developer** tab (Admin-only) and click **Download `.md` guide** (or **Copy for AI agent**).
   - Zero API keys are hardcoded in the `.md` file — all credentials sync dynamically from `GET /api/projects/{id}/settings`.
3. **Run `/grill-me` in Antigravity**:
   - Open your new project folder in Antigravity IDE, type **`/grill-me`**, and attach/paste the downloaded `.md` file!
   - Antigravity will **interview you first** on every hidden project detail before writing code:
     - Single theme vs. Multi-Era / Mode selection screen (`era_selection`)
     - 1-Image capture vs. Dual-Image (`IMAGE 1` guest + `IMAGE 2` empty monument/scene plates in `public/assets/Era-References/`)
     - **Framing Mode**: Ornate PNG Frame (`15%/12%` safe zone + BFS outer-alpha mask) vs. Logo Badges Only vs. Full-Bleed Unframed
     - Supplied screen/frame/video assets vs. custom UI design
     - 2D vs. 3D countdown & loading visuals
     - *(Desktop only)* Camera mount rotation (`-90°` vs `0°`) and printer model (`DNP DP-QW410` / `Canon SELPHY`)

---

## 2. Installed Global Skills (`~/.gemini/config/skills/`)

Antigravity automatically discovers all 10 skills in `C:\Users\<User>\.gemini\config\skills\` (or `.agents/skills/` when mounted via Git submodule):

| Skill | Platform | Purpose |
| :--- | :--- | :--- |
| `photobooth-screen-flow` | Desktop & Web | 6-screen state machine, `/grill-me` discovery protocol, 5s preview auto-proceed, and conditional frame/logo compositing. |
| `photobooth-face-prompt-crafting` | Desktop & Web | `face-api.js` (`SSD MobileNet V1`) + 7-block `Egyptian-Museum` prompt engine (1 or 2 images, soft-hint headcount, hijab/uncovered split, conditional frame safe area). |
| `photobooth-model-providers` | Desktop & Web | OpenAI (`/v1/images/edits`) & Gemini (`/v1beta/interactions`) adapters driven by Dashboard `GET /settings`. |
| `cloudinary-photobooth-upload` | Desktop & Web | Signed `SHA-1` upload with 900-char `prompt_0, prompt_1...` context chunking for the Dashboard Gallery `ⓘ` drawer + 3x retry. |
| `photobooth-qr-generator` | Desktop & Web | High-contrast QR codes linking to `https://photobooth-viewer.vercel.app/?url=...&branded=true`. |
| `photobooth-metrics-api` | Desktop & Web | `GET /settings` cloud sync, `POST /generate` live counter/gate sync, and Desktop `POST /print` print counter. |
| `photobooth-3d-scene-optimization` | Desktop & Web | Non-PBR Three.js / R3F material pipeline & constant lighting for integrated GPUs. |
| `photobooth-operator-settings` | **Desktop Only** | `F2` local hardware/printer/camera/timer modal (`operator-settings.json`) separated from `cloud-config.cache.json`. |
| `photobooth-photo-printing` | **Desktop Only** | Silent borderless 4x6 printing (`DNP QW410` / `Canon SELPHY`), ready/busy routing, and print-only padding. |
| `photobooth-electron-packaging` | **Desktop Only** | Portable Windows `.exe` and macOS `.dmg` bundling and clean-machine verification. |

---

## 3. Step-by-Step: Starting a Fresh Project

### Step 1: Scaffold the App
```bash
# Desktop Kiosk (Vite + React + TypeScript + Electron)
npm create vite@latest My-New-Photobooth -- --template react-ts
cd My-New-Photobooth
npm install
```
*(For a **Web Photobooth**, use Next.js App Router so `GET /settings` and AI provider calls run securely on the server.)*

### Step 2: (Optional) Mount Skills as a Git Submodule for Teammates
```bash
git submodule add https://github.com/ehabayman-5dvr/5dvr-photobooth-skills.git .agents
```

### Step 3: Minimal `.env.local` (Zero Hardcoded API Keys!)
Copy the 2-line `.env.local` snippet from your project's **Developer** tab on the Dashboard:

- **Desktop Kiosk (`.env.local`)**:
  ```env
  VITE_DASHBOARD_URL=https://ai-photobooth-dashboard.vercel.app
  VITE_DASHBOARD_PROJECT_ID=your-project-uuid
  ```
- **Web App Server (`.env.local`)**:
  ```env
  DASHBOARD_URL=https://ai-photobooth-dashboard.vercel.app
  DASHBOARD_PROJECT_ID=your-project-uuid
  ```

### Step 4: Kick Off with `/grill-me` + Integration `.md`
Type `/grill-me` in Antigravity and attach `<project-slug>-agent-integration.md` (plus drop any client frames, logos, or `Era-References` images into `public/assets/`). Answer the agent's discovery questions, review the plan, and let Antigravity build and type-check the complete application!

---

## 4. Pre-Event Handoff Checklist (Desktop Kiosks)

Before shipping a Desktop Kiosk `.exe`:
1. Build the actual Electron artifact and launch it from a clean folder.
2. Verify `GET /settings` populates `cloud-config.cache.json` and that booting offline falls back cleanly to `cloud-config.cache.json` without overwriting `operator-settings.json`.
3. Verify `F2` displays the locked Dashboard AI model & Cloudinary folder as read-only and saves camera rotation, printer priority list, and print padding locally.
4. Run one live test generation and verify:
   - Portrait appears in the Dashboard **Gallery** tab.
   - Clicking `ⓘ` in the Dashboard Gallery shows the complete **Full Generation Prompt** (`prompt_0`, `prompt_1`, ...).
   - Dashboard portrait count increments via `POST /generate` (and physical print count increments via `POST /print`).
   - Toggling the project to **Finished** on the Dashboard disables new sessions on the booth.
