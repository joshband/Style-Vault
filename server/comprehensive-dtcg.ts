/**
 * Comprehensive DTCG Token Generator
 * 
 * Combines CV extraction, Vision API analysis, and AI enrichment
 * into a complete W3C DTCG 2025.10 compliant token structure.
 * 
 * Token Types Covered:
 * - color (with semantic aliases)
 * - dimension (spacing, sizing)
 * - fontFamily, fontSize, fontWeight, lineHeight
 * - shadow
 * - borderWidth, borderRadius
 * - gradient
 * - opacity
 * - duration, cubicBezier (motion)
 * - number (depth, ratios)
 */

import type { VisionAnalysisResult } from "./vision-service";
import type { CVExtractedTokens } from "./cv-bridge";

const DTCG_SCHEMA = "https://design-tokens.github.io/community-group/format/2025.10/schema.json";

export interface ShadowValue {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
  inset?: boolean;
}

export interface GradientStop {
  color: string;
  position: string;
}

export interface GradientValue {
  type: "linear" | "radial";
  angle?: string;
  stops: GradientStop[];
}

export type CubicBezierValue = [number, number, number, number];

export type DTCGTokenValue =
  | string
  | number
  | boolean
  | ShadowValue
  | GradientValue
  | CubicBezierValue;

export interface DTCGToken {
  $type: string;
  $value: DTCGTokenValue;
  $description?: string;
  $extensions?: {
    visualDNA: {
      confidence: number;
      source: "cv" | "vision" | "ai" | "inferred" | "merged";
      method?: string;
    };
  };
}

export interface DTCGAlias {
  $value: string;
  $description?: string;
}

export interface DTCGTokenGroup {
  [key: string]: DTCGToken | DTCGAlias | DTCGTokenGroup;
}

export interface ComprehensiveDTCG {
  $schema: string;
  color: DTCGTokenGroup;
  spacing: DTCGTokenGroup;
  sizing: DTCGTokenGroup;
  typography: DTCGTokenGroup;
  borderRadius: DTCGTokenGroup;
  borderWidth: DTCGTokenGroup;
  shadow: DTCGTokenGroup;
  gradient: DTCGTokenGroup;
  opacity: DTCGTokenGroup;
  depth: DTCGTokenGroup;
  motion: DTCGTokenGroup;
  semantic: DTCGTokenGroup;
  $extensions: {
    visualDNA: {
      version: string;
      schemaVersion: string;
      sources: string[];
      overallConfidence: number;
      categoryConfidence: Record<string, number>;
      visionLabels?: string[];
      visionObjects?: string[];
      extractedAt: string;
    };
  };
}

function createToken(
  type: string,
  value: DTCGTokenValue,
  description: string,
  confidence: number,
  source: "cv" | "vision" | "ai" | "inferred" | "merged",
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

function createAlias(reference: string, description?: string): DTCGAlias {
  return {
    $value: `{${reference}}`,
    ...(description && { $description: description }),
  };
}

function rgbToOklch(r: number, g: number, b: number): string {
  const rLin = r / 255;
  const gLin = g / 255;
  const bLin = b / 255;

  const l = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const m = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const s = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const L = 0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot;
  const bVal = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot;

  const C = Math.sqrt(a * a + bVal * bVal);
  let H = Math.atan2(bVal, a) * (180 / Math.PI);
  if (H < 0) H += 360;

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

function assembleColorsFromCV(cvColors: CVExtractedTokens["color"] | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};
  let totalConfidence = 0;
  let tokenCount = 0;

  if (cvColors && Array.isArray(cvColors) && cvColors.length > 0) {
    const colorRoles = ["primary", "secondary", "tertiary", "accent", "neutral", "surface", "background", "muted"];
    
    cvColors.slice(0, 8).forEach((color, i) => {
      const name = colorRoles[i] || `palette-${i + 1}`;
      const value = `oklch(${color.l.toFixed(3)} ${color.c.toFixed(3)} ${color.h.toFixed(1)})`;
      const conf = 0.85;
      
      tokens[name] = createToken("color", value, `${name} color extracted via CV k-means clustering`, conf, "cv", "k-means-oklch");
      totalConfidence += conf;
      tokenCount++;
    });
  }

  return { tokens, confidence: tokenCount > 0 ? totalConfidence / tokenCount : 0.1 };
}

function assembleColorsFromVision(visionColors: VisionAnalysisResult["dominantColors"] | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};
  let totalConfidence = 0;
  let tokenCount = 0;

  if (visionColors && visionColors.length > 0) {
    const visionGroup: DTCGTokenGroup = {};
    
    visionColors.slice(0, 10).forEach((color, i) => {
      const name = `dominant-${i + 1}`;
      const oklch = rgbToOklch(color.red, color.green, color.blue);
      const conf = Math.min(0.9, color.score + 0.3);
      
      visionGroup[name] = createToken(
        "color",
        oklch,
        `Dominant color #${i + 1} (${color.pixelFraction.toFixed(1)}% coverage)`,
        conf,
        "vision",
        "gcp-vision-color-extraction"
      );
      totalConfidence += conf;
      tokenCount++;
    });
    
    tokens["vision"] = visionGroup;
  }

  return { tokens, confidence: tokenCount > 0 ? totalConfidence / tokenCount : 0.1 };
}

