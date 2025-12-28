/**
 * Token Assembly Layer
 * 
 * Ensures every style emits a complete W3C DTCG 2025.10 token set,
 * even when some categories lack observed data.
 * 
 * Philosophy: Token completeness > token accuracy at this stage.
 * Missing data is filled with sensible defaults + low confidence.
 */

export interface ConfidenceMetadata {
  confidence: number;
  source: 'cv' | 'ai' | 'inferred';
  method?: string;
}

export interface ShadowValue {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
  inset?: boolean;
}

export type CubicBezierValue = [number, number, number, number];

export type DTCGTokenValue = 
  | string 
  | number 
  | boolean 
  | ShadowValue 
  | CubicBezierValue;

export interface DTCGToken {
  $type: string;
  $value: DTCGTokenValue;
  $description?: string;
  $extensions?: {
    visualDNA: ConfidenceMetadata;
  };
}

export interface DTCGTokenGroup {
  [key: string]: DTCGToken | DTCGTokenGroup;
}

export interface AssembledTokens {
  $schema: string;
  color: DTCGTokenGroup;
  spacing: DTCGTokenGroup;
  typography: DTCGTokenGroup;
  radius: DTCGTokenGroup;
  shadow: DTCGTokenGroup;
  opacity: DTCGTokenGroup;
  depth: DTCGTokenGroup;
  motion: DTCGTokenGroup;
  $extensions?: {
    visualDNA: {
      version: string;
      extractionMethod: string;
      overallConfidence: number;
      categoryConfidence: Record<string, number>;
    };
  };
}

export interface CVColorInput {
  oklch?: string;
  hex?: string;
  confidence?: number;
}

export interface CVColorAnalysis {
  harmony?: string;
  temperature?: string;
  contrast?: number;
}

export interface CVElevationInput {
  depthScore?: number;
  layerCount?: number;
  levels?: { level: number; intensity: number }[];
}

export interface CVExtractionResult {
  color?: (string | CVColorInput)[];
  colorAnalysis?: CVColorAnalysis;
  spacing?: (number | string)[];
  borderRadius?: (number | string)[];
  grid?: { columns?: number; rows?: number };
  elevation?: CVElevationInput;
  strokeWidth?: number[];
  meta?: {
    method?: string;
    confidence?: string;
  };
}

const DTCG_SCHEMA = 'https://design-tokens.github.io/community-group/format/2025.10/schema.json';

const DEFAULT_CONFIDENCE = {
  observed: 0.85,
  inferred: 0.3,
  fallback: 0.1,
};

function createToken(
  type: string,
  value: DTCGTokenValue,
  description: string,
  confidence: number,
  source: 'cv' | 'ai' | 'inferred',
  method?: string
): DTCGToken {
  return {
    $type: type,
    $value: value,
    $description: description,
    $extensions: {
      visualDNA: {
        confidence,
        source,
        ...(method && { method }),
      },
    },
  };
}

