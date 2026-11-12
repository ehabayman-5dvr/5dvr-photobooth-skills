---
name: photobooth-model-providers
description: Integrate Dashboard-managed OpenAI GPT Image and Google Gemini Nano Banana image generation in Desktop or Web photobooths, supporting 1-image or dual-image scene references, cancellation, styled prompt logging, and output normalization.
---
# Photobooth Image Providers (OpenAI & Gemini Adapters)

Use a clean provider adapter that accepts:
1. `capturedImageBase64` (`IMAGE 1` — guest capture photo),
2. Optional `referenceImageUrl` (`IMAGE 2` — empty scene/monument plate from `SceneVariation.referenceImage`),
3. The crafted 7-block prompt string, and
4. Cloud + local config (`aiModelProvider`, locked `openaiModel`, provider API key from `DashboardCloudConfig`, and local OpenAI `imageQuality`),

and returns a normalized `data:image/(png|jpeg);base64,...` portrait.

---

## Cloud-Locked Model & Credential Routing

The active AI model and API key are **managed centrally on the 5DVR Photobooth Dashboard** and delivered via `GET /api/projects/{id}/settings`:
- **Desktop Kiosks (`desktop`)**: Read `aiModelProvider`, `openaiModel`, `openaiApiKey`, and `geminiApiKey` from `DashboardCloudConfig` (cached to `cloud-config.cache.json` for offline boot resilience), and call OpenAI / Gemini **directly from the booth** (never proxy multi-megabyte base64 images through the Dashboard backend).
- **Web Photobooths (`web`)**: Fetch `GET /settings` **strictly on your Web App's server route / Server Action** and call OpenAI / Gemini from your server — never expose provider API keys to the browser bundle.

### Provider Adapters

1. **OpenAI Images Edit Adapter (`aiModelProvider === 'openai'`)**:
   - **Endpoint**: `POST https://api.openai.com/v1/images/edits` (`Authorization: Bearer ${cloudConfig.openaiApiKey}`).
   - **Multipart `FormData`**:
     - `model`: `cloudConfig.openaiModel` (e.g. `gpt-image-2.6-flare`, `gpt-image-2.5-flare`, `gpt-image-2`, `gpt-image-1.5`).
     - `prompt`: full crafted prompt.
     - `image[]` (1st): Guest capture Blob (`capture.png` or `capture.jpg`) — **IMAGE 1**.
     - `image[]` (2nd, optional): Loaded scene/monument reference Blob (`reference.png` or `reference.jpg`) when `scene.referenceImage` is defined — **IMAGE 2**.
     - `size`: `'1024x1536'`, `output_format`: `'png'`, `n`: `'1'`, and `quality`: `localSettings.imageQuality` (`'low' | 'medium' | 'high'`).
   - **Parameter Hygiene**: Only send `input_fidelity=high` when the selected model explicitly supports it (e.g. `gpt-image-1.5`); never send unsupported flags universally across all GPT Image models.

2. **Google Gemini Interactions Adapter (`aiModelProvider === 'gemini'`)**:
   - **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/interactions` (`x-goog-api-key: ${cloudConfig.geminiApiKey}`).
   - **JSON Body**:
     - `model`: `cloudConfig.openaiModel` (the Dashboard's `openaiModel` field carries the active locked model ID for both providers, e.g. `gemini-nano-banana-2.1`).
     - `input`: `[{ type: 'text', text: prompt }, { type: 'image', mime_type, data: captureBase64 }, ...(referenceAsset ? [{ type: 'image', mime_type: referenceAsset.mimeType, data: referenceAsset.base64Data }] : [])]`.
     - `response_format`: `{ type: 'image', mime_type: 'image/jpeg', aspect_ratio: '2:3', image_size: '1K' }` *(Note: requesting PNG on Interactions returned HTTP 400 in AHK; use `image/jpeg` and normalize output to a data URL)*.
     - `generation_config`: `{ thinking_level: 'minimal' }`, `store: false`.
   - **Parser Rule**: Extract the last `{ type: 'image', data }` part from `data.steps.filter(s => s.type === 'model_output')`. Do not use a `generateContent` response parser on `/v1beta/interactions`. Ignore OpenAI's `imageQuality` field when routing to Gemini.

---

## Reference Plate Caching (`IMAGE 2`)

When `SceneVariation.referenceImage` is used, cache loaded local reference assets in memory (`Map<string, { blob, mimeType, base64Data }>`) so switching or cycling eras never re-fetches or re-encodes static monument plates on every session.

---

## Generation Lifecycle & Guardrails

1. **Event Gate Check First**: Before starting capture/generation, verify `cloudConfig.isActive === true` and `cloudConfig.currentGenerations < cloudConfig.dailyLimit`.
2. **Single-Flight Guard & Cancellation**: Acquire a single generation lock, attach an `AbortController` (e.g. 180s timeout), cancel cleanly if the guest/operator aborts, and release locks/timers in `finally`.
3. **Never Auto-Retry Paid Image Calls**: An ambiguous network timeout may already have billed the API key. Surface a clean "Retry or Retake Photo" UI action instead of silent background retries.
4. **Sequential Variation Advancement**: Advance the mode/era variation index **only after a successful generation** (and reset to `0` when the guest changes mode/era).
5. **Styled Operator Prompt Logging**: Immediately before firing the provider request, log a styled `console.group` showing `model`, `era/mode`, `variation`, `quality`, face detection summary, `IMAGE 2` reference path (if any), and the exact prompt text — **never** log API keys, auth headers, or base64 image payloads.