function mergeColorTokens(cvColors: DTCGTokenGroup, visionColors: DTCGTokenGroup): DTCGTokenGroup {
  const merged: DTCGTokenGroup = { ...cvColors, ...visionColors };
  
  const semantic: DTCGTokenGroup = {};
  
  if (cvColors["primary"]) {
    semantic["brand"] = createAlias("color.primary", "Primary brand color");
    semantic["interactive"] = createAlias("color.primary", "Interactive element color");
  }
  if (cvColors["secondary"]) {
    semantic["brand-secondary"] = createAlias("color.secondary", "Secondary brand color");
  }
  if (cvColors["background"]) {
    semantic["page-background"] = createAlias("color.background", "Page background color");
  }
  if (cvColors["surface"]) {
    semantic["card-background"] = createAlias("color.surface", "Card/panel background");
  }
  if (cvColors["accent"]) {
    semantic["highlight"] = createAlias("color.accent", "Highlight/accent color");
    semantic["focus-ring"] = createAlias("color.accent", "Focus ring color");
  }

  if (Object.keys(semantic).length > 0) {
    merged["semantic"] = semantic;
  }

  return merged;
}

function assembleSpacingTokens(cvSpacing: number[] | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};
  const scaleNames = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const defaultScale = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];

  if (cvSpacing && Array.isArray(cvSpacing) && cvSpacing.length > 0) {
    const sorted = [...cvSpacing].sort((a, b) => a - b);
    sorted.slice(0, 13).forEach((value, i) => {
      tokens[scaleNames[i] || `space-${i}`] = createToken(
        "dimension",
        `${Math.round(value)}px`,
        `Spacing scale level ${i}`,
        0.8,
        "cv",
        "bounding-box-deltas"
      );
    });
    return { tokens, confidence: 0.8 };
  }

  defaultScale.forEach((value, i) => {
    tokens[scaleNames[i]] = createToken(
      "dimension",
      `${value}px`,
      `Spacing scale level ${i} (default)`,
      0.1,
      "inferred"
    );
  });

  tokens["semantic"] = {
    "page-margin": createAlias("spacing.6", "Page margin"),
    "section-gap": createAlias("spacing.8", "Gap between sections"),
    "component-gap": createAlias("spacing.4", "Gap between components"),
    "inline-gap": createAlias("spacing.2", "Inline element gap"),
  };

  return { tokens, confidence: 0.1 };
}

