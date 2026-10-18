---
name: photobooth-metrics-api
description: Integrate non-blocking per-project generation counters with the 5DVR photobooth dashboard, including endpoint configuration, success/failure logs and duplicate-count avoidance.
---
# Dashboard generation metrics

Configure the event's project UUID and deployed dashboard base URL. Never default to a previous event's UUID. AHK discovered that the old host omitted `-brown`; its working target was `https://ai-photobooth-dashboard-brown.vercel.app/api/projects/{projectId}/generate`. Treat the host as deployment configuration and verify the next event's endpoint rather than assuming that URL is permanent.

Send one POST after each successful live AI generation, independent of archive/upload/QR/print success. Preview mode, failed/cancelled requests, reprints and upload retries must not count. Do not couple metrics to a per-provider UI path that can fire twice. Use a bounded timeout and catch HTTP failures as well as network failures. Log confirmation or a concise warning without delaying photo delivery or exposing secrets.

Payload fields used by AHK: `presetName`, `provider` (`openai` or `gemini`), and numeric `timestamp`. Preserve other API-supported metadata when needed; omit photo bytes. Encode the project ID in the URL. Keep the browser trial CSP in sync with the configured dashboard origin; Electron main requests do not depend on the renderer CSP.

A timeout may mean the server counted the request but the response was lost. Do not automatically retry increments without server-supported idempotency/event IDs. A durable offline queue requires an explicit deduplication contract; logging failure alone is not guaranteed delivery.

Use [metricsService.ts](examples/metricsService.ts) for the reusable helper. Call it without awaiting it on the photo-delivery path. Test endpoint, payload, one submission and failure behavior with mocked fetch. A GET returning 405 only confirms routing, not that POST increments; validate a real count using an authorized generation or an explicitly approved test increment.
