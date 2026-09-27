# Guide: Initiating & Using Photobooth Skills in a New Project

This guide explains how Antigravity automatically detects your global photobooth skills and how to activate them effortlessly in any new project.

---

## 1. How Global Skills Work in Antigravity

All 6 photobooth skills are installed in the machine's Global Customizations directory:
```
C:\Users\<User>\.gemini\config\skills\
├── photobooth-qr-generator/
├── photobooth-metrics-api/
├── cloudinary-photobooth-upload/
├── photobooth-face-prompt-crafting/
├── photobooth-photo-printing/
└── photobooth-electron-packaging/
```

### Automatic Progressive Disclosure
1. Whenever you open **any new or existing directory** in Antigravity, the IDE scans `~/.gemini/config/skills/`.
2. Antigravity registers the `name` and `description` of each skill into the agent's memory.
3. When you give a prompt related to one of these tasks, the agent **automatically loads the full instructions, edge-case rules, and reusable code examples** from the skill.

---

## 2. Three Ways to Initiate Skills in a New Project

### Method A: Natural Language Prompting (Easiest & Recommended)
You do not need to remember exact commands. Simply tell Antigravity what you want to achieve, and it will automatically recognize and activate the corresponding global skill:

| What you want to do | Prompt to Antigravity | Activated Skill |
| :--- | :--- | :--- |
| **Share photo via QR** | *"Generate a QR code on the results screen that links attendees to the photobooth viewer."* | `photobooth-qr-generator` |
| **Track photos on Dashboard** | *"Connect our custom dashboard API to increment the photos count when an image is generated."* | `photobooth-metrics-api` |
| **Cloud photo storage** | *"Implement direct signed photo upload to Cloudinary for event folder 'Tech-Summit-26'."* | `cloudinary-photobooth-upload` |
| **Preserve faces & attire** | *"Set up face and age/gender detection with SSD MobileNet V1 to craft prompts that preserve 1:1 facial identity and religious/cultural headcovers for women if worn."* | `photobooth-face-prompt-crafting` |
| **Silent photo printing** | *"Configure borderless silent printing for our Canon Selphy CP1500 / DNP QW410 in Electron."* | `photobooth-photo-printing` |
| **Build portable kiosk app** | *"Configure Vite and Electron to package a single Windows portable EXE for the booth."* | `photobooth-electron-packaging` |

---

### Method B: Explicit Skill Invocation
You can explicitly name any skill in your conversation:
> *"Use the global `photobooth-qr-generator` skill to build `services/qrService.ts` with remote fallback."*
>
> *"Follow the `cloudinary-photobooth-upload` skill to handle image uploads and return the secure URL."*
>
> *"Apply the `photobooth-metrics-api` skill to track generation events with our project UUID."*

---

### Method C: One-Prompt Master Setup (Kickstart an Entire New Booth)
When you start a new empty project, paste this single prompt to have Antigravity scaffold all photobooth services at once:

```text
I am building a new AI Photobooth application for [Your Event Name]. 
Please import and integrate our global photobooth skills:
1. photobooth-face-prompt-crafting: Set up camera capture with face & age/gender analysis, 1:1 identity preservation, and religious/cultural headcover preservation for women if worn.
2. cloudinary-photobooth-upload: Create the direct signed upload service saving to folder '[Event-Folder-Name]'.
3. photobooth-qr-generator: Generate viewer QR codes pointing to the mobile photobooth viewer.
4. photobooth-metrics-api: Connect the generation counter API using Project ID '[YOUR-PROJECT-UUID]'.
5. photobooth-photo-printing: Configure borderless 4x6 dye-sublimation printing.

Scaffold the services, install necessary dependencies (qrcode, @tensorflow/tfjs, face-api.js), and verify TypeScript types.
```

---

## 3. Step-by-Step Walkthrough: Starting a Fresh Project

### Step 1: Initialize New Project
Open your terminal in your projects directory:
```bash
# Create a fresh Vite React + TypeScript project
npm create vite@latest My-New-Photobooth -- --template react-ts
cd My-New-Photobooth
npm install
```

### Step 2: Open in Antigravity
Open the newly created folder in Antigravity IDE:
- Antigravity immediately detects all 6 global photobooth skills in `~/.gemini/config/skills/`.

### Step 3: (Optional) Localize `.agents/` for Git Versioning
```powershell
# Copy global photobooth skills directly into the new project's .agents directory:
powershell -Command "New-Item -ItemType Directory -Force -Path '.agents\skills'; Copy-Item -Recurse -Force \"$env:USERPROFILE\.gemini\config\skills\photobooth-*\" '.agents\skills'; Copy-Item -Recurse -Force \"$env:USERPROFILE\.gemini\config\skills\cloudinary-*\" '.agents\skills'; Write-Host 'Photobooth skills imported into .agents\skills' -ForegroundColor Green"
```
This copies the runbooks and reusable templates into `./.agents/skills/` of your new project.

### Step 4: Configure `.env.local`
Create `.env.local` in your new project with your credentials:
```env
# AI Providers
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Dashboard Project ID (obtained from https://ai-photobooth-dashboard.vercel.app)
VITE_DASHBOARD_PROJECT_ID=your_project_uuid
```

### Step 5: Ask Antigravity to Implement
Prompt Antigravity with **Method A**, **Method B**, or **Method C**. Antigravity will:
1. Inspect the skill runbooks.
2. Pull the tested code from the skill examples (`qrService.ts`, `metricsService.ts`, `cloudinaryService.ts`, `faceService.ts`, `promptEngine.ts`).
3. Wire the components together seamlessly.
4. Run type-checks to guarantee 0 errors.