function assembleSizingTokens(): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {
    "icon-sm": createToken("dimension", "16px", "Small icon size", 0.1, "inferred"),
    "icon-md": createToken("dimension", "20px", "Medium icon size", 0.1, "inferred"),
    "icon-lg": createToken("dimension", "24px", "Large icon size", 0.1, "inferred"),
    "icon-xl": createToken("dimension", "32px", "Extra large icon size", 0.1, "inferred"),
    "avatar-sm": createToken("dimension", "32px", "Small avatar", 0.1, "inferred"),
    "avatar-md": createToken("dimension", "40px", "Medium avatar", 0.1, "inferred"),
    "avatar-lg": createToken("dimension", "64px", "Large avatar", 0.1, "inferred"),
    "button-height-sm": createToken("dimension", "32px", "Small button height", 0.1, "inferred"),
    "button-height-md": createToken("dimension", "40px", "Medium button height", 0.1, "inferred"),
    "button-height-lg": createToken("dimension", "48px", "Large button height", 0.1, "inferred"),
    "input-height": createToken("dimension", "40px", "Input field height", 0.1, "inferred"),
    "container-sm": createToken("dimension", "640px", "Small container max-width", 0.1, "inferred"),
    "container-md": createToken("dimension", "768px", "Medium container max-width", 0.1, "inferred"),
    "container-lg": createToken("dimension", "1024px", "Large container max-width", 0.1, "inferred"),
    "container-xl": createToken("dimension", "1280px", "Extra large container max-width", 0.1, "inferred"),
  };

  return { tokens, confidence: 0.1 };
}

export interface TypographyRecommendations {
  heading?: string;
  body?: string;
  accent?: string;
  monospace?: string;
}

function assembleTypographyTokens(typographyRecommendations?: TypographyRecommendations): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {
    fontFamily: {
      sans: createToken("fontFamily", "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", "System sans-serif stack", 0.1, "inferred"),
      serif: createToken("fontFamily", "Georgia, 'Times New Roman', serif", "Serif stack", 0.1, "inferred"),
      mono: createToken("fontFamily", "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace", "Monospace stack", 0.1, "inferred"),
    },
    fontSize: {
      xs: createToken("dimension", "0.75rem", "Extra small (12px)", 0.1, "inferred"),
      sm: createToken("dimension", "0.875rem", "Small (14px)", 0.1, "inferred"),
      base: createToken("dimension", "1rem", "Base (16px)", 0.1, "inferred"),
      lg: createToken("dimension", "1.125rem", "Large (18px)", 0.1, "inferred"),
      xl: createToken("dimension", "1.25rem", "Extra large (20px)", 0.1, "inferred"),
      "2xl": createToken("dimension", "1.5rem", "2XL (24px)", 0.1, "inferred"),
      "3xl": createToken("dimension", "1.875rem", "3XL (30px)", 0.1, "inferred"),
      "4xl": createToken("dimension", "2.25rem", "4XL (36px)", 0.1, "inferred"),
      "5xl": createToken("dimension", "3rem", "5XL (48px)", 0.1, "inferred"),
    },
    fontWeight: {
      thin: createToken("fontWeight", 100, "Thin", 0.1, "inferred"),
      light: createToken("fontWeight", 300, "Light", 0.1, "inferred"),
      normal: createToken("fontWeight", 400, "Normal", 0.1, "inferred"),
      medium: createToken("fontWeight", 500, "Medium", 0.1, "inferred"),
      semibold: createToken("fontWeight", 600, "Semibold", 0.1, "inferred"),
      bold: createToken("fontWeight", 700, "Bold", 0.1, "inferred"),
      extrabold: createToken("fontWeight", 800, "Extra bold", 0.1, "inferred"),
    },
    lineHeight: {
      none: createToken("number", 1, "No leading", 0.1, "inferred"),
      tight: createToken("number", 1.25, "Tight", 0.1, "inferred"),
      snug: createToken("number", 1.375, "Snug", 0.1, "inferred"),
      normal: createToken("number", 1.5, "Normal", 0.1, "inferred"),
      relaxed: createToken("number", 1.625, "Relaxed", 0.1, "inferred"),
      loose: createToken("number", 2, "Loose", 0.1, "inferred"),
    },
    letterSpacing: {
      tighter: createToken("dimension", "-0.05em", "Tighter", 0.1, "inferred"),
      tight: createToken("dimension", "-0.025em", "Tight", 0.1, "inferred"),
      normal: createToken("dimension", "0em", "Normal", 0.1, "inferred"),
      wide: createToken("dimension", "0.025em", "Wide", 0.1, "inferred"),
      wider: createToken("dimension", "0.05em", "Wider", 0.1, "inferred"),
      widest: createToken("dimension", "0.1em", "Widest", 0.1, "inferred"),
    },
  };

  if (typographyRecommendations?.heading) {
    (tokens.fontFamily as DTCGTokenGroup).heading = createToken(
      "fontFamily",
      typographyRecommendations.heading,
      "Recommended heading font",
      0.7,
      "ai",
      "typography-recommendation"
    );
  }
  if (typographyRecommendations?.body) {
    (tokens.fontFamily as DTCGTokenGroup).body = createToken(
      "fontFamily",
      typographyRecommendations.body,
      "Recommended body font",
      0.7,
      "ai",
      "typography-recommendation"
    );
  }

  tokens["semantic"] = {
    "heading-1": {
      fontFamily: createAlias("typography.fontFamily.sans"),
      fontSize: createAlias("typography.fontSize.4xl"),
      fontWeight: createAlias("typography.fontWeight.bold"),
      lineHeight: createAlias("typography.lineHeight.tight"),
    },
    "heading-2": {
      fontFamily: createAlias("typography.fontFamily.sans"),
      fontSize: createAlias("typography.fontSize.3xl"),
      fontWeight: createAlias("typography.fontWeight.semibold"),
      lineHeight: createAlias("typography.lineHeight.tight"),
    },
    "heading-3": {
      fontFamily: createAlias("typography.fontFamily.sans"),
      fontSize: createAlias("typography.fontSize.2xl"),
      fontWeight: createAlias("typography.fontWeight.semibold"),
      lineHeight: createAlias("typography.lineHeight.snug"),
    },
    "body": {
      fontFamily: createAlias("typography.fontFamily.sans"),
      fontSize: createAlias("typography.fontSize.base"),
      fontWeight: createAlias("typography.fontWeight.normal"),
      lineHeight: createAlias("typography.lineHeight.normal"),
    },
    "caption": {
      fontFamily: createAlias("typography.fontFamily.sans"),
      fontSize: createAlias("typography.fontSize.sm"),
      fontWeight: createAlias("typography.fontWeight.normal"),
      lineHeight: createAlias("typography.lineHeight.normal"),
    },
  };

  return { tokens, confidence: 0.1 };
}

