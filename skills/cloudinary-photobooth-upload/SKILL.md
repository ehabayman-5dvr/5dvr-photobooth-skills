---
name: cloudinary-photobooth-upload
description: >-
  Direct client-side and Electron signed photo uploads to Cloudinary with SHA-1 signature
  generation, exponential backoff retries, and folder management for event photobooths.
---

# Cloudinary Photobooth Upload Skill

This skill documents the secure, signed Cloudinary direct upload flow for photobooth applications. It allows the frontend or Electron client to upload captured and generated photos directly to Cloudinary without requiring an intermediate backend server, while keeping uploads organized per event folder and resilient to erratic exhibition Wi-Fi.

## Architecture

```
[Synthesized / Captured Photo] (Base64 Data URI or Blob)
              │
              ▼
[Signature Generation] ──► Sorted params (`folder`, `timestamp`) + API Secret
              │           Hashed via Web Crypto API: `crypto.subtle.digest('SHA-1')`
              ▼
[Multipart FormData] ────► `file`, `api_key`, `timestamp`, `signature`, `folder`
              │
              ▼
[Cloudinary REST Upload] ─► POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload
              │
              ├──► Retry loop (3 attempts with exponential backoff: 2s, 4s, 8s)
              │
              ▼
[Upload Result] ─────────► Returns `secureUrl`, `publicId`, and links to QR code generation
```

## Environment Configuration

Store the credentials in `.env.local`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

For Vite applications, ensure your `vite.config.ts` or bundler exposes `process.env` or use `VITE_CLOUDINARY_*` prefix if needed.

## SHA-1 Signature Generation

Cloudinary signed uploads require an SHA-1 hex digest of alphabetically sorted parameters appended with the API Secret:

```typescript
async function generateSha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

> [!IMPORTANT]
> The parameters included in the signature string MUST be sorted alphabetically by key (e.g., `folder=...&timestamp=...`), and the API Secret is appended at the very end without an ampersand (`${sortedParams}${apiSecret}`). Do NOT include `file` or `api_key` in the signature string!

## Robust Upload Implementation with Exponential Backoff

```typescript
export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
}

export async function uploadToCloudinary(
  imageSrc: string,
  eventFolder: string
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
  const apiKey = process.env.CLOUDINARY_API_KEY || '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || '';

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('[Cloudinary] Missing configuration in environment variables');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();

  // 1. Sort parameters alphabetically
  const paramsToSign: Record<string, string> = {
    folder: eventFolder,
    timestamp,
  };

  const sortedParamsString = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join('&');

  // 2. Generate SHA-1 signature
  const stringToSign = `${sortedParamsString}${apiSecret}`;
  const signature = await generateSha1(stringToSign);

  // 3. Assemble Form Data
  const formData = new FormData();
  formData.append('file', imageSrc);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', eventFolder);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  let responseData: any = null;
  let lastError: any = null;
  const maxAttempts = 3;

  // 4. Retry loop with exponential backoff for unstable venue networks
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
```

## Best Practices for Event Photobooths

1. **Folder Per Event**: Set `folder` dynamically to the current event name (e.g. `'Tech-Summit-26'`, `'Annual-Gala'`, etc.) to prevent photos from different activations mingling together.
2. **Exhibition Wi-Fi Resilience**: Always use the 3-attempt exponential retry loop. Venue internet frequently experiences 1-2 second drops during peak visitor traffic.
3. **Payload Type**: Accepts standard Base64 Data URLs (`data:image/jpeg;base64,...`) or `Blob` / `File` objects directly. Base64 strings can be passed straight into `formData.append('file', imageSrc)`.
4. **Immediate QR Code Generation**: Pipe `uploadResult.secureUrl` straight into `photobooth-qr-generator` to display the QR code instantaneously.
