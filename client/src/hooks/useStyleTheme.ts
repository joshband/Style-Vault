import { useMemo } from "react";

interface DTCGToken {
  $type: string;
  $value: string | number | Record<string, string>;
  $description?: string;
}

interface DTCGTokenGroup {
  [key: string]: DTCGToken | DTCGTokenGroup;
}

interface StyleTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    neutral: string;
  };
  typography: {
    fontSerif: string;
    fontSans: string;
    fontMono: string;
    fontSizes: Record<string, string>;
    fontWeights: Record<string, number>;
    lineHeights: Record<string, number>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: {
    xs: string;
    sm: string;
    md: string;
  };
  texture: {
    grain: string;
    finish: string;
    roughness: number;
  };
  lighting: {
    type: string;
    direction: string;
    intensity: string;
  };
  mood: {
    tone: string;
    saturation: number;
    contrast: number;
  };
  cssVariables: Record<string, string>;
}

function getTokenValue(token: DTCGToken | DTCGTokenGroup | undefined, defaultValue: string = ""): string {
  if (!token) return defaultValue;
  if ("$value" in token) {
    const val = token.$value;
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
    return defaultValue;
  }
  return defaultValue;
}

function getTokenNumber(token: DTCGToken | DTCGTokenGroup | undefined, defaultValue: number = 0): number {
  if (!token) return defaultValue;
  if ("$value" in token) {
    const val = token.$value;
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseFloat(val) || defaultValue;
    return defaultValue;
  }
  return defaultValue;
}

function parseShadowToken(token: DTCGToken | undefined, defaultShadow: string = "0 1px 3px rgba(0,0,0,0.1)"): string {
  if (!token || !("$value" in token)) return defaultShadow;
  const val = token.$value;
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "object" && val !== null) {
    const { offsetX = "0px", offsetY = "0px", blur = "0px", color = "rgba(0,0,0,0.1)" } = val as Record<string, string>;
    return `${offsetX} ${offsetY} ${blur} ${color}`;
  }
  return defaultShadow;
}

