---
name: photobooth-model-providers
description: Integrate selectable GPT and Gemini Nano Banana image generation in a photobooth, including provider credentials, cancellation, prompt logging, and output normalization.
---
# Photobooth image providers

Use a provider adapter behind the booth bridge: generation accepts the capture, selected theme and participant analysis, and returns an image data URL. Share prompt construction and provider helpers between Electron main and any explicitly enabled local browser trial. Keep production web credentials server-side; browser trial credentials must not enter the production bundle.

## Model selection and requests

Treat display names, provider IDs, endpoint and capability settings as a model registry. The AHK project used GPT Image 2.5 Flare, GPT Image 2, GPT Image 1.5 and Gemini Nano Banana 2.1. These are project observations, not a promise of future availability or relative speed: verify official provider documentation before enabling a model for another event.

- OpenAI adapter: multipart image edits with reference image, crafted prompt, portrait size and model-supported quality/output options. In AHK, `input_fidelity=high` was applied only to GPT Image 1.5; do not send unsupported parameters to every GPT model.
- Gemini adapter: separate Gemini key and request/response parser. AHK used Interactions with text plus inline reference image, JPEG image response, 2:3, 1K, minimal thinking, and `store: false`. Its PNG response setting returned HTTP 400; use a supported MIME type for the selected endpoint/model. Do not copy a `generateContent` parser into an Interactions request.
- Normalize supported returned PNG/JPEG bytes to data URLs. Reject missing image output and unsupported formats. Keep the source photo and identity directive in every provider path.
- Validate the key for the selected provider when enabling live mode. A saved Gemini key must not fail because OpenAI is empty, and vice versa. Keep quality controls conditional on provider support.

## Generation lifecycle

Acquire one generation guard before asynchronous work. Give each request an AbortController and timeout; cancel on retake/cancel. Release guards and timers in `finally`, and ignore stale responses after the participant moves on. Do not automatically retry paid image generation: an ambiguous failure may already have incurred a charge.

Advance the theme variation only on success. AHK uses five scene/outfit pairs per era, in sequence, wrapping at five and resetting when the selected era changes. Treat that policy and number as event configuration, not randomness or a universal requirement.

Log the final exact prompt immediately before sending it, with model, theme, variation, quality and participant summary. Color/group console logs for operators; omit keys, auth headers and base64 photos. The reference image remains authoritative when local analysis is uncertain.

Verify both adapters with mocked successful, missing-output, HTTP-error and cancelled requests. Check provider-specific credentials, no duplicate paid requests, variation progression, and production bundle exclusion of trial credentials.
