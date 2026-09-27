---
name: photobooth-face-prompt-crafting
description: >-
  Client-side face, age, and gender detection via TensorFlow.js and face-api.js, and dynamic
  prompt engineering to enforce 1:1 facial identity, cultural/religious headcover preservation for women, and outfit/scene swaps.
---

# Photobooth Face Detection & Prompt Crafting Skill

This skill explains how to implement client-side face, age, and gender analysis and use the results to dynamically craft high-fidelity image generation prompts. It ensures that GenAI image generation models (Gemini Imagen, OpenAI DALL-E/GPT Image, Stable Diffusion) maintain **1:1 facial identity**, zero facial alteration, preserve cultural or religious headcovers for women (such as hijab, sheila, or headscarves) if worn in the capture, and seamlessly transform clothing and backgrounds.

## System Architecture

```
[Webcam / Camera Canvas Capture]
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
[Detection Result Data Structure]
  { maleCount: 1, femaleCount: 0, childCount: 0, totalPeople: 1 }
              │
              ▼
[Dynamic Prompt Crafting Engine]
  ├── 1. 1:1 Facial Identity Preservation Directive (zero morphing/beautification)
  ├── 2. Zero Expression Change Directive (exact smile & eye gaze)
  ├── 3. Scoped Transformation Directive (ONLY outfit and background change)
  ├── 4. Group / Individual Outfit Transformation & Variations
  ├── 5. Hair & Religious/Cultural Headcover Rules (Preserving hijab/sheila/headscarf for women if worn, or natural hair)
  └── 6. Lighting Harmonization & Ground Contact Shadows
              │
              ▼
[Template Injection] ──► Replaces `{{SUBJECT_DESCRIPTION}}` in preset prompt
              │
              ▼
[AI Model Generation] ──► Gemini Imagen 3 / OpenAI / SDXL
```

## Model Weights Setup

To ensure offline kiosk operation and quick loading, store the model weights in `public/models/`:
- `ssd_mobilenetv1_model-weights_manifest.json` (+ shard files)
- `face_landmark_68_model-weights_manifest.json` (+ shard files)
- `age_gender_model-weights_manifest.json` (+ shard files)

If local models fail or are not deployed, the service automatically falls back to:
`https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights`

## 1. Environment Monkey-Patching & Backend Init

`face-api.js` in Vite/Electron requires explicit monkey-patching of the browser/Node environment and WebGL backend initialization:

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
      createImageElement: () => document.createElement('img')
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

SSD MobileNet V1 is used instead of TinyFaceDetector because it eliminates false positives from background textures and accurately handles tilted heads in photobooths:

```typescript
export interface FaceDetectionResult {
  maleCount: number;
  femaleCount: number;
  childCount: number;
  totalPeople: number;
}

export const detectFaces = async (
  element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  isLoaded: boolean
): Promise<FaceDetectionResult> => {
  const fallback: FaceDetectionResult = { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };
  if (!isLoaded) return fallback;

  try {
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    
    // Chain tasks: detector -> landmarks -> age/gender
    let task: any = faceapi.detectAllFaces(element, options);
    task = task.withFaceLandmarks().withAgeAndGender();

    const results = await task;

    let maleCount = 0;
    let femaleCount = 0;
    let childCount = 0;

    results.forEach((res: any) => {
      const gender = res.gender || 'unknown';
      const age = res.age ? Math.round(res.age) : 30;

      if (age < 15) {
        childCount++;
      } else {
        if (gender === 'male') maleCount++;
        else femaleCount++;
      }
    });

    return { maleCount, femaleCount, childCount, totalPeople: results.length };
  } catch (error) {
    console.warn('[Face Detection] Error during detection, returning fallback:', error);
    return fallback;
  }
};
```

## 3. Dynamic Prompt Crafting Engine

The prompt engineering engine translates the detection result into unambiguous directives for the AI image generation model:

### Key Rules Enforced in Prompt:
1. **1:1 Facial Identity Preservation**: Explicitly forbid AI beautification, smoothing, reshaping, or model face averaging. Require exact eye shape, eyelid folds, jawline, lips, smile geometry, natural wrinkles, and facial hair (stubble/beards).
2. **Zero Expression Change**: Lock in the subject's natural emotional posture and mouth shape (e.g. open-lip smile or composed closed-lip look).
3. **Strict Scope**: Only change the outfit and background.
4. **Group Realism**: When `totalPeople > 1`, generate team harmony with realistic color variations and individual accessories rather than duplicate clones.
5. **Cultural & Religious Headcover Guidelines**:
   - If a female participant is wearing a religious or cultural headcover (such as a hijab, sheila, or headscarf) in the reference photo: faithfully preserve it cleanly draped and neatly tucked into the collar of the outfit.
   - If the participant has natural exposed hair: preserve hair texture, volume, color, and haircut faithfully.

## Example Prompt Injector Function

```typescript
export function buildSubjectDescription(
  faceData: FaceDetectionResult,
  themeConfig: { outfitName: string; outfitDescription: string; sceneName: string }
): string {
  const { maleCount = 0, femaleCount = 0, totalPeople = 1 } = faceData;
  const lines: string[] = [];

  let subjectSummary = '';
  if (maleCount > 0 && femaleCount > 0) {
    subjectSummary = `${maleCount === 1 ? '1 man' : `${maleCount} men`} and ${
      femaleCount === 1 ? '1 woman' : `${femaleCount} women`
    } (${totalPeople} people total)`;
  } else if (maleCount > 0) {
    subjectSummary = maleCount === 1 ? '1 man' : `${maleCount} men`;
  } else if (femaleCount > 0) {
    subjectSummary = femaleCount === 1 ? '1 woman' : `${femaleCount} women`;
  } else {
    subjectSummary = totalPeople === 1 ? '1 person' : `${totalPeople} people`;
  }

  lines.push(`CRITICAL DIRECTIVE - 1:1 FACIAL IDENTITY & ZERO ALTERATION:`);
  lines.push(`- The reference photo contains ${subjectSummary}. Maintain 100% exact facial identity, head shape, and facial features for ${totalPeople === 1 ? 'this person' : 'each person'}.`);
  lines.push(`- ABSOLUTE ZERO FACIAL ALTERATION: Strictly preserve every subject's authentic, natural facial identity without any modification, morphing, reshaping, AI beautification, or substitution. Every facial detail must remain 100% faithful to the source photo: exact eye shape, eyelid folds, eye gaze direction, eyebrows, nose structure and width, cheekbones, jawline, lips, smile/mouth geometry, skin complexion, skin texture, natural markings, wrinkles, moles, and facial hair (beards, mustaches, stubble).`);
  lines.push(`- ZERO EXPRESSION CHANGE: Preserve the subject's exact facial expression, mouth posture (smile level, open/closed lips), and eye gaze direction identically as in the reference image.`);
  lines.push(`- IMMEDIATE RECOGNIZABILITY: The subject must be immediately, flawlessly recognizable as the exact real person in the photograph.`);
  lines.push(`- SCOPE OF MODIFICATION: ONLY replace the outfit/clothing with the specified ${themeConfig.outfitName}, and ONLY replace the background with the ${themeConfig.sceneName} environment.`);

  lines.push(`\nOUTFIT TRANSFORMATION:`);
  lines.push(`- ${themeConfig.outfitDescription}`);

  lines.push(`\nHAIR & HEADCOVER SPECIFICATIONS:`);
  lines.push(`- If a female subject in the reference photo is wearing a religious or cultural headcover (such as a hijab, sheila, or headscarf), preserve it cleanly and elegantly draped and neatly tucked into the collar of the outfit.`);
  lines.push(`- If a subject has natural exposed hair, preserve their natural hair texture, color, and haircut faithfully.`);

  lines.push(`\nLIGHTING & COMPOSITION HARMONIZATION:`);
  lines.push(`- Seamlessly blend the subjects into the environment with authentic ambient lighting, soft directional highlights, and natural ground contact shadows.`);

  return lines.join('\n');
}
```