function assembleColorTokens(
  colors: (string | CVColorInput)[] | undefined,
  colorAnalysis: CVColorAnalysis | undefined
): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {};
  let totalConfidence = 0;
  let tokenCount = 0;

  if (colors && Array.isArray(colors) && colors.length > 0) {
    const colorNames = ['primary', 'secondary', 'tertiary', 'accent', 'neutral', 'background', 'surface', 'muted'];
    
    colors.slice(0, 8).forEach((color, i) => {
      const name = colorNames[i] || `color${i + 1}`;
      const value = typeof color === 'string' ? color : color.oklch || color.hex || '#888888';
      const conf = typeof color === 'object' && color.confidence ? color.confidence : DEFAULT_CONFIDENCE.observed;
      
      tokens[name] = createToken('color', value, `${name} color from image analysis`, conf, 'cv', 'k-means');
      totalConfidence += conf;
      tokenCount++;
    });

    if (colorAnalysis?.harmony) {
      tokens['harmony'] = createToken('string', colorAnalysis.harmony, 'Detected color harmony type', 0.7, 'cv', 'harmony-detection');
      tokenCount++;
      totalConfidence += 0.7;
    }
  } else {
    tokens['primary'] = createToken('color', 'oklch(0.6 0.15 250)', 'Default primary color (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
    tokens['secondary'] = createToken('color', 'oklch(0.5 0.1 200)', 'Default secondary color (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
    tokens['background'] = createToken('color', 'oklch(0.98 0.01 250)', 'Default background (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
    tokens['surface'] = createToken('color', 'oklch(0.95 0.02 250)', 'Default surface (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
    totalConfidence = DEFAULT_CONFIDENCE.fallback * 4;
    tokenCount = 4;
  }

  return { tokens, confidence: tokenCount > 0 ? totalConfidence / tokenCount : DEFAULT_CONFIDENCE.fallback };
}

function assembleSpacingTokens(spacing: (number | string)[] | undefined): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {};
  
  if (spacing && Array.isArray(spacing) && spacing.length > 0) {
    const scaleNames = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
    spacing.slice(0, 8).forEach((value, i) => {
      const name = scaleNames[i] || `space${i}`;
      const pxValue = typeof value === 'number' ? value : parseInt(value) || 8;
      tokens[name] = createToken('dimension', `${pxValue}px`, `Spacing scale ${name}`, DEFAULT_CONFIDENCE.observed, 'cv', 'bounding-box-deltas');
    });
    return { tokens, confidence: DEFAULT_CONFIDENCE.observed };
  }

  tokens['xs'] = createToken('dimension', '4px', 'Extra small spacing (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['sm'] = createToken('dimension', '8px', 'Small spacing (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['md'] = createToken('dimension', '16px', 'Medium spacing (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['lg'] = createToken('dimension', '24px', 'Large spacing (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['xl'] = createToken('dimension', '32px', 'Extra large spacing (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['2xl'] = createToken('dimension', '48px', '2x large spacing (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');

  return { tokens, confidence: DEFAULT_CONFIDENCE.fallback };
}

function assembleTypographyTokens(): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {
    fontFamily: {
      sans: createToken('fontFamily', 'system-ui, -apple-system, sans-serif', 'System sans-serif stack (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      serif: createToken('fontFamily', 'Georgia, serif', 'Serif stack (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      mono: createToken('fontFamily', 'ui-monospace, monospace', 'Monospace stack (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    },
    fontSize: {
      xs: createToken('dimension', '12px', 'Extra small text (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      sm: createToken('dimension', '14px', 'Small text (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      base: createToken('dimension', '16px', 'Base text size (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      lg: createToken('dimension', '18px', 'Large text (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      xl: createToken('dimension', '20px', 'Extra large text (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      '2xl': createToken('dimension', '24px', 'Heading 2 (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      '3xl': createToken('dimension', '30px', 'Heading 1 (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    },
    fontWeight: {
      normal: createToken('fontWeight', 400, 'Normal weight (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      medium: createToken('fontWeight', 500, 'Medium weight (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      semibold: createToken('fontWeight', 600, 'Semibold weight (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      bold: createToken('fontWeight', 700, 'Bold weight (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    },
    lineHeight: {
      tight: createToken('number', 1.25, 'Tight line height (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      normal: createToken('number', 1.5, 'Normal line height (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      relaxed: createToken('number', 1.75, 'Relaxed line height (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    },
  };

  return { tokens, confidence: DEFAULT_CONFIDENCE.fallback };
}

function assembleRadiusTokens(radius: (number | string)[] | undefined): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {};

  if (radius && Array.isArray(radius) && radius.length > 0) {
    const radiusNames = ['none', 'sm', 'md', 'lg', 'xl', 'full'];
    radius.slice(0, 6).forEach((value, i) => {
      const name = radiusNames[i] || `radius${i}`;
      const pxValue = typeof value === 'number' ? value : parseInt(value) || 4;
      tokens[name] = createToken('dimension', `${pxValue}px`, `Radius ${name}`, DEFAULT_CONFIDENCE.observed, 'cv', 'corner-detection');
    });
    return { tokens, confidence: DEFAULT_CONFIDENCE.observed };
  }

  tokens['none'] = createToken('dimension', '0px', 'No rounding (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['sm'] = createToken('dimension', '4px', 'Small radius (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['md'] = createToken('dimension', '8px', 'Medium radius (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['lg'] = createToken('dimension', '12px', 'Large radius (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['xl'] = createToken('dimension', '16px', 'Extra large radius (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['full'] = createToken('dimension', '9999px', 'Full/pill radius (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');

  return { tokens, confidence: DEFAULT_CONFIDENCE.fallback };
}

function assembleShadowTokens(elevation: CVElevationInput | undefined): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {};

  if (elevation && typeof elevation === 'object') {
    if (elevation.levels && Array.isArray(elevation.levels)) {
      elevation.levels.forEach((level: { level: number; intensity: number }, i: number) => {
        const name = `level${i + 1}`;
        tokens[name] = createToken(
          'shadow',
          {
            offsetX: '0px',
            offsetY: `${(i + 1) * 2}px`,
            blur: `${(i + 1) * 4}px`,
            spread: '0px',
            color: 'oklch(0 0 0 / 0.1)',
          },
          `Shadow level ${i + 1} (from depth analysis)`,
          0.6,
          'cv',
          'edge-halo-detection'
        );
      });
      return { tokens, confidence: 0.6 };
    }
  }

  tokens['sm'] = createToken('shadow', { offsetX: '0px', offsetY: '1px', blur: '2px', spread: '0px', color: 'oklch(0 0 0 / 0.05)' }, 'Small shadow (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['md'] = createToken('shadow', { offsetX: '0px', offsetY: '4px', blur: '6px', spread: '-1px', color: 'oklch(0 0 0 / 0.1)' }, 'Medium shadow (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['lg'] = createToken('shadow', { offsetX: '0px', offsetY: '10px', blur: '15px', spread: '-3px', color: 'oklch(0 0 0 / 0.1)' }, 'Large shadow (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['xl'] = createToken('shadow', { offsetX: '0px', offsetY: '20px', blur: '25px', spread: '-5px', color: 'oklch(0 0 0 / 0.1)' }, 'Extra large shadow (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');

  return { tokens, confidence: DEFAULT_CONFIDENCE.fallback };
}

function assembleOpacityTokens(): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {
    transparent: createToken('number', 0, 'Fully transparent (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    subtle: createToken('number', 0.1, 'Subtle opacity (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    light: createToken('number', 0.3, 'Light opacity (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    medium: createToken('number', 0.5, 'Medium opacity (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    heavy: createToken('number', 0.7, 'Heavy opacity (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    solid: createToken('number', 1, 'Fully opaque (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
  };

  return { tokens, confidence: DEFAULT_CONFIDENCE.fallback };
}

function assembleDepthTokens(elevation: CVElevationInput | undefined): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {};

  if (elevation && typeof elevation === 'object' && elevation.depthScore !== undefined) {
    tokens['score'] = createToken('number', elevation.depthScore, 'Overall depth score from analysis', 0.65, 'cv', 'monocular-depth');
    tokens['layers'] = createToken('number', elevation.layerCount || 3, 'Estimated layer count', 0.5, 'cv', 'blur-occlusion');
    return { tokens, confidence: 0.57 };
  }

  tokens['flat'] = createToken('number', 0, 'Flat/2D level (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['raised'] = createToken('number', 1, 'Slightly raised (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['floating'] = createToken('number', 2, 'Floating element (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');
  tokens['overlay'] = createToken('number', 3, 'Overlay/modal level (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred');

  return { tokens, confidence: DEFAULT_CONFIDENCE.fallback };
}

function assembleMotionTokens(): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {
    duration: {
      instant: createToken('duration', '0ms', 'No animation (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      fast: createToken('duration', '100ms', 'Fast transition (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      normal: createToken('duration', '200ms', 'Normal transition (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      slow: createToken('duration', '300ms', 'Slow transition (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      slower: createToken('duration', '500ms', 'Slower animation (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    },
    easing: {
      linear: createToken('cubicBezier', [0, 0, 1, 1], 'Linear easing (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      ease: createToken('cubicBezier', [0.25, 0.1, 0.25, 1], 'Default ease (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      easeIn: createToken('cubicBezier', [0.42, 0, 1, 1], 'Ease in (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      easeOut: createToken('cubicBezier', [0, 0, 0.58, 1], 'Ease out (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
      easeInOut: createToken('cubicBezier', [0.42, 0, 0.58, 1], 'Ease in-out (fallback)', DEFAULT_CONFIDENCE.fallback, 'inferred'),
    },
  };

  return { tokens, confidence: DEFAULT_CONFIDENCE.fallback };
}

export function assembleTokens(cvResult?: CVExtractionResult, existingTokens?: Record<string, DTCGTokenGroup>): AssembledTokens {
  const cv = cvResult || {};
  
  const colorResult = assembleColorTokens(cv.color, cv.colorAnalysis);
  const spacingResult = assembleSpacingTokens(cv.spacing);
  const typographyResult = assembleTypographyTokens();
  const radiusResult = assembleRadiusTokens(cv.borderRadius);
  const shadowResult = assembleShadowTokens(cv.elevation);
  const opacityResult = assembleOpacityTokens();
  const depthResult = assembleDepthTokens(cv.elevation);
  const motionResult = assembleMotionTokens();

  const categoryConfidence: Record<string, number> = {
    color: colorResult.confidence,
    spacing: spacingResult.confidence,
    typography: typographyResult.confidence,
    radius: radiusResult.confidence,
    shadow: shadowResult.confidence,
    opacity: opacityResult.confidence,
    depth: depthResult.confidence,
    motion: motionResult.confidence,
  };

  const confidenceValues = Object.values(categoryConfidence);
  const overallConfidence = confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length;

  return {
    $schema: DTCG_SCHEMA,
    color: colorResult.tokens,
    spacing: spacingResult.tokens,
    typography: typographyResult.tokens,
    radius: radiusResult.tokens,
    shadow: shadowResult.tokens,
    opacity: opacityResult.tokens,
    depth: depthResult.tokens,
    motion: motionResult.tokens,
    $extensions: {
      visualDNA: {
        version: '1.0.0',
        extractionMethod: cv.meta?.method || 'inferred',
        overallConfidence,
        categoryConfidence,
      },
    },
  };
}

export function mergeWithExistingTokens(assembled: AssembledTokens, existing?: Record<string, DTCGTokenGroup>): AssembledTokens {
  if (!existing) return assembled;

  const merged = { ...assembled };

  for (const category of ['color', 'spacing', 'typography', 'radius', 'shadow', 'opacity', 'depth', 'motion'] as const) {
    if (existing[category] && typeof existing[category] === 'object') {
      merged[category] = { ...assembled[category], ...existing[category] };
    }
  }

  return merged;
}
