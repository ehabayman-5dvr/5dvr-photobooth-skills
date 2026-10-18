---
name: photobooth-operator-settings
description: Build an F2 operator settings panel for Electron photobooths with persistent provider keys, camera controls, printer priority lists, print padding, sharing and event metrics.
---
# Operator settings

F2 opens the operator panel from any booth screen through a narrow preload IPC bridge. Provide a scrollable, keyboard-accessible form with Save/Cancel, visible save errors and disabled duplicate submission. Preserve the participant flow when closing settings; save successfully before returning to kiosk mode. Keep attendee text unselectable while allowing form fields to be selected and edited.

## Settings contract

Keep defaults, renderer types, main-process validation, serialization and env seeding in agreement. Additive fields need fallback values so old configs still load.

- Generation: preview/live mode, model, provider-specific key fields, supported quality.
- Camera: device, rotation and mirroring. Physical kiosk mounting varies; do not force -90 degrees on every event.
- Printing: ordered array of printer device names, add/remove/reorder/refresh, state and queued-job indicators, missing-device entries retained visibly. Deduplicate names and migrate legacy single-printer settings. See [printing skill](../photobooth-photo-printing/SKILL.md).
- Independent top/bottom print padding, both 0 by default. AHK accepts integer pixels 0-300 on a 1200x1800 print canvas. Bounds are tied to the output profile.
- Delivery: Cloudinary config/event folder, HTTPS viewer URL, dashboard project ID and deployed dashboard base URL where configurable.
- Result timeout and any event-specific operational controls.

Validate again in Electron main, not only HTML inputs. Retain stored keys when password fields are left blank; send only key-presence flags back to the renderer, never stored credential values. Validate only the selected provider's key for live generation. Printer enumeration failures must leave the panel usable.

## Persistence and first-run experience

For portable booths, agree where `operator-config.json` lives. AHK uses the executable folder, or `PORTABLE_EXECUTABLE_DIR` for a portable launcher, rather than AppData or a temporary extraction folder. An unpacked folder moved to another laptop must retain all configuration.

Seed from local env during packaging into bundled defaults using an explicit setting/secret allowlist, then materialize the editable config at runtime. A packaged app cannot read the developer's `.env.local` after transfer. Preserve existing operator edits and nonempty keys; fill missing values instead of resetting the entire config on every start. Handle malformed config with an actionable error and atomic replacement on successful saves.

Windows safeStorage encryption is user/machine-bound: copied ciphertext may be unreadable on another laptop. AHK explicitly chose readable portable keys for a controlled event; that decision is not authorization to ship plaintext keys in another project. Choose machine-local provisioning, a backend, or explicitly approved readable portable configuration based on that project's requirements. Keep credentials out of Git, logs and web bundles regardless.

Verify a packaged first launch without env or preexisting config, F2 save/restart, empty-secret config recovery, preservation of edited values, selected-provider validation and transfer to a clean destination. See [packaging skill](../photobooth-electron-packaging/SKILL.md).
