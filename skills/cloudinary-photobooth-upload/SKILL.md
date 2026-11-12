---
name: cloudinary-photobooth-upload
description: >-
  Direct signed photo uploads to Cloudinary (sourced from Dashboard GET /settings) with SHA-1
  signature generation, 900-char prompt context chunking (`prompt_0`, `prompt_1`, ...) for the
  Dashboard Gallery drawer, exponential backoff retries, and event folder tagging.
---

# Cloudinary Photobooth Upload Skill

This skill documents the signed Cloudinary upload flow for 5DVR photobooth applications. Generated portraits are uploaded directly to Cloudinary (from Electron/renderer on Desktop Kiosks, or from your server route on Web Apps) using credentials fetched dynamically from the **5DVR Dashboard (`GET /api/projects/{id}/settings`)** — zero hardcoded Cloudinary keys in `.env.local`!

## Architecture

```
[Dashboard Cloud Config (`GET /settings`)]
  └── `cloudinaryCloudName`, `cloudinaryApiKey`, `cloudinaryApiSecret`, `cloudinaryFolder`
              │
              ▼
[Prompt Context Chunker] ──► Splits `fullPrompt` into 900-char `prompt_0|prompt_1|...`
              │              (escapes `\`, `|`, `=` so Cloudinary context never truncates)
              ▼
[Signature Generation] ────► Alphabetically sorted params (`context`, `folder`, `tags`, `timestamp`)
              │              + `cloudinaryApiSecret` ──► Web Crypto `SHA-1`
              ▼
[Multipart FormData] ──────► `file`, `api_key`, `timestamp`, `signature`, `folder`, `tags`, `context`
              │
              ▼
[Cloudinary REST Upload] ──► POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload
              │              (3 attempts with exponential backoff: 2s, 4s, 8s)
              ▼
[Upload Result] ───────────► Appears in Dashboard Gallery + Portrait Details (`ⓘ`) Drawer + QR Viewer
```

---

## Prompt Context Chunking Contract (Mandatory for Dashboard Gallery `ⓘ` Drawer)

Cloudinary's `context` metadata enforces a ~1,000-character limit per key and uses `|` and `=` as structural delimiters. Because 7-block photobooth prompts are typically 1,800–3,500 characters, **always split the prompt into 900-character chunks (`prompt_0`, `prompt_1`, `prompt_2`, ...)** so the Dashboard's **Portrait Details (`ⓘ`)** drawer reconstructs and displays the complete `Full Generation Prompt`:

```typescript
export function buildCloudinaryContextString(
  fullPrompt?: string,
  extra?: Record<string, string | undefined>
): string {
  const sanitize = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/=/g, '\\=');

  const pairs: string[] = [];
  const trimmed = (fullPrompt || '').trim();
  if (trimmed) {
    const chunkSize = 900;
    for (let i = 0; i < trimmed.length; i += chunkSize) {
      const idx = Math.floor(i / chunkSize);
      pairs.push(`prompt_${idx}=${sanitize(trimmed.slice(i, i + chunkSize))}`);
    }
  }

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v && k !== 'prompt') {
        pairs.push(`${k}=${sanitize(v)}`);
      }
    }
  }

  return pairs.join('|');
}
```

---

## SHA-1 Signature Generation

> [!IMPORTANT]
> **Alphabetical Parameter Signing Rule**:
> Every non-file parameter appended to `FormData` (`context`, `folder`, `tags`, `timestamp`) **MUST** be included in `paramsToSign`, sorted **alphabetically by key**, joined with `&`, and concatenated directly with `apiSecret` (no trailing `&`). **Never** include `file` or `api_key` in the signed string!

```typescript
async function generateSha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

---

## Robust Signed Upload Implementation

See [cloudinaryService.ts](examples/cloudinaryService.ts) for the complete drop-in service supporting:
1. Credentials + `cloudinaryFolder` passed straight from `DashboardCloudConfig`.
2. Automatic `tags = folder` + chunked `context` (`prompt_0`, `prompt_1`, ... + optional `era` / `event` metadata).
3. 3-attempt exponential backoff (`2s`, `4s`, `8s`) for unstable exhibition Wi-Fi.
4. Direct handoff of `secureUrl` into `photobooth-qr-generator`.
