export interface FaceDetectionResult {
  maleCount: number;
  femaleCount: number;
  childCount: number;
  unknownCount?: number;
  totalPeople: number;
}

export type FramingMode = 'ornate_frame' | 'logo_only' | 'unframed';

export interface SceneVariation {
  id: string;
  name: string;
  landmark: string;
  description: string;
  lighting: string;
  poseDirective?: string;
  referenceImage?: string;
}

export interface OutfitVariation {
  id: string;
  name: string;
  style: string;
  description: string;
  femaleNotes?: string;
}

/**
 * Builds the soft-hint subject directive so vision models never drop a tilted/missed face.
 */
export function buildSubjectDirective(summary: FaceDetectionResult | null): string {
  if (
    !summary ||
    !Number.isInteger(summary.totalPeople) ||
    summary.totalPeople < 1 ||
    summary.totalPeople > 50
  ) {
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
  } (${groups.join(
    ', '
  )}) as a soft reference hint—additional participants may be present in IMAGE 1 if a face was partially turned or missed by the local detector. IMAGE 1 (the guest capture photo) is the SOLE authority for the true headcount: visually inspect IMAGE 1, count EVERY visible person, and include 100% of them together in the final scene. NEVER omit, drop, crop out, or merge any person from IMAGE 1 to match the local estimate, never change apparent age or gender presentation, and determine whether any participant wears a religious or cultural headcover strictly from IMAGE 1 (preserve any visible headcover for every participant in IMAGE 1, and never add a hijab/veil when absent in IMAGE 1).`;
}

/**
 * Builds the conditional composition & safe-area block based on whether the booth uses an
 * ornate overlay frame (`ornate_frame`), corner/footer logo badges (`logo_only`), or raw full-bleed (`unframed`).
 */
export function buildCompositionDirective(
  framingMode: FramingMode,
  isPrintedKiosk = true
): string {
  if (framingMode === 'ornate_frame') {
    return 'COMPOSITION & SAFE AREA: Output a single coherent 2:3 vertical portrait, never a collage. Keep all faces and headwear inside the central safe area, at least 15% from the top edge and 12% from the side edges to leave room for the custom overlay frame. Use natural skin texture, convincing lighting and ground/seat contact shadows, print-friendly brightness, and anatomically accurate hands. No added text, dates, logos, watermarks, bare chests, shirtless subjects, or borders—a custom frame will be applied separately.';
  }
  if (framingMode === 'logo_only') {
    return 'COMPOSITION & SAFE AREA: Output a single coherent 2:3 vertical portrait, never a collage. Use natural portrait framing with ~8% top headroom above heads/hair and keep key props clear of the logo badge area. Use natural skin texture, convincing contact shadows, print-friendly brightness, and anatomically accurate hands. No added text, dates, watermarks, bare chests, or borders.';
  }
  return `COMPOSITION & SAFE AREA: Output a single coherent 2:3 vertical full-bleed portrait, never a collage. ${
    isPrintedKiosk
      ? 'Keep ~6% breathing room from the outer edges to account for borderless dye-sub printer overscan.'
      : 'Frame subjects naturally across the full portrait canvas with comfortable headroom.'
  } Use natural skin texture, convincing contact shadows, and anatomically accurate hands. No added text, dates, logos, watermarks, bare chests, or borders.`;
}

/**
 * Assembles the full 7-block photobooth prompt supporting 1-image or 2-image (`IMAGE 2` scene plate) generation.
 */
export function buildPhotoboothPrompt(params: {
  eventTitle: string;
  scene: SceneVariation;
  outfit: OutfitVariation;
  faceData: FaceDetectionResult | null;
  framingMode: FramingMode;
  isPrintedKiosk?: boolean;
  customOverride?: string;
}): string {
  const {
    eventTitle,
    scene,
    outfit,
    faceData,
    framingMode,
    isPrintedKiosk = true,
    customOverride,
  } = params;

  const outfitFull = outfit.femaleNotes
    ? `${outfit.description} ${outfit.femaleNotes}`
    : outfit.description;
  const sceneFull = `${scene.description} Lighting: ${scene.lighting}`;
  const lines: string[] = [];

  if (scene.referenceImage) {
    lines.push(
      `Create one photorealistic portrait for ${eventTitle} using the two provided input images:`,
      `- IMAGE 1 (FIRST IMAGE — GUEST CAPTURE): The SOLE authority for the human subject(s)—their facial identity, exact number of people, apparent age, gender, skin tone, glasses, facial hair, and whether a female guest is wearing a hijab/headcover or has uncovered natural hair.`,
      `- IMAGE 2 (SECOND IMAGE — EMPTY SCENE / MONUMENT REFERENCE): An empty background plate of the exact setting containing NO people. Place or seat the guest(s) from IMAGE 1 naturally into the exact scene from IMAGE 2, preserving IMAGE 2's architecture, monuments/props, camera perspective, and lighting direction.`
    );
  } else {
    lines.push(
      `Create one photorealistic portrait for ${eventTitle}. IMAGE 1 (the input photo) is the sole identity reference.`
    );
  }

  lines.push(
    buildSubjectDirective(faceData),
    `1:1 FACIAL IDENTITY LOCK: Keep EVERY participant from IMAGE 1 and the exact number of people in IMAGE 1. Preserve their exact facial identity, apparent age, natural skin tone (or matching monochrome silver-gelatin sepia tone when the scene is a vintage B&W/sepia photograph), eye shape, eyelid folds, eyebrows, nose, jaw, lips, smile geometry, wrinkles, moles, facial hair, expression, and gaze. Do not beautify, smooth skin, morph or average faces, reshape faces, invent people, or change expressions. Keep each person immediately recognizable to themselves.`,
    `WARDROBE & HEADWEAR (VISION-BASED BY SUBJECT IN IMAGE 1): ${outfitFull}`,
    `STRICT MODESTY & HEADCOVER MANDATE: Every person (men, women, and children) MUST wear opaque, full-coverage garments covering the chest, torso, and stomach. Never render bare chests, shirtless males, or exposed midriffs. Keep every person's entire face, brow, and jawline 100% unobstructed and faithful to IMAGE 1. For women/girls: inspect IMAGE 1 directly—if a woman/girl in IMAGE 1 wears a hijab/headscarf, she MUST wear the specified hijab and full-length opaque long sleeves; if a woman/girl in IMAGE 1 has uncovered natural hair, preserve her natural uncovered hair texture, color, and volume (never add a hijab if she is not wearing one in IMAGE 1).`
  );

  if (scene.poseDirective) {
    lines.push(`ICONIC POSE & PROPS: ${scene.poseDirective}`);
  }

  lines.push(
    `ENVIRONMENT & LIGHTING: ${sceneFull}`,
    buildCompositionDirective(framingMode, isPrintedKiosk)
  );

  if (customOverride && customOverride.trim().length > 0) {
    lines.push(`Additional Event Directives: ${customOverride.trim()}`);
  }

  return lines.join('\n\n');
}
