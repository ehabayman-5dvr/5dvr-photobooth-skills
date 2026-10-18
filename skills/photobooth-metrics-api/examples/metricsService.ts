export interface GenerationMetricPayload {
  presetName?: string;
  faceCount?: number;
  provider?: 'gemini' | 'openai' | 'replicate' | 'local';
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

// Supply configuration from operator settings or an explicit env allowlist.
// No previous event UUID or hardcoded deployment fallback.
export async function trackPhotoGeneration(
  payload: GenerationMetricPayload,
  projectId: string,
  dashboardBaseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ success: boolean; status?: number; error?: string }> {
  if (!projectId.trim()) return { success: false, error: 'Dashboard project ID is not configured.' };
  try {
    const base = new URL(dashboardBaseUrl);
    if (base.protocol !== 'https:') throw new Error('Dashboard URL must use HTTPS.');
    const endpoint = new URL(`/api/projects/${encodeURIComponent(projectId.trim())}/generate`, base);
    const response = await fetcher(endpoint.href, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timestamp: payload.timestamp ?? Date.now() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.warn(`[Dashboard] Generation count failed: HTTP ${response.status}`);
      return { success: false, status: response.status };
    }
    console.info(`[Dashboard] Generation counted for project ${projectId}.`);
    return { success: true, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    console.warn('[Dashboard] Generation count failed:', message);
    return { success: false, error: message };
  }
}
