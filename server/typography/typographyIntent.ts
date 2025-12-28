/**
 * Typography Intent Inference
 * 
 * Deterministic mapping from visual signals to typographic intent.
 * All rules are explainable - no ML.
 */

import type { StyleSignals } from './styleSignals';

export interface TypographyIntent {
  serifness: number;      // 0-1: sans-serif to serif preference
  weightBias: number;     // 0-1: light to heavy weight preference
  widthBias: number;      // 0-1: condensed to wide width preference
  formality: number;      // 0-1: casual to formal
  eraBias: 'modern' | 'industrial' | 'classical' | 'futurist' | 'neutral';
  
  // Additional nuanced dimensions
  humanist: number;       // 0-1: mechanical to humanist
  decorative: number;     // 0-1: plain to decorative
  legibility: number;     // 0-1: display to body text suitability
}

export interface IntentExplanation {
  dimension: string;
  value: number | string;
  reasoning: string;
}

export interface TypographyIntentResult {
  intent: TypographyIntent;
  explanations: IntentExplanation[];
}

/**
 * Infer typographic intent from visual signals
 * 
 * Mapping philosophy:
 * - High contrast → bolder, more impactful type
 * - Sharp edges → geometric, precise fonts
 * - Soft edges → humanist, organic fonts  
 * - High density → condensed, efficient type
 * - High symmetry → classical, balanced fonts
 * - Material hints inform era and formality
 */
export function inferTypographyIntent(signals: StyleSignals): TypographyIntentResult {
  const explanations: IntentExplanation[] = [];
  
  // Serifness: influenced by formality cues, material, and organic/geometric balance
  const serifness = computeSerifness(signals, explanations);
  
  // Weight bias: driven by contrast and visual density
  const weightBias = computeWeightBias(signals, explanations);
  
  // Width bias: influenced by density and geometric tendencies
  const widthBias = computeWidthBias(signals, explanations);
  
  // Formality: material, symmetry, and edge quality
  const formality = computeFormality(signals, explanations);
  
  // Era bias: material and geometric/organic tendencies
  const eraBias = computeEraBias(signals, explanations);
  
  // Humanist quality: edge softness and organic bias
  const humanist = computeHumanist(signals, explanations);
  
  // Decorative tendency: visual density and contrast extremes
  const decorative = computeDecorative(signals, explanations);
  
  // Legibility for body text: moderate values are more legible
  const legibility = computeLegibility(signals, explanations);

  return {
    intent: {
      serifness,
      weightBias,
      widthBias,
      formality,
      eraBias,
      humanist,
      decorative,
      legibility,
    },
    explanations,
  };
}

function computeSerifness(signals: StyleSignals, explanations: IntentExplanation[]): number {
  let serifness = 0.5;
  
  // Classical materials suggest serif
  if (signals.materialBias === 'paper') {
    serifness += 0.2;
  }
  
  // High symmetry suggests classical serif
  if (signals.symmetry > 0.7) {
    serifness += 0.1;
  }
  
  // Digital/metal materials suggest sans
  if (signals.materialBias === 'digital' || signals.materialBias === 'metal') {
    serifness -= 0.2;
  }
  
  // High geometric bias suggests sans
  if (signals.geometricBias > 0.7) {
    serifness -= 0.15;
  }
  
  // Warm colors lean slightly toward serif
  if (signals.colorTemperature > 0.6) {
    serifness += 0.05;
  }
  
  serifness = clamp(serifness, 0, 1);
  
  explanations.push({
    dimension: 'serifness',
    value: serifness,
    reasoning: serifness > 0.6 
      ? 'Classical materials and warm tones suggest serif typography'
      : serifness < 0.4 
        ? 'Modern materials and geometric forms suggest sans-serif'
        : 'Balanced visual cues, either serif or sans-serif works',
  });
  
  return serifness;
}

function computeWeightBias(signals: StyleSignals, explanations: IntentExplanation[]): number {
  // High contrast and high density favor bolder weights
  let weight = 0.3 + (signals.contrast * 0.4) + (signals.visualDensity * 0.2);
  
  // Sharp edges can handle heavier weights
  if (signals.edgeSharpness > 0.7) {
    weight += 0.1;
  }
  
  // Metal material suggests industrial boldness
  if (signals.materialBias === 'metal') {
    weight += 0.15;
  }
  
  // Glass material suggests light elegance
  if (signals.materialBias === 'glass') {
    weight -= 0.15;
  }
  
  weight = clamp(weight, 0, 1);
  
  explanations.push({
    dimension: 'weightBias',
    value: weight,
    reasoning: weight > 0.6
      ? 'High contrast and visual density suggest bold typography'
      : weight < 0.4
        ? 'Soft visuals and airy composition suggest lighter weights'
        : 'Moderate visual weight suggests regular to medium weights',
  });
  
  return weight;
}

function computeWidthBias(signals: StyleSignals, explanations: IntentExplanation[]): number {
  // High density benefits from condensed type
  let width = 0.5 - (signals.visualDensity * 0.3);
  
  // Low density allows for wider type
  if (signals.visualDensity < 0.3) {
    width += 0.2;
  }
  
  // Geometric bias often pairs with regular width
  if (signals.geometricBias > 0.6) {
    width = width * 0.8 + 0.1;
  }
  
  width = clamp(width, 0, 1);
  
  explanations.push({
    dimension: 'widthBias',
    value: width,
    reasoning: width < 0.4
      ? 'Dense compositions benefit from condensed typography'
      : width > 0.6
        ? 'Spacious layouts can accommodate wider letterforms'
        : 'Standard width typography fits the composition',
  });
  
  return width;
}