function assembleBorderRadiusTokens(cvBorderRadius: number[] | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};

  if (cvBorderRadius && Array.isArray(cvBorderRadius) && cvBorderRadius.length > 0) {
    const radiusNames = ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];
    const sorted = [...cvBorderRadius].sort((a, b) => a - b);
    
    sorted.slice(0, 8).forEach((value, i) => {
      const name = radiusNames[i] || `radius-${i}`;
      tokens[name] = createToken(
        "dimension",
        i === 7 ? "9999px" : `${Math.round(value)}px`,
        `Border radius ${name}`,
        0.75,
        "cv",
        "corner-detection"
      );
    });
    return { tokens, confidence: 0.75 };
  }

  const defaults = [0, 2, 4, 8, 12, 16, 24, 9999];
  const names = ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];
  
  defaults.forEach((value, i) => {
    tokens[names[i]] = createToken(
      "dimension",
      `${value}px`,
      `Border radius ${names[i]} (default)`,
      0.1,
      "inferred"
    );
  });

  return { tokens, confidence: 0.1 };
}

function assembleBorderWidthTokens(cvStrokes: number[] | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};

  if (cvStrokes && Array.isArray(cvStrokes) && cvStrokes.length > 0) {
    const sorted = [...cvStrokes].sort((a, b) => a - b);
    const names = ["0", "1", "2", "4", "8"];
    
    sorted.slice(0, 5).forEach((value, i) => {
      tokens[names[i] || `width-${i}`] = createToken(
        "dimension",
        `${Math.round(value)}px`,
        `Border width ${names[i] || i}px`,
        0.7,
        "cv",
        "stroke-detection"
      );
    });
    return { tokens, confidence: 0.7 };
  }

  [0, 1, 2, 4, 8].forEach((value, i) => {
    tokens[value.toString()] = createToken(
      "dimension",
      `${value}px`,
      `Border width ${value}px (default)`,
      0.1,
      "inferred"
    );
  });

  return { tokens, confidence: 0.1 };
}

