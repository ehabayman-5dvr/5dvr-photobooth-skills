/**
 * Reusable Photobooth Metrics & Photo Count Increment Service
 * Compatible with Vite, Next.js, and Electron applications.
 */

export interface GenerationMetricPayload {
  presetName?: string;
  faceCount?: number;
  provider?: 'gemini' | 'openai' | 'replicate' | 'local';
  timestamp?: number;
  metadata?: Record<string, any>;
}

const FALLBACK_PROJECT_ID = '578767e9-95d0-4a7f-9383-fdc0d5e22c5a';

/**
 * Resolves project ID across various bundlers and execution environments
 */
export function resolveProjectId(): string {
  try {
    // 1. Process env (Node / Webpack / Electron / Next.js)
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_DASHBOARD_PROJECT_ID) return process.env.VITE_DASHBOARD_PROJECT_ID;
      if (process.env.DASHBOARD_PROJECT_ID) return process.env.DASHBOARD_PROJECT_ID;
    }

    // 2. Vite import.meta.env
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_DASHBOARD_PROJECT_ID) return import.meta.env.VITE_DASHBOARD_PROJECT_ID;
    }
  } catch (e) {
    // Ignore environment resolution errors
  }

  return FALLBACK_PROJECT_ID;
}

/**
 * Sends non-blocking increment request to 5DVR photobooth dashboard
 */
export async function trackPhotoGeneration(
  payload: GenerationMetricPayload = {},
  customProjectId?: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  const projectId = customProjectId || resolveProjectId();
  const endpoint = `https://ai-photobooth-dashboard.vercel.app/api/projects/${projectId}/generate`;

  const requestBody = {
    ...payload,
    timestamp: payload.timestamp || Date.now(),
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Dashboard] Failed to increment count: ${res.status} ${res.statusText}`, errText);
      return { success: false, status: res.status, error: errText };
    }

    console.log(`[Dashboard] Count incremented for project: ${projectId}`);
    return { success: true, status: res.status };
  } catch (error: any) {
    console.error('[Dashboard] Error connecting to increment API:', error?.message || error);
    return { success: false, error: error?.message || 'Network error' };
  }
}
