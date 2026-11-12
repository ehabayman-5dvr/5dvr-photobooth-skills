/**
 * Reusable Production Cloudinary Upload Service for 5DVR Photobooths
 * Designed to consume credentials & folder from DashboardCloudConfig (`GET /api/projects/{id}/settings`)
 * and attach chunked `prompt_0, prompt_1, ...` context for the Dashboard Gallery Portrait Details drawer.
 */

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

export interface CloudinaryUploadMetadata {
  prompt?: string;
  era?: string;
  event?: string;
  [key: string]: string | undefined;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
}

/**
 * Computes SHA-1 hex hash using Web Crypto API (works in Electron, modern browsers, and Node 20+)
 */
async function generateSha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Splits long prompts into 900-char `prompt_0`, `prompt_1`, ... context keys and escapes `\`, `|`, `=`
 */
export function buildCloudinaryContextString(metadata?: CloudinaryUploadMetadata): string {
  if (!metadata) return '';
  const sanitize = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/=/g, '\\=');

  const pairs: string[] = [];
  const trimmedPrompt = (metadata.prompt || '').trim();
  if (trimmedPrompt) {
    const chunkSize = 900;
    for (let i = 0; i < trimmedPrompt.length; i += chunkSize) {
      const idx = Math.floor(i / chunkSize);
      pairs.push(`prompt_${idx}=${sanitize(trimmedPrompt.slice(i, i + chunkSize))}`);
    }
  }

  for (const [k, v] of Object.entries(metadata)) {
    if (k !== 'prompt' && v) {
      pairs.push(`${k}=${sanitize(v)}`);
    }
  }

  return pairs.join('|');
}

/**
 * Uploads a generated portrait to Cloudinary using signed authentication, tags, and chunked prompt context.
 */
export async function uploadPhotoboothImage(
  imageSrc: string,
  config: CloudinaryConfig,
  metadata?: CloudinaryUploadMetadata
): Promise<CloudinaryUploadResult> {
  const folder = (config.folder || 'Photobooth-Captures').trim();

  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new Error('[Cloudinary] Missing cloudName, apiKey, or apiSecret from Dashboard cloudConfig');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const contextString = buildCloudinaryContextString(metadata);

  const paramsToSign: Record<string, string> = {
    folder,
    tags: folder,
    timestamp,
  };
  if (contextString) {
    paramsToSign.context = contextString;
  }

  const sortedParamsString = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join('&');

  const signature = await generateSha1(`${sortedParamsString}${config.apiSecret}`);

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
  let responseData: any = null;
  let lastError: any = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', imageSrc);
      formData.append('api_key', config.apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);
      formData.append('tags', folder);
      if (contextString) {
        formData.append('context', contextString);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Cloudinary HTTP ${res.status}: ${errorText}`);
      }

      responseData = await res.json();
      if (responseData.secure_url || responseData.url) {
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Cloudinary Upload] Attempt ${attempt} failed:`, err);
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  const secureUrl = responseData?.secure_url || responseData?.url;
  if (!secureUrl) {
    throw lastError || new Error('Failed to retrieve hosted image URL from Cloudinary');
  }

  return {
    url: responseData.url || secureUrl,
    secureUrl,
    publicId: responseData.public_id || '',
  };
}
