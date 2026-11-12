---
name: photobooth-metrics-api
description: Integrate the 5DVR Photobooth Dashboard control-plane & telemetry endpoints (`GET /settings` cloud config sync, `POST /generate` portrait counter + live status, and Desktop `POST /print` physical print counter).
---
# 5DVR Photobooth Dashboard API (`settings`, `generate`, `print`)

Configure only the project's **Dashboard Base URL** and **Project UUID** in `.env.local` — never inherit a previous event's UUID and never hardcode OpenAI, Gemini, or Cloudinary keys in source files:

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

---

## 1. Cloud Configuration Sync — `GET /api/projects/{projectId}/settings`

- **Desktop Kiosk**: Call on boot (and when clicking **"Sync Cloud Config Now"** in `F2`), cache the response to `cloud-config.cache.json` for offline startup resilience, and **never** overwrite local `operator-settings.json`.
- **Web App**: Call **strictly on the server** (API route / Server Action) because the response includes `openaiApiKey` / `geminiApiKey` and `cloudinaryApiSecret`. Never expose `/settings` directly to browser DevTools.
- **Gate Enforcement**: Block new sessions whenever `!settings.isActive` (*"This event has finished"*) or `settings.currentGenerations >= settings.dailyLimit` (*"Portrait limit reached"*).

---

## 2. Portrait Counter & Live Status — `POST /api/projects/{projectId}/generate`

Call **once** immediately after each successful **live** AI portrait generation (never in Preview/Dry-Run mode, failed/cancelled generations, reprints, or Cloudinary upload retries).

- **Non-Blocking**: Never delay displaying the Result screen if venue Wi-Fi drops, and do **not** auto-retry timed-out `POST /generate` requests (the server may already have counted the request).
- **Live State Sync**: `POST /generate` returns the latest project status so mid-event changes on the Dashboard (e.g. toggling `Finished` or raising `dailyLimit`) propagate to the booth automatically without restarting:
  ```json
  {
    "success": true,
    "projectId": "uuid",
    "incrementedBy": 1,
    "isActive": true,
    "currentGenerations": 142,
    "dailyLimit": 500,
    "remaining": 358,
    "timestamp": "2026-11-12T12:00:00.000Z"
  }
  ```
  Use `{ isActive, currentGenerations, dailyLimit }` from the response to update the booth's in-memory `cloudConfig` (and `cloud-config.cache.json` on Desktop).

---

## 3. Physical Print Counter — `POST /api/projects/{projectId}/print` *(Desktop Kiosks Only)*

- **Scope**: **Desktop Kiosks ONLY** (`projectType === 'desktop'`). Web booths never print and never call `/print`.
- **When to Call**: Fire non-blocking whenever a physical print job is dispatched to the dye-sublimation printer, passing `{ copies: number }` (e.g. `{ "copies": 2 }`).

Use [metricsService.ts](examples/metricsService.ts) for ready-to-use TypeScript helpers covering all three endpoints.
