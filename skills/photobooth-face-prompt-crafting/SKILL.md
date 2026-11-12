---
name: photobooth-face-prompt-crafting
description: >-
  Client-side face, age, and gender detection via TensorFlow.js and face-api.js, and dynamic
  7-block prompt engineering (supporting 1-image or dual-image scene reference plates, soft-hint headcount,
  1:1 facial identity, hijab/uncovered hair rules, modesty lock, and conditional frame safe areas).
---

# Photobooth Face Detection & 7-Block Prompt Crafting Skill

This skill defines client-side face, age, and gender analysis (`face-api.js` + `SSD MobileNet V1`) paired with the **5DVR 7-Block Prompt Crafting Engine** (proven in production on `Egyptian-Museum-Photobooth` and `AHK`). It supports both **1-image identity prompts** and **Dual-Image (`IMAGE 1` guest capture + `IMAGE 2` empty scene/monument plate)** workflows while enforcing **1:1 facial identity**, zero morphing/beautification, strict modesty, cultural/religious headcover preservation for women, and **conditional safe-area framing** (for framed, logo-only, or unframed booths).

## System Architecture

```
[Webcam / Camera Canvas Capture]
  └── Upright Portrait Frame (e.g. 1080x1920) matching physical camera rotation
              │
              ▼
[TensorFlow.js & face-api.js Engine]
  ├── Environment monkey-patching (Canvas, Image, Fetch)
  ├── Dual Model Sourcing: Local `./models` ──(Fallback)──► CDN Weights
  └── Detection Chain:
        ├── 1. SSD MobileNet V1 (high accuracy face detection)
        ├── 2. FaceLandmark68Net (facial landmark alignment)
        └── 3. AgeGenderNet (age estimation + gender classification)
              │
              ▼
[Soft-Hint Detection Summary]
  { maleCount, femaleCount, childCount, unknownCount, totalPeople }
              │
              ▼
[7-Block Dynamic Prompt Engine]
  ├── Block 1: Input Image Roles (IMAGE 1 Guest Capture + optional IMAGE 2 Empty Scene Plate)
  ├── Block 2: Soft-Hint Subject Directive ("detected at least X people; IMAGE 1 is SOLE authority")
  ├── Block 3: 1:1 Facial Identity & Expression Lock (zero beautification/morphing)
  ├── Block 4: Wardrobe & Headwear (Men/Boys + Women: (A) Hijab & Long Sleeves vs (B) Uncovered Hair)
  ├── Block 5: Strict Modesty & Anti-Topless Mandate (100% opaque chest/torso coverage)
  ├── Block 6: Solo vs. Group Pose & Theme Props (`scene.poseDirective`)
  └── Block 7: Environment + Conditional Safe Area (`ornate_frame` vs `logo_only` vs `unframed`)
              │
              ▼
[Provider Adapter (OpenAI `/v1/images/edits` or Gemini `/v1beta/interactions`)]
```

## Model Weights Setup

Store model weights locally in `public/models/` for offline Electron kiosk operation:
- `ssd_mobilenetv1_model-weights_manifest.json` (+ shard files)
- `face_landmark_68_model-weights_manifest.json` (+ shard files)
- `age_gender_model-weights_manifest.json` (+ shard files)

Use relative asset URLs (`./models`) so `file://` Electron builds resolve offline, with optional fallback to `https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights` in web/dev mode.

## 1. Environment Monkey-Patching & Backend Init

```typescript
import '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';

const ensureEnvPatched = () => {
  const nativeFetch = window.fetch ? window.fetch.bind(window) : undefined;
  try {
    faceapi.env.monkeyPatch({
      fetch: nativeFetch,
      Canvas: HTMLCanvasElement,
      Image: HTMLImageElement,
      createCanvasElement: () => document.createElement('canvas'),
      createImageElement: () => document.createElement('img'),
    });
  } catch (error) {
    console.warn('Failed to monkey patch face-api.js environment.', error);
  }
};

const ensureBackendReady = async (): Promise<void> => {
  try {
    await faceapi.tf.setBackend('webgl');
    await faceapi.tf.ready();
  } catch (error) {
    console.warn('WebGL init failed, falling back to CPU backend', error);
    await faceapi.tf.setBackend('cpu');
    await faceapi.tf.ready();
  }
};
```