export interface CVElevationInput {
  depthScore?: number;
  layerCount?: number;
  levels?: { level: number; intensity: number }[];
}

function assembleShadowTokens(cvElevation: CVElevationInput | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};

  if (cvElevation && typeof cvElevation === "object" && cvElevation.levels) {
    cvElevation.levels.forEach((level: { level: number; intensity: number }, i: number) => {
      tokens[`level-${i + 1}`] = createToken(
        "shadow",
        {
          offsetX: "0px",
          offsetY: `${(i + 1) * 2}px`,
          blur: `${(i + 1) * 4}px`,
          spread: "0px",
          color: "oklch(0 0 0 / 0.1)",
        },
        `Shadow level ${i + 1} from depth analysis`,
        0.6,
        "cv",
        "edge-halo-detection"
      );
    });
    return { tokens, confidence: 0.6 };
  }

  const shadowPresets = [
    { name: "none", offsetY: 0, blur: 0, spread: 0, opacity: 0 },
    { name: "sm", offsetY: 1, blur: 2, spread: 0, opacity: 0.05 },
    { name: "md", offsetY: 4, blur: 6, spread: -1, opacity: 0.1 },
    { name: "lg", offsetY: 10, blur: 15, spread: -3, opacity: 0.1 },
    { name: "xl", offsetY: 20, blur: 25, spread: -5, opacity: 0.1 },
    { name: "2xl", offsetY: 25, blur: 50, spread: -12, opacity: 0.25 },
  ];

  shadowPresets.forEach(({ name, offsetY, blur, spread, opacity }) => {
    tokens[name] = createToken(
      "shadow",
      {
        offsetX: "0px",
        offsetY: `${offsetY}px`,
        blur: `${blur}px`,
        spread: `${spread}px`,
        color: `oklch(0 0 0 / ${opacity})`,
      },
      `${name} shadow (default)`,
      0.1,
      "inferred"
    );
  });

  tokens["inner"] = createToken(
    "shadow",
    {
      offsetX: "0px",
      offsetY: "2px",
      blur: "4px",
      spread: "0px",
      color: "oklch(0 0 0 / 0.06)",
      inset: true,
    },
    "Inner shadow (default)",
    0.1,
    "inferred"
  );

  return { tokens, confidence: 0.1 };
}

function assembleGradientTokens(cvColors: CVExtractedTokens["color"] | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};

  if (cvColors && cvColors.length >= 2) {
    const color1 = `oklch(${cvColors[0].l.toFixed(3)} ${cvColors[0].c.toFixed(3)} ${cvColors[0].h.toFixed(1)})`;
    const color2 = `oklch(${cvColors[1].l.toFixed(3)} ${cvColors[1].c.toFixed(3)} ${cvColors[1].h.toFixed(1)})`;

    tokens["primary-to-secondary"] = createToken(
      "gradient",
      {
        type: "linear",
        angle: "135deg",
        stops: [
          { color: color1, position: "0%" },
          { color: color2, position: "100%" },
        ],
      },
      "Primary to secondary gradient",
      0.7,
      "cv",
      "derived-from-palette"
    );

    if (cvColors.length >= 3) {
      const color3 = `oklch(${cvColors[2].l.toFixed(3)} ${cvColors[2].c.toFixed(3)} ${cvColors[2].h.toFixed(1)})`;
      tokens["tricolor"] = createToken(
        "gradient",
        {
          type: "linear",
          angle: "135deg",
          stops: [
            { color: color1, position: "0%" },
            { color: color2, position: "50%" },
            { color: color3, position: "100%" },
          ],
        },
        "Three-color gradient",
        0.6,
        "cv",
        "derived-from-palette"
      );
    }

    return { tokens, confidence: 0.65 };
  }

  tokens["subtle"] = createToken(
    "gradient",
    {
      type: "linear",
      angle: "180deg",
      stops: [
        { color: "oklch(0.98 0 0)", position: "0%" },
        { color: "oklch(0.95 0 0)", position: "100%" },
      ],
    },
    "Subtle background gradient (default)",
    0.1,
    "inferred"
  );

  return { tokens, confidence: 0.1 };
}

