import { useMemo } from "react";
import { StyleTheme, generateColorHarmonies } from "./useStyleTheme";

interface ColorSwatch {
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "background" | "surface" | "neutral" | "harmony";
}

interface TypographySpecimen {
  name: string;
  fontFamily: string;
  sampleText: string;
  size: string;
  weight: number;
  role: "heading" | "body" | "caption" | "mono";
}

interface ShadowLevel {
  name: string;
  value: string;
  intensity: "subtle" | "medium" | "strong";
}

interface MaterialCard {
  name: string;
  grain: string;
  finish: string;
  roughness: number;
  cssGradient: string;
}

interface LightingCard {
  type: string;
  direction: string;
  intensity: string;
  cssGradient: string;
}

interface MoodBoardData {
  colorPalette: ColorSwatch[];
  typography: TypographySpecimen[];
  shadows: ShadowLevel[];
  material: MaterialCard;
  lighting: LightingCard;
  moodDescriptor: {
    tone: string;
    saturation: string;
    contrast: string;
    keywords: string[];
  };
}

function getMoodKeywords(tone: string, saturation: number, contrast: number): string[] {
  const keywords: string[] = [];
  
  switch (tone.toLowerCase()) {
    case "editorial": keywords.push("sophisticated", "refined", "curated"); break;
    case "playful": keywords.push("vibrant", "energetic", "dynamic"); break;
    case "minimal": keywords.push("clean", "focused", "essential"); break;
    case "bold": keywords.push("striking", "confident", "impactful"); break;
    default: keywords.push("balanced", "harmonious");
  }

  if (saturation > 0.7) keywords.push("vivid");
  else if (saturation < 0.3) keywords.push("muted");
  
  if (contrast > 1.2) keywords.push("high-contrast");
  else if (contrast < 0.9) keywords.push("soft");

  return keywords;
}

function generateMaterialGradient(grain: string, finish: string, colors: { primary: string; neutral: string }): string {
  const baseColor = colors.neutral;
  
  if (finish === "glossy") {
    return `linear-gradient(135deg, ${baseColor} 0%, ${adjustBrightness(baseColor, 20)} 50%, ${baseColor} 100%)`;
  } else if (finish === "satin") {
    return `linear-gradient(135deg, ${baseColor} 0%, ${adjustBrightness(baseColor, 10)} 100%)`;
  }
  return `linear-gradient(180deg, ${baseColor} 0%, ${adjustBrightness(baseColor, -5)} 100%)`;
}

function generateLightingGradient(direction: string, intensity: string): string {
  const intensityValue = parseFloat(intensity) || 0.8;
  const opacity = Math.round(intensityValue * 40);
  
  const directionMap: Record<string, string> = {
    "top-left": "135deg",
    "top-right": "225deg",
    "top": "180deg",
    "bottom": "0deg",
    "left": "90deg",
    "right": "270deg",
  };
  
  const angle = directionMap[direction] || "135deg";
  return `linear-gradient(${angle}, rgba(255,255,255,${opacity / 100}) 0%, rgba(0,0,0,${opacity / 200}) 100%)`;
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export function useMoodBoard(theme: StyleTheme | null): MoodBoardData | null {
  return useMemo(() => {
    if (!theme) return null;

    const harmonies = generateColorHarmonies(theme.colors.primary);

    const colorPalette: ColorSwatch[] = [
      { name: "Primary", hex: theme.colors.primary, role: "primary" },
      { name: "Secondary", hex: theme.colors.secondary, role: "secondary" },
      { name: "Accent", hex: theme.colors.accent, role: "accent" },
      { name: "Background", hex: theme.colors.background, role: "background" },
      { name: "Surface", hex: theme.colors.surface, role: "surface" },
      { name: "Neutral", hex: theme.colors.neutral, role: "neutral" },
      { name: "Complement", hex: harmonies.complementary, role: "harmony" },
      { name: "Analogous", hex: harmonies.analogous[0], role: "harmony" },
    ];

    const typography: TypographySpecimen[] = [
      {
        name: "Display",
        fontFamily: theme.typography.fontSerif,
        sampleText: "Aa",
        size: theme.typography.fontSizes["4xl"],
        weight: theme.typography.fontWeights.bold,
        role: "heading",
      },
      {
        name: "Heading",
        fontFamily: theme.typography.fontSerif,
        sampleText: "Headlines",
        size: theme.typography.fontSizes["2xl"],
        weight: theme.typography.fontWeights.semibold,
        role: "heading",
      },
      {
        name: "Body",
        fontFamily: theme.typography.fontSans,
        sampleText: "Body text for reading",
        size: theme.typography.fontSizes.base,
        weight: theme.typography.fontWeights.regular,
        role: "body",
      },
      {
        name: "Caption",
        fontFamily: theme.typography.fontSans,
        sampleText: "Small captions & labels",
        size: theme.typography.fontSizes.sm,
        weight: theme.typography.fontWeights.medium,
        role: "caption",
      },
      {
        name: "Monospace",
        fontFamily: theme.typography.fontMono,
        sampleText: "code && data",
        size: theme.typography.fontSizes.sm,
        weight: theme.typography.fontWeights.regular,
        role: "mono",
      },
    ];

    const shadows: ShadowLevel[] = [
      { name: "Subtle", value: theme.shadows.xs, intensity: "subtle" },
      { name: "Medium", value: theme.shadows.sm, intensity: "medium" },
      { name: "Strong", value: theme.shadows.md, intensity: "strong" },
    ];

    const material: MaterialCard = {
      name: `${theme.texture.finish.charAt(0).toUpperCase() + theme.texture.finish.slice(1)} ${theme.texture.grain}`,
      grain: theme.texture.grain,
      finish: theme.texture.finish,
      roughness: theme.texture.roughness,
      cssGradient: generateMaterialGradient(theme.texture.grain, theme.texture.finish, theme.colors),
    };

    const lighting: LightingCard = {
      type: theme.lighting.type,
      direction: theme.lighting.direction,
      intensity: theme.lighting.intensity,
      cssGradient: generateLightingGradient(theme.lighting.direction, theme.lighting.intensity),
    };

    const moodDescriptor = {
      tone: theme.mood.tone,
      saturation: theme.mood.saturation > 0.7 ? "High" : theme.mood.saturation < 0.3 ? "Low" : "Medium",
      contrast: theme.mood.contrast > 1.1 ? "High" : theme.mood.contrast < 0.9 ? "Low" : "Medium",
      keywords: getMoodKeywords(theme.mood.tone, theme.mood.saturation, theme.mood.contrast),
    };

    return {
      colorPalette,
      typography,
      shadows,
      material,
      lighting,
      moodDescriptor,
    };
  }, [theme]);
}

export type { MoodBoardData, ColorSwatch, TypographySpecimen, ShadowLevel, MaterialCard, LightingCard };