## 2. Detection Pipeline with SSD MobileNet V1

> [!IMPORTANT]
> **Physical Camera Transform & Input Frame**:
> When a kiosk camera is mounted sideways (`-90°` or `90°`), always pass the **already rotated, upright portrait canvas** to `detectFaces`. Passing raw sideways frames causes severe face-detection misses. Never let failed/inconclusive face detection block capture or generation — return `null` or `unknownCount` so the prompt falls back cleanly to vision inspection of `IMAGE 1`.

```typescript
export interface FaceDetectionResult {
  maleCount: number;
  femaleCount: number;
  childCount: number;
  unknownCount: number;
  totalPeople: number;
}

export const detectFaces = async (
  element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  isLoaded: boolean
): Promise<FaceDetectionResult | null> => {
  if (!isLoaded) return null;

  try {
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    const results = await faceapi
      .detectAllFaces(element, options)
      .withFaceLandmarks()
      .withAgeAndGender();

    if (!results.length) return null;

    let maleCount = 0;
    let femaleCount = 0;
    let childCount = 0;
    let unknownCount = 0;

    results.forEach((res: any) => {
      const prob = typeof res.genderProbability === 'number' ? res.genderProbability : 1;
      const age = res.age ? Math.round(res.age) : 30;

      if (age < 15) {
        childCount++;
      } else if (prob < 0.65) {
        unknownCount++;
      } else if (res.gender === 'male') {
        maleCount++;
      } else {
        femaleCount++;
      }
    });

    return { maleCount, femaleCount, childCount, unknownCount, totalPeople: results.length };
  } catch (error) {
    console.warn('[Face Detection] Error during detection, falling back to vision:', error);
    return null;
  }
};
```

---

## 3. Paired Sequential Variation Engine (`SceneVariation` + `OutfitVariation`)

Structure each mode/era into aligned `SceneVariation[]` and `OutfitVariation[]` arrays:
1. **Sequential Cycling on Success**: Advance `(index + 1) % scenes.length` only when a generation succeeds.
2. **Mode/Era Switch Reset**: Reset `variationIndices[era] = 0` whenever the guest switches to a different mode/era.
3. **Visual Inspection of Reference Plates (`IMAGE 2`)**: Whenever a variation pairs with a local background/monument plate (`public/assets/Era-References/...`), the coding agent **must visually inspect that image file first** so `scene.description`, `scene.lighting`, `scene.poseDirective`, and any monochrome/sepia color-grade mandates match the exact plate!

```typescript
export type FramingMode = 'ornate_frame' | 'logo_only' | 'unframed';

export interface SceneVariation {
  id: string;
  name: string;
  landmark: string;
  description: string;
  lighting: string;
  poseDirective?: string;   // Solo (1 guest) vs. Group (2+ guests) pose & props
  referenceImage?: string;  // Optional IMAGE 2 empty scene/monument plate URL
}

export interface OutfitVariation {
  id: string;
  name: string;
  style: string;
  description: string;      // Shared base garments + FOR MEN / BOYS rules
  femaleNotes?: string;     // FOR WOMEN / GIRLS: (A) Hijab + opaque long sleeves vs (B) Uncovered natural hair
}
```

---

## 4. Conditional Safe-Area & Framing Rules (CRITICAL)

**Not all photobooth projects use border frames.** Always ask the developer during the pre-implementation interview which `FramingMode` applies, and tailor Block 7 (`COMPOSITION & SAFE AREA`) accordingly:

| `FramingMode` | When Used | Prompt Safe-Area Rule |
| :--- | :--- | :--- |
| **`'ornate_frame'`** | Project overlays a custom PNG border frame (`frame.png`) with top/bottom medallions or curved corners (e.g. `Egyptian-Museum`, `AHK`). | Enforce **at least `15%` from the top edge and `12%` from the side edges** (inspect the actual `frame.png` to verify thickness!) so crowns/heads/side guests are never occluded by medallions or side borders. Forbid AI-generated borders. |
| **`'logo_only'`** | Project composites only a corner or footer sponsor/event logo badge (no full border frame). | **Do NOT use `15%/12%` frame insets.** Keep natural portrait headroom (`~8%` top) and keep key props clear of the logo corner/footer. |
| **`'unframed'`** | Raw full-bleed portrait with no frame or logo overlay. | Natural full-bleed 2:3 framing (`~5–8%` edge breathing room on printed Desktop kiosks for borderless DNP/SELPHY overscan; zero inset on digital Web apps). |

---

## 5. Master 7-Block Prompt Builder Reference

```typescript
export function buildSubjectDirective(summary: FaceDetectionResult | null): string {
  if (!summary || summary.totalPeople < 1 || summary.totalPeople > 50) {
    return 'Local face analysis is unavailable or inconclusive. Inspect IMAGE 1 (the guest capture photo) directly using vision to determine the exact people count, ages, genders, and whether any woman wears a headcover/hijab or has uncovered hair, and preserve EVERY visible participant from IMAGE 1; do not assume a single person or omit anyone.';
  }

  const groups = (
    [
      [summary.maleCount, 'adult man', 'adult men'],
      [summary.femaleCount, 'adult woman', 'adult women'],
      [summary.childCount, 'child', 'children'],
      [summary.unknownCount || 0, 'person of uncertain gender', 'people of uncertain gender'],
    ] as Array<[number, string, string]>
  )
    .filter(([count]) => count > 0)
    .map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`);

  return `Local face analysis of IMAGE 1 detected at least ${summary.totalPeople} ${
    summary.totalPeople === 1 ? 'person' : 'people'
  } (${groups.join(', ')}) as a soft reference hint—additional participants may be present if a face was tilted or missed locally. IMAGE 1 is the SOLE authority for the true headcount: visually inspect IMAGE 1, count EVERY visible person, and include 100% of them together in the final scene. NEVER omit, drop, crop out, or merge any person from IMAGE 1, never change apparent age or gender presentation, and determine whether any participant wears a religious/cultural headcover strictly from IMAGE 1 (never add a hijab/veil when absent in IMAGE 1).`;
}

export function buildCompositionDirective(
  framingMode: FramingMode,
  isPrintedKiosk: boolean
): string {
  if (framingMode === 'ornate_frame') {
    return 'COMPOSITION & SAFE AREA: Output a single coherent 2:3 vertical portrait, never a collage. Keep all faces and headwear inside the central safe area, at least 15% from the top edge and 12% from the side edges to leave room for the custom overlay frame. Use natural skin texture, convincing ground/seat contact shadows, print-friendly brightness, and anatomically accurate hands. No added text, dates, logos, watermarks, bare chests, or borders—a custom frame will be applied separately.';
  }
  if (framingMode === 'logo_only') {
    return 'COMPOSITION & SAFE AREA: Output a single coherent 2:3 vertical portrait, never a collage. Use natural portrait framing with ~8% top headroom above heads/hair and keep key props clear of the logo badge area. Use natural skin texture, convincing contact shadows, print-friendly brightness, and anatomically accurate hands. No added text, dates, watermarks, bare chests, or borders.';
  }
  return `COMPOSITION & SAFE AREA: Output a single coherent 2:3 vertical full-bleed portrait, never a collage. ${
    isPrintedKiosk
      ? 'Keep ~6% breathing room from the outer edges to account for borderless printer overscan.'
      : 'Frame subjects naturally across the full portrait canvas with comfortable headroom.'
  } Use natural skin texture, convincing contact shadows, and anatomically accurate hands. No added text, dates, logos, watermarks, bare chests, or borders.`;
}

