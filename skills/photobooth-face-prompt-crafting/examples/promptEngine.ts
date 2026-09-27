import { FaceDetectionResult } from './faceService';

export interface PhotoboothThemeData {
  name: string;
  outfitDetails: string;
  environmentDescription: string;
  lightingDescription?: string;
  promptInstructions: string; // Template containing {{SUBJECT_DESCRIPTION}}
}

/**
 * Builds the comprehensive subject description block enforcing:
 * - 1:1 Facial Identity & Zero Alteration
 * - Zero Expression Change
 * - Selective Outfit & Background Replacement
 * - Cultural/Religious Headcover Preservation for Women (Hijab/Headscarf)
 * - Group Harmonization & Variety
 */
export function buildSubjectDescription(
  faceData: FaceDetectionResult,
  theme: PhotoboothThemeData
): string {
  const { maleCount = 0, femaleCount = 0, totalPeople = 1 } = faceData;
  const lines: string[] = [];

  let subjectSummary = '';
  if (maleCount > 0 && femaleCount > 0) {
    const menPart = maleCount === 1 ? '1 man' : `${maleCount} men`;
    const womenPart = femaleCount === 1 ? '1 woman' : `${femaleCount} women`;
    subjectSummary = `${menPart} and ${womenPart} (${totalPeople} people total)`;
  } else if (maleCount > 0) {
    subjectSummary = maleCount === 1 ? '1 man' : `${maleCount} men`;
  } else if (femaleCount > 0) {
    subjectSummary = femaleCount === 1 ? '1 woman' : `${femaleCount} women`;
  } else {
    subjectSummary = totalPeople === 1 ? '1 person' : `${totalPeople} people`;
  }

  lines.push(`CRITICAL DIRECTIVE - 1:1 FACIAL IDENTITY & ZERO ALTERATION:`);
  lines.push(
    `- The reference photo contains ${subjectSummary}. Maintain 100% exact facial identity, head shape, and facial features for ${
      totalPeople === 1 ? 'this person' : 'each person'
    }.`
  );
  lines.push(
    `- ABSOLUTE ZERO FACIAL ALTERATION: Strictly preserve every subject's authentic, natural facial identity without any modification, morphing, reshaping, AI beautification, or substitution. Every facial detail must remain 100% faithful to the source photo: exact eye shape, eyelid folds, eye gaze direction, eyebrows, nose structure and width, cheekbones, jawline, lips, smile/mouth geometry, skin complexion, skin texture, natural markings, wrinkles, moles, and facial hair (beards, mustaches, stubble).`
  );
  lines.push(
    `- ZERO EXPRESSION CHANGE: Preserve the subject's exact facial expression, mouth posture (smile level, open/closed lips), and eye gaze direction identically as in the reference image. Do NOT alter the expression, do NOT add a forced smile, and do NOT change the person's mood or emotional look.`
  );
  lines.push(
    `- IMMEDIATE RECOGNIZABILITY: The subject must be immediately, flawlessly recognizable as the exact real person in the photograph. Do NOT replace, blend, or average the face with generic model faces.`
  );
  lines.push(
    `- SCOPE OF MODIFICATION: ONLY replace the outfit/clothing with the specified theme attire, and ONLY replace the background with the ${theme.name} environment. The head, face, natural features, and expressions must remain untouched and transferred seamlessly.`
  );

  lines.push(`\nTHEMATIC OUTFIT TRANSFORMATION:`);
  lines.push(`- ${theme.outfitDetails}`);

  if (totalPeople > 1) {
    lines.push(`- GROUP HARMONY & VARIATION: Introduce subtle, authentic variations in accessories, styling, and color trims across group members while maintaining overall aesthetic coherence.`);
  }

  lines.push(`\nHAIR & HEADCOVER SPECIFICATIONS:`);
  lines.push(
    `- If a female subject in the reference photo is wearing a religious or cultural headcover (such as a hijab, sheila, or headscarf), faithfully preserve it cleanly and elegantly draped and neatly tucked into the collar of the outfit.`
  );
  lines.push(
    `- If a subject has natural exposed hair, preserve their natural hair texture, volume, color, and haircut faithfully.`
  );

  lines.push(`\nBODY POSTURE & BACKGROUND INTEGRATION:`);
  lines.push(
    `- POSTURE: Standing upright with confident, dignified posture.`
  );
  lines.push(
    `- FULL BACKGROUND REPLACEMENT: Completely remove and replace the original background with: ${theme.environmentDescription}.`
  );

  if (theme.lightingDescription) {
    lines.push(`\nLIGHTING HARMONIZATION:`);
    lines.push(`- ${theme.lightingDescription}`);
  }

  return lines.join('\n');
}

/**
 * Injects subject description into the theme's prompt instructions
 */
export function craftFullPrompt(
  faceData: FaceDetectionResult,
  theme: PhotoboothThemeData
): string {
  const subjectDescription = buildSubjectDescription(faceData, theme);
  return theme.promptInstructions.replace(/\{\{SUBJECT_DESCRIPTION\}\}/g, subjectDescription);
}