function computeFormality(signals: StyleSignals, explanations: IntentExplanation[]): number {
  let formality = 0.5;
  
  // High symmetry is more formal
  formality += (signals.symmetry - 0.5) * 0.4;
  
  // Sharp edges are more formal
  formality += (signals.edgeSharpness - 0.5) * 0.2;
  
  // Material influences
  if (signals.materialBias === 'paper') formality += 0.15;
  if (signals.materialBias === 'metal') formality += 0.1;
  if (signals.materialBias === 'organic') formality -= 0.2;
  if (signals.materialBias === 'glass') formality += 0.05;
  
  formality = clamp(formality, 0, 1);
  
  explanations.push({
    dimension: 'formality',
    value: formality,
    reasoning: formality > 0.6
      ? 'Symmetric composition and refined materials suggest formal typography'
      : formality < 0.4
        ? 'Organic forms and casual composition suggest informal type'
        : 'Versatile visual context works with various formality levels',
  });
  
  return formality;
}

function computeEraBias(signals: StyleSignals, explanations: IntentExplanation[]): TypographyIntent['eraBias'] {
  // Score each era based on visual signals
  const scores = {
    modern: 0,
    industrial: 0,
    classical: 0,
    futurist: 0,
    neutral: 0.3,
  };
  
  // Modern: clean geometry, digital material, high contrast
  scores.modern += signals.geometricBias * 0.3;
  if (signals.materialBias === 'digital') scores.modern += 0.3;
  scores.modern += signals.edgeSharpness * 0.2;
  
  // Industrial: metal, bold contrast, geometric
  if (signals.materialBias === 'metal') scores.industrial += 0.4;
  scores.industrial += signals.contrast * 0.2;
  scores.industrial += signals.geometricBias * 0.2;
  
  // Classical: paper, high symmetry, warm tones
  if (signals.materialBias === 'paper') scores.classical += 0.3;
  scores.classical += signals.symmetry * 0.2;
  scores.classical += signals.colorTemperature * 0.2;
  
  // Futurist: glass, cool tones, high sharpness
  if (signals.materialBias === 'glass') scores.futurist += 0.3;
  scores.futurist += (1 - signals.colorTemperature) * 0.2;
  scores.futurist += signals.edgeSharpness * 0.2;
  
  // Find highest scoring era
  let maxEra: TypographyIntent['eraBias'] = 'neutral';
  let maxScore = scores.neutral;
  
  for (const [era, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxEra = era as TypographyIntent['eraBias'];
    }
  }
  
  explanations.push({
    dimension: 'eraBias',
    value: maxEra,
    reasoning: getEraReasoning(maxEra, signals),
  });
  
  return maxEra;
}

function getEraReasoning(era: TypographyIntent['eraBias'], signals: StyleSignals): string {
  switch (era) {
    case 'modern':
      return 'Clean geometry and digital aesthetics suggest contemporary typography';
    case 'industrial':
      return 'Bold contrast and metallic qualities evoke industrial-era type';
    case 'classical':
      return 'Traditional materials and balanced composition suggest classical typography';
    case 'futurist':
      return 'Cool tones and sharp edges suggest forward-looking typography';
    default:
      return 'Balanced visual cues allow flexibility in typographic era';
  }
}

function computeHumanist(signals: StyleSignals, explanations: IntentExplanation[]): number {
  // Soft edges and organic materials suggest humanist type
  let humanist = (1 - signals.geometricBias) * 0.5 + (1 - signals.edgeSharpness) * 0.3;
  
  if (signals.materialBias === 'organic') humanist += 0.2;
  if (signals.materialBias === 'paper') humanist += 0.1;
  
  humanist = clamp(humanist, 0, 1);
  
  explanations.push({
    dimension: 'humanist',
    value: humanist,
    reasoning: humanist > 0.6
      ? 'Organic forms suggest humanist letterforms with calligraphic influence'
      : humanist < 0.4
        ? 'Geometric precision suggests mechanical, constructed letterforms'
        : 'Mixed signals allow for various levels of humanist influence',
  });
  
  return humanist;
}

function computeDecorative(signals: StyleSignals, explanations: IntentExplanation[]): number {
  // Extreme contrast or density, and warm temperature suggest more decorative type
  const contrastExtreme = Math.abs(signals.contrast - 0.5) * 2;
  const densityExtreme = Math.abs(signals.visualDensity - 0.5) * 2;
  
  let decorative = (contrastExtreme * 0.3 + densityExtreme * 0.3 + signals.colorTemperature * 0.2);
  
  // Low symmetry can suggest more playful, decorative type
  if (signals.symmetry < 0.4) decorative += 0.15;
  
  decorative = clamp(decorative, 0, 1);
  
  explanations.push({
    dimension: 'decorative',
    value: decorative,
    reasoning: decorative > 0.6
      ? 'Bold visual contrasts and dynamic composition suit decorative display type'
      : 'Subtle visuals favor clean, unadorned typography',
  });
  
  return decorative;
}

function computeLegibility(signals: StyleSignals, explanations: IntentExplanation[]): number {
  // Moderate values in most signals favor legibility
  // Extremes favor display use
  
  const contrastModerate = 1 - Math.abs(signals.contrast - 0.5) * 2;
  const densityModerate = 1 - Math.abs(signals.visualDensity - 0.5) * 2;
  
  let legibility = (contrastModerate * 0.4 + densityModerate * 0.3 + signals.symmetry * 0.2);
  
  // Sharp edges aid legibility
  legibility += signals.edgeSharpness * 0.1;
  
  legibility = clamp(legibility, 0, 1);
  
  explanations.push({
    dimension: 'legibility',
    value: legibility,
    reasoning: legibility > 0.6
      ? 'Balanced composition suits text-focused typography'
      : 'Dynamic composition favors display or headline use',
  });
  
  return legibility;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