function assembleOpacityTokens(): { tokens: DTCGTokenGroup; confidence: number } {
  const opacities = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100];
  const tokens: DTCGTokenGroup = {};

  opacities.forEach((value) => {
    tokens[value.toString()] = createToken(
      "number",
      value / 100,
      `${value}% opacity`,
      0.1,
      "inferred"
    );
  });

  return { tokens, confidence: 0.1 };
}

function assembleDepthTokens(cvElevation: CVElevationInput | undefined): {
  tokens: DTCGTokenGroup;
  confidence: number;
} {
  const tokens: DTCGTokenGroup = {};

  if (cvElevation && typeof cvElevation === "object") {
    if (cvElevation.depthScore !== undefined) {
      tokens["score"] = createToken(
        "number",
        cvElevation.depthScore,
        "Overall depth score (0-1 scale)",
        0.65,
        "cv",
        "monocular-depth"
      );
    }
    if (cvElevation.layerCount !== undefined) {
      tokens["layer-count"] = createToken(
        "number",
        cvElevation.layerCount,
        "Estimated visual layer count",
        0.5,
        "cv",
        "blur-occlusion"
      );
    }
    return { tokens, confidence: 0.57 };
  }

  const levels = ["base", "raised", "floating", "overlay", "modal"];
  levels.forEach((name, i) => {
    tokens[name] = createToken("number", i, `${name} z-index level`, 0.1, "inferred");
  });

  return { tokens, confidence: 0.1 };
}

function assembleMotionTokens(): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {
    duration: {
      instant: createToken("duration", "0ms", "Instant", 0.1, "inferred"),
      fastest: createToken("duration", "50ms", "Fastest", 0.1, "inferred"),
      fast: createToken("duration", "100ms", "Fast", 0.1, "inferred"),
      normal: createToken("duration", "200ms", "Normal", 0.1, "inferred"),
      slow: createToken("duration", "300ms", "Slow", 0.1, "inferred"),
      slower: createToken("duration", "500ms", "Slower", 0.1, "inferred"),
      slowest: createToken("duration", "700ms", "Slowest", 0.1, "inferred"),
    },
    easing: {
      linear: createToken("cubicBezier", [0, 0, 1, 1], "Linear", 0.1, "inferred"),
      ease: createToken("cubicBezier", [0.25, 0.1, 0.25, 1], "Ease", 0.1, "inferred"),
      "ease-in": createToken("cubicBezier", [0.42, 0, 1, 1], "Ease in", 0.1, "inferred"),
      "ease-out": createToken("cubicBezier", [0, 0, 0.58, 1], "Ease out", 0.1, "inferred"),
      "ease-in-out": createToken("cubicBezier", [0.42, 0, 0.58, 1], "Ease in-out", 0.1, "inferred"),
      "spring": createToken("cubicBezier", [0.175, 0.885, 0.32, 1.275], "Spring bounce", 0.1, "inferred"),
    },
  };

  tokens["semantic"] = {
    "hover-transition": {
      duration: createAlias("motion.duration.fast"),
      easing: createAlias("motion.easing.ease-out"),
    },
    "page-transition": {
      duration: createAlias("motion.duration.normal"),
      easing: createAlias("motion.easing.ease-in-out"),
    },
    "modal-enter": {
      duration: createAlias("motion.duration.slow"),
      easing: createAlias("motion.easing.spring"),
    },
  };

  return { tokens, confidence: 0.1 };
}

function assembleSemanticTokens(): { tokens: DTCGTokenGroup; confidence: number } {
  const tokens: DTCGTokenGroup = {
    feedback: {
      success: createToken("color", "oklch(0.65 0.2 145)", "Success feedback color", 0.1, "inferred"),
      warning: createToken("color", "oklch(0.75 0.2 85)", "Warning feedback color", 0.1, "inferred"),
      error: createToken("color", "oklch(0.55 0.25 25)", "Error feedback color", 0.1, "inferred"),
      info: createToken("color", "oklch(0.6 0.2 250)", "Info feedback color", 0.1, "inferred"),
    },
    text: {
      primary: createToken("color", "oklch(0.2 0.02 250)", "Primary text color", 0.1, "inferred"),
      secondary: createToken("color", "oklch(0.4 0.02 250)", "Secondary text color", 0.1, "inferred"),
      muted: createToken("color", "oklch(0.55 0.02 250)", "Muted text color", 0.1, "inferred"),
      inverted: createToken("color", "oklch(0.98 0 0)", "Inverted text color", 0.1, "inferred"),
    },
    border: {
      default: createToken("color", "oklch(0.85 0.02 250)", "Default border color", 0.1, "inferred"),
      subtle: createToken("color", "oklch(0.9 0.01 250)", "Subtle border color", 0.1, "inferred"),
      strong: createToken("color", "oklch(0.7 0.03 250)", "Strong border color", 0.1, "inferred"),
    },
  };

  return { tokens, confidence: 0.1 };
}