export function buildPhotoboothPrompt(params: {
  eventTitle: string;
  scene: SceneVariation;
  outfit: OutfitVariation;
  faceData: FaceDetectionResult | null;
  framingMode: FramingMode;
  isPrintedKiosk: boolean;
  customOverride?: string;
}): string {
  const { eventTitle, scene, outfit, faceData, framingMode, isPrintedKiosk, customOverride } = params;
  const outfitFull = outfit.femaleNotes ? `${outfit.description} ${outfit.femaleNotes}` : outfit.description;
  const sceneFull = `${scene.description} Lighting: ${scene.lighting}`;
  const lines: string[] = [];

  // Block 1: Input Image Roles (1-Image vs Dual-Image)
  if (scene.referenceImage) {
    lines.push(
      `Create one photorealistic portrait for ${eventTitle} using the two provided input images:`,
      `- IMAGE 1 (FIRST IMAGE — GUEST CAPTURE): The SOLE authority for the human subject(s)—their facial identity, exact number of people, apparent age, gender, skin tone, glasses, facial hair, and whether a female guest is wearing a hijab/headcover or has uncovered natural hair.`,
      `- IMAGE 2 (SECOND IMAGE — EMPTY SCENE / MONUMENT REFERENCE): An empty background plate containing NO people. Place or seat the guest(s) from IMAGE 1 naturally into the exact scene from IMAGE 2, preserving IMAGE 2's architecture, props, camera perspective, and lighting direction.`
    );
  } else {
    lines.push(
      `Create one photorealistic portrait for ${eventTitle}. IMAGE 1 (the input photo) is the sole identity reference for every human participant.`
    );
  }

  // Block 2: Soft-Hint Subject Directive
  lines.push(buildSubjectDirective(faceData));

  // Block 3: 1:1 Facial Identity Lock
  lines.push(
    `1:1 FACIAL IDENTITY LOCK: Keep EVERY participant from IMAGE 1 and the exact number of people in IMAGE 1. Preserve their exact facial identity, apparent age, natural skin tone (or matching monochrome/sepia tone if the scene specifies a vintage monochrome photograph), eye shape, eyelid folds, eyebrows, nose, jaw, lips, smile geometry, wrinkles, moles, facial hair, expression, and gaze. Do not beautify, smooth skin, morph or average faces, reshape faces, invent people, or change expressions.`
  );

  // Block 4: Wardrobe & Headwear
  lines.push(`WARDROBE & HEADWEAR (VISION-BASED BY SUBJECT IN IMAGE 1): ${outfitFull}`);

  // Block 5: Strict Modesty & Headcover Mandate
  lines.push(
    `STRICT MODESTY & HEADCOVER MANDATE: Every person (men, women, and children) MUST wear opaque, full-coverage garments covering the chest, torso, and stomach. Never render bare chests, shirtless males, or exposed midriffs. Keep every person's entire face, brow, and jawline 100% unobstructed. For women/girls: inspect IMAGE 1 directly—(A) if wearing a hijab/headscarf in IMAGE 1, preserve her headcover styled neatly to match the theme and render full-length opaque long sleeves; (B) if she has uncovered natural hair in IMAGE 1, preserve her natural hair texture, color, and volume (never add a hijab when absent in IMAGE 1).`
  );

  // Block 6: Iconic Pose & Props
  if (scene.poseDirective) {
    lines.push(`ICONIC POSE & PROPS: ${scene.poseDirective}`);
  }

  // Block 7: Environment + Conditional Safe Area
  lines.push(
    `ENVIRONMENT & LIGHTING: ${sceneFull}`,
    buildCompositionDirective(framingMode, isPrintedKiosk)
  );

  if (customOverride?.trim()) {
    lines.push(`Additional Event Directives: ${customOverride.trim()}`);
  }

  return lines.join('\n\n');
}
```

## General Theme Guardrails
- **Avoid Dark / Muddy Environments**: Keep environments bright, luminous, and print-friendly unless a specific night theme is requested (dark scenes print muddy on dye-sub paper).
- **Avoid Bulky Helmets / Visors**: Never cover faces, brows, or jawlines with space helmets, masks, or combat visors.
- **Styled Prompt Logging**: Log the final prompt immediately before sending to the provider (grouped with model, mode/era, variation number, quality, face summary, and `IMAGE 2` reference path—never logging API keys or base64 bytes).
