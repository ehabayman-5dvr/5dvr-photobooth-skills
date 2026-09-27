---
name: photobooth-metrics-api
description: >-
  Integrates the 5DVR Photobooth Dashboard Metrics API to track and increment photo generation
  counts per project on the centralized live dashboard.
---

# Photobooth Metrics & Photo Counter API Skill

This skill explains how to integrate and manage the centralized 5DVR Photobooth Dashboard API (`ai-photobooth-dashboard.vercel.app`). It covers configuration of project IDs, non-blocking counter increments, telemetry logging, and offline resilience.

## Overview & Architecture

Every photobooth installation connects to a unique project dashboard on:
```
https://ai-photobooth-dashboard.vercel.app/api/projects/{PROJECT_ID}/generate
```

When an image is successfully synthesized by Gemini, OpenAI, or Stable Diffusion, the client invokes this endpoint to increment the live generation counter displayed on event organizers' metric monitors.

```
[Successful Image Generation]
           │
           ▼
[Dispatch Increment Request (POST)] ──► Non-blocking background call
           │
           ├──► Success (HTTP 200/201): Logs confirmation, updates session counter
           └──► Error / Offline (HTTP 4xx/5xx/Network Error):
                   - Catches error silently
                   - Logs warning without interrupting participant UI
```

## Configuration

In `.env.local` or environment configs:

```env
# Specific Project UUID registered in https://ai-photobooth-dashboard.vercel.app
VITE_DASHBOARD_PROJECT_ID=578767e9-95d0-4a7f-9383-fdc0d5e22c5a
# Or for non-Vite/Node/Electron environments:
DASHBOARD_PROJECT_ID=578767e9-95d0-4a7f-9383-fdc0d5e22c5a
```

## Standard Service Implementation (`metricsService.ts`)

```typescript
export interface GenerationMetricPayload {
  presetName?: string;
  faceCount?: number;
  provider?: 'gemini' | 'openai' | 'local';
  timestamp?: number;
}

const DEFAULT_PROJECT_ID = '578767e9-95d0-4a7f-9383-fdc0d5e22c5a';

/**
 * Retrieves the active project ID from environment variables with fallback
 */
export function getDashboardProjectId(): string {
  if (typeof process !== 'undefined' && process.env?.VITE_DASHBOARD_PROJECT_ID) {
    return process.env.VITE_DASHBOARD_PROJECT_ID;
  }
  if (typeof process !== 'undefined' && process.env?.DASHBOARD_PROJECT_ID) {
    return process.env.DASHBOARD_PROJECT_ID;
  }
  // @ts-ignore (Vite import.meta.env support)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DASHBOARD_PROJECT_ID) {
    // @ts-ignore
    return import.meta.env.VITE_DASHBOARD_PROJECT_ID;
  }
  return DEFAULT_PROJECT_ID;
}

/**
 * Increments the generated photos count on the dashboard.
 * Designed to be non-blocking and safe against network drops.
 */
export const incrementGeneratedCount = async (
  payload?: GenerationMetricPayload,
  customProjectId?: string
): Promise<boolean> => {
  const projectId = customProjectId || getDashboardProjectId();
  const endpoint = `https://ai-photobooth-dashboard.vercel.app/api/projects/${projectId}/generate`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });

    if (!response.ok) {
      console.warn(`[Dashboard] Failed to increment count: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`[Dashboard] Successfully incremented generation count for project [${projectId}]`);
    return true;
  } catch (error) {
    // Non-blocking: Photobooth must continue uninterrupted even if telemetry is down
    console.error('[Dashboard] Error calling increment API:', error);
    return false;
  }
};
```

## Integration Points

1. **AI Generation Services (`geminiService.ts`, `openaiService.ts`)**:
   Always call `incrementGeneratedCount()` immediately after receiving the valid base64 or URL from the AI provider:
   ```typescript
   // After successful AI synthesis
   incrementGeneratedCount({
     presetName: preset.name,
     faceCount: faceData.totalPeople,
     provider: 'gemini'
   });
   ```

2. **Electron Host Events (`hostBridge.ts`)**:
   Emit `PHOTO_GENERATED` to notify any local kiosks, LED wall relays, or local counting files.

## Guidelines & Rules

- **Strict Non-blocking Guarantee**: Never `await` this call in a manner that delays rendering the `ResultScreen` or loading screens. The participant must see their photo instantly.
- **Fail-safe Catch**: The fetch call must be wrapped in `try/catch` and never throw uncaught exceptions to the caller.
- **Unique Project ID**: When initializing a new photobooth project for a new event (e.g. Tech Expo, Brand Activation, Corporate Conference), register or configure the new project UUID in `.env.local`.
