export interface DashboardCloudConfig {
  dashboardProjectId: string;
  projectName: string;
  isActive: boolean;
  dailyLimit: number;
  currentGenerations: number;
  projectType: 'desktop' | 'web';
  cloudinaryAccountId?: string | null;
  cloudinaryAccountLabel?: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  cloudinaryFolder: string;
  aiModelId: string | null;
  aiModelProvider: 'openai' | 'gemini';
  openaiModel: string;
  aiModelsList: string[];
  openaiApiKey: string;
  geminiApiKey: string;
  referenceImagesCount: number;
  totalPrintedCopies?: number;
}

export interface GenerateIncrementResponse {
  success: boolean;
  projectId: string;
  incrementedBy: number;
  isActive: boolean;
  currentGenerations: number;
  dailyLimit: number;
  remaining: number;
  timestamp: string;
}

function buildProjectEndpoint(dashboardBaseUrl: string, projectId: string, leaf: 'settings' | 'generate' | 'print'): string {
  const cleanBase = dashboardBaseUrl.trim().replace(/\/+$/, '');
  return `${cleanBase}/api/projects/${encodeURIComponent(projectId.trim())}/${leaf}`;
}

/**
 * Fetches read-only Cloud Project Config (`GET /api/projects/{id}/settings`).
 * Call on Desktop boot (caching to `cloud-config.cache.json`) or server-side in Web Apps.
 */
export async function fetchDashboardCloudConfig(
  projectId: string,
  dashboardBaseUrl: string,
  fetcher: typeof fetch = fetch
): Promise<DashboardCloudConfig> {
  if (!projectId.trim()) {
    throw new Error('Dashboard project ID is not configured.');
  }
  const url = buildProjectEndpoint(dashboardBaseUrl, projectId, 'settings');
  const res = await fetcher(url, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Dashboard settings fetch failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.settings as DashboardCloudConfig;
}

/**
 * Non-blocking `POST /api/projects/{id}/generate` after each successful live AI portrait generation.
 * Returns updated `{ isActive, currentGenerations, dailyLimit, remaining }` so the booth stays synced mid-event.
 */
export async function trackPhotoGeneration(
  projectId: string,
  dashboardBaseUrl: string,
  onCloudStateUpdate?: (patch: Pick<DashboardCloudConfig, 'isActive' | 'currentGenerations' | 'dailyLimit'>) => void,
  fetcher: typeof fetch = fetch
): Promise<GenerateIncrementResponse | null> {
  if (!projectId.trim()) return null;
  try {
    const url = buildProjectEndpoint(dashboardBaseUrl, projectId, 'generate');
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: Date.now() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[Dashboard] Generation count failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as GenerateIncrementResponse;
    if (data.success && onCloudStateUpdate) {
      onCloudStateUpdate({
        isActive: data.isActive,
        currentGenerations: data.currentGenerations,
        dailyLimit: data.dailyLimit,
      });
    }
    return data;
  } catch (error) {
    console.warn('[Dashboard] Generation count failed:', error);
    return null;
  }
}

/**
 * Non-blocking `POST /api/projects/{id}/print` for Desktop Kiosks when dispatching physical prints.
 */
export async function trackPhysicalPrint(
  copies: number,
  projectId: string,
  dashboardBaseUrl: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  if (!projectId.trim()) return;
  try {
    const url = buildProjectEndpoint(dashboardBaseUrl, projectId, 'print');
    await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copies: Math.max(1, Math.floor(copies || 1)) }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.warn('[Dashboard] Print count failed:', error);
  }
}
