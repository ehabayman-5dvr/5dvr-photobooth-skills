/**
 * Reusable Production Cloudinary Upload Service for Photobooths
 */

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  defaultFolder?: string;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
}

/**
 * Computes SHA-1 hex hash using Web Crypto API
 */
async function generateSha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolves Cloudinary configuration from environment variables
 */
export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName =
    (typeof process !== 'undefined' && (process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME)) || '';
  const apiKey =
    (typeof process !== 'undefined' && (process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY)) || '';
  const apiSecret =
    (typeof process !== 'undefined' && (process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET)) || '';

  return {
    cloudName,
    apiKey,
    apiSecret,
    defaultFolder: 'Photobooth-Captures',
  };
}

/**
 * Uploads an image to Cloudinary using direct signed authentication
 */
export async function uploadPhotoboothImage(
  imageSrc: string,
  folderName?: string,
  customConfig?: CloudinaryConfig
): Promise<CloudinaryUploadResult> {
  const config = customConfig || getCloudinaryConfig();
  const folder = folderName || config.defaultFolder || 'Photobooth-Captures';

  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new Error(
      '[Cloudinary] Missing configurations: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET'
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();

  const paramsToSign: Record<string, string> = {
    folder,
    timestamp,
  };

  const sortedParamsString = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join('&');

  const stringToSign = `${sortedParamsString}${config.apiSecret}`;
  const signature = await generateSha1(stringToSign);

  const formData = new FormData();
  formData.append('file', imageSrc);
  formData.append('api_key', config.apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;

  let responseData: any = null;
  let lastError: any = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
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