export function extractThemeFromTokens(tokens: DTCGTokenGroup): StyleTheme {
  const color = tokens.color as DTCGTokenGroup || {};
  const typography = tokens.typography as DTCGTokenGroup || {};
  const spacing = tokens.spacing as DTCGTokenGroup || {};
  const borderRadius = tokens.borderRadius as DTCGTokenGroup || {};
  const shadow = tokens.shadow as DTCGTokenGroup || {};
  const texture = tokens.texture as DTCGTokenGroup || {};
  const lighting = tokens.lighting as DTCGTokenGroup || {};
  const mood = tokens.mood as DTCGTokenGroup || {};
  const fontFamily = typography.fontFamily as DTCGTokenGroup || {};
  const fontSize = typography.fontSize as DTCGTokenGroup || {};
  const fontWeight = typography.fontWeight as DTCGTokenGroup || {};
  const lineHeight = typography.lineHeight as DTCGTokenGroup || {};

  const theme: StyleTheme = {
    colors: {
      primary: getTokenValue(color.primary as DTCGToken, "#2A2A2A"),
      secondary: getTokenValue(color.secondary as DTCGToken, "#6B5B4D"),
      accent: getTokenValue(color.accent as DTCGToken, "#FF4D4D"),
      background: getTokenValue(color.background as DTCGToken, "#F5F5F5"),
      surface: getTokenValue(color.surface as DTCGToken, "#FFFFFF"),
      neutral: getTokenValue(color.neutral as DTCGToken, "#E0E0E0"),
    },
    typography: {
      fontSerif: getTokenValue(fontFamily.serif as DTCGToken, "Lora, Georgia, serif"),
      fontSans: getTokenValue(fontFamily.sans as DTCGToken, "Inter, -apple-system, sans-serif"),
      fontMono: getTokenValue(fontFamily.mono as DTCGToken, "JetBrains Mono, Courier, monospace"),
      fontSizes: {
        xs: getTokenValue(fontSize.xs as DTCGToken, "12px"),
        sm: getTokenValue(fontSize.sm as DTCGToken, "14px"),
        base: getTokenValue(fontSize.base as DTCGToken, "16px"),
        lg: getTokenValue(fontSize.lg as DTCGToken, "18px"),
        xl: getTokenValue(fontSize.xl as DTCGToken, "20px"),
        "2xl": getTokenValue(fontSize["2xl"] as DTCGToken, "24px"),
        "3xl": getTokenValue(fontSize["3xl"] as DTCGToken, "30px"),
        "4xl": getTokenValue(fontSize["4xl"] as DTCGToken, "36px"),
      },
      fontWeights: {
        light: getTokenNumber(fontWeight.light as DTCGToken, 300),
        regular: getTokenNumber(fontWeight.regular as DTCGToken, 400),
        medium: getTokenNumber(fontWeight.medium as DTCGToken, 500),
        semibold: getTokenNumber(fontWeight.semibold as DTCGToken, 600),
        bold: getTokenNumber(fontWeight.bold as DTCGToken, 700),
      },
      lineHeights: {
        tight: getTokenNumber(lineHeight.tight as DTCGToken, 1.2),
        normal: getTokenNumber(lineHeight.normal as DTCGToken, 1.5),
        relaxed: getTokenNumber(lineHeight.relaxed as DTCGToken, 1.75),
      },
    },
    spacing: {
      xs: getTokenValue(spacing.xs as DTCGToken, "4px"),
      sm: getTokenValue(spacing.sm as DTCGToken, "8px"),
      md: getTokenValue(spacing.md as DTCGToken, "16px"),
      lg: getTokenValue(spacing.lg as DTCGToken, "24px"),
      xl: getTokenValue(spacing.xl as DTCGToken, "32px"),
      "2xl": getTokenValue(spacing["2xl"] as DTCGToken, "48px"),
      "3xl": getTokenValue(spacing["3xl"] as DTCGToken, "64px"),
    },
    borderRadius: {
      none: getTokenValue(borderRadius.none as DTCGToken, "0px"),
      sm: getTokenValue(borderRadius.sm as DTCGToken, "2px"),
      md: getTokenValue(borderRadius.md as DTCGToken, "4px"),
      lg: getTokenValue(borderRadius.lg as DTCGToken, "8px"),
      full: getTokenValue(borderRadius.full as DTCGToken, "9999px"),
    },
    shadows: {
      xs: parseShadowToken(shadow.xs as DTCGToken, "0 1px 2px rgba(0,0,0,0.05)"),
      sm: parseShadowToken(shadow.sm as DTCGToken, "0 2px 4px rgba(0,0,0,0.1)"),
      md: parseShadowToken(shadow.md as DTCGToken, "0 4px 12px rgba(0,0,0,0.15)"),
    },
    texture: {
      grain: getTokenValue(texture.grain as DTCGToken, "fine-noise"),
      finish: getTokenValue(texture.finish as DTCGToken, "matte"),
      roughness: getTokenNumber(texture.roughness as DTCGToken, 0.65),
    },
    lighting: {
      type: getTokenValue(lighting.type as DTCGToken, "diffuse-studio"),
      direction: getTokenValue(lighting.direction as DTCGToken, "top-left"),
      intensity: getTokenValue(lighting.intensity as DTCGToken, "0.8"),
    },
    mood: {
      tone: getTokenValue(mood.tone as DTCGToken, "editorial"),
      saturation: getTokenNumber(mood.saturation as DTCGToken, 0.85),
      contrast: getTokenNumber(mood.contrast as DTCGToken, 1.1),
    },
    cssVariables: {},
  };

  theme.cssVariables = {
    "--style-color-primary": theme.colors.primary,
    "--style-color-secondary": theme.colors.secondary,
    "--style-color-accent": theme.colors.accent,
    "--style-color-background": theme.colors.background,
    "--style-color-surface": theme.colors.surface,
    "--style-color-neutral": theme.colors.neutral,
    "--style-font-serif": theme.typography.fontSerif,
    "--style-font-sans": theme.typography.fontSans,
    "--style-font-mono": theme.typography.fontMono,
    "--style-radius-sm": theme.borderRadius.sm,
    "--style-radius-md": theme.borderRadius.md,
    "--style-radius-lg": theme.borderRadius.lg,
    "--style-shadow-xs": theme.shadows.xs,
    "--style-shadow-sm": theme.shadows.sm,
    "--style-shadow-md": theme.shadows.md,
    "--style-spacing-xs": theme.spacing.xs,
    "--style-spacing-sm": theme.spacing.sm,
    "--style-spacing-md": theme.spacing.md,
    "--style-spacing-lg": theme.spacing.lg,
  };

  return theme;
}

export function useStyleTheme(tokens: DTCGTokenGroup | null | undefined): StyleTheme | null {
  return useMemo(() => {
    if (!tokens) return null;
    return extractThemeFromTokens(tokens);
  }, [tokens]);
}

export function generateColorHarmonies(baseColor: string): {
  complementary: string;
  analogous: string[];
  triadic: string[];
  splitComplementary: string[];
} {
  const hexToHsl = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 50];
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return [h * 360, s * 100, l * 100];
  };

  const hslToHex = (h: number, s: number, l: number): string => {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const [h, s, l] = hexToHsl(baseColor);

  return {
    complementary: hslToHex(h + 180, s, l),
    analogous: [
      hslToHex(h - 30, s, l),
      hslToHex(h + 30, s, l),
    ],
    triadic: [
      hslToHex(h + 120, s, l),
      hslToHex(h + 240, s, l),
    ],
    splitComplementary: [
      hslToHex(h + 150, s, l),
      hslToHex(h + 210, s, l),
    ],
  };
}

export type { StyleTheme, DTCGToken, DTCGTokenGroup };