export interface ComprehensiveDTCGInput {
  cvTokens?: CVExtractedTokens;
  visionResult?: VisionAnalysisResult;
  typographyRecommendations?: { heading?: string; body?: string };
}

export function generateComprehensiveDTCG(input: ComprehensiveDTCGInput): ComprehensiveDTCG {
  const { cvTokens, visionResult, typographyRecommendations } = input;
  
  const sources: string[] = [];
  if (cvTokens) sources.push("cv");
  if (visionResult) sources.push("vision");
  if (typographyRecommendations) sources.push("ai");
  if (sources.length === 0) sources.push("inferred");

  const cvColorResult = assembleColorsFromCV(cvTokens?.color);
  const visionColorResult = assembleColorsFromVision(visionResult?.dominantColors);
  const mergedColors = mergeColorTokens(cvColorResult.tokens, visionColorResult.tokens);
  const colorConfidence = Math.max(cvColorResult.confidence, visionColorResult.confidence);

  const spacingResult = assembleSpacingTokens(cvTokens?.spacing);
  const sizingResult = assembleSizingTokens();
  const typographyResult = assembleTypographyTokens(typographyRecommendations);
  const borderRadiusResult = assembleBorderRadiusTokens(cvTokens?.borderRadius);
  const borderWidthResult = assembleBorderWidthTokens(cvTokens?.strokeWidth);
  const shadowResult = assembleShadowTokens(cvTokens?.elevation);
  const gradientResult = assembleGradientTokens(cvTokens?.color);
  const opacityResult = assembleOpacityTokens();
  const depthResult = assembleDepthTokens(cvTokens?.elevation);
  const motionResult = assembleMotionTokens();
  const semanticResult = assembleSemanticTokens();

  const categoryConfidence: Record<string, number> = {
    color: colorConfidence,
    spacing: spacingResult.confidence,
    sizing: sizingResult.confidence,
    typography: typographyResult.confidence,
    borderRadius: borderRadiusResult.confidence,
    borderWidth: borderWidthResult.confidence,
    shadow: shadowResult.confidence,
    gradient: gradientResult.confidence,
    opacity: opacityResult.confidence,
    depth: depthResult.confidence,
    motion: motionResult.confidence,
    semantic: semanticResult.confidence,
  };

  const confidenceValues = Object.values(categoryConfidence);
  const overallConfidence = confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length;

  const visionLabels = visionResult?.labels
    ?.filter((l) => l.score > 0.5)
    .map((l) => l.description)
    .slice(0, 10);

  const visionObjects = visionResult?.objects
    ?.filter((o) => o.score > 0.5)
    .map((o) => o.name)
    .slice(0, 10);

  return {
    $schema: DTCG_SCHEMA,
    color: mergedColors,
    spacing: spacingResult.tokens,
    sizing: sizingResult.tokens,
    typography: typographyResult.tokens,
    borderRadius: borderRadiusResult.tokens,
    borderWidth: borderWidthResult.tokens,
    shadow: shadowResult.tokens,
    gradient: gradientResult.tokens,
    opacity: opacityResult.tokens,
    depth: depthResult.tokens,
    motion: motionResult.tokens,
    semantic: semanticResult.tokens,
    $extensions: {
      visualDNA: {
        version: "2.0.0",
        schemaVersion: "2025.10",
        sources,
        overallConfidence,
        categoryConfidence,
        visionLabels,
        visionObjects,
        extractedAt: new Date().toISOString(),
      },
    },
  };
}
