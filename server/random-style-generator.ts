/**
 * Random Style Generator
 * 
 * Generates creative, cohesive random styles with:
 * - Harmonious color palettes (complementary, analogous, triadic, etc.)
 * - Matching mood descriptors
 * - Coherent prompt scaffolding
 * - Complete DTCG tokens
 */

interface RandomColorPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  background: string;
  surface: string;
}

interface RandomStyleResult {
  name: string;
  description: string;
  tokens: Record<string, any>;
  promptScaffolding: {
    base: string;
    modifiers: string[];
    negative: string;
  };
  metadataTags: {
    mood: string[];
    colorFamily: string[];
    lighting: string[];
    texture: string[];
    era: string[];
    artPeriod: string[];
    medium: string[];
    subjects: string[];
    keywords: string[];
  };
}

const STYLE_THEMES = [
  { name: "Cyberpunk Neon", hueRange: [280, 340], mood: ["futuristic", "electric", "intense"], era: ["futuristic", "sci-fi"] },
  { name: "Sunset Warmth", hueRange: [10, 45], mood: ["warm", "romantic", "peaceful"], era: ["contemporary"] },
  { name: "Ocean Depths", hueRange: [180, 220], mood: ["serene", "mysterious", "calming"], era: ["contemporary", "organic"] },
  { name: "Forest Whisper", hueRange: [90, 150], mood: ["natural", "organic", "peaceful"], era: ["contemporary", "organic"] },
  { name: "Vintage Sepia", hueRange: [30, 50], mood: ["nostalgic", "warm", "classic"], era: ["vintage", "retro"] },
  { name: "Midnight Jazz", hueRange: [230, 270], mood: ["sophisticated", "moody", "elegant"], era: ["art-deco", "modern"] },
  { name: "Tropical Paradise", hueRange: [150, 190], mood: ["vibrant", "energetic", "playful"], era: ["contemporary"] },
  { name: "Desert Mirage", hueRange: [25, 55], mood: ["warm", "mysterious", "exotic"], era: ["timeless"] },
  { name: "Arctic Aurora", hueRange: [160, 200], mood: ["magical", "ethereal", "cold"], era: ["contemporary"] },
  { name: "Cherry Blossom", hueRange: [330, 350], mood: ["delicate", "romantic", "serene"], era: ["japanese", "contemporary"] },
  { name: "Industrial Steel", hueRange: [200, 240], mood: ["modern", "sleek", "professional"], era: ["industrial", "modern"] },
  { name: "Lavender Dreams", hueRange: [260, 290], mood: ["dreamy", "soft", "mystical"], era: ["romantic", "contemporary"] },
  { name: "Amber Glow", hueRange: [35, 55], mood: ["warm", "cozy", "inviting"], era: ["rustic", "contemporary"] },
  { name: "Cosmic Void", hueRange: [250, 290], mood: ["mysterious", "vast", "contemplative"], era: ["futuristic", "abstract"] },
  { name: "Spring Meadow", hueRange: [75, 135], mood: ["fresh", "cheerful", "natural"], era: ["contemporary", "organic"] },
];

const ADJECTIVES = [
  "Ethereal", "Vibrant", "Moody", "Serene", "Dynamic", "Elegant", "Bold", "Subtle",
  "Dreamy", "Crisp", "Warm", "Cool", "Mysterious", "Radiant", "Soft", "Intense",
  "Gentle", "Fierce", "Tranquil", "Electric", "Organic", "Geometric", "Fluid", "Sharp",
];

const NOUNS = [
  "Horizon", "Echo", "Pulse", "Whisper", "Storm", "Dawn", "Twilight", "Cascade",
  "Prism", "Veil", "Ember", "Frost", "Bloom", "Shadow", "Light", "Wave",
  "Crystal", "Mist", "Flame", "Breeze", "Tide", "Spark", "Dusk", "Aurora",
];

const LIGHTING_OPTIONS = ["soft", "dramatic", "natural", "studio", "ambient", "golden-hour", "neon", "diffused"];
const TEXTURE_OPTIONS = ["smooth", "grainy", "textured", "glossy", "matte", "rough", "silky", "organic"];
const MEDIUM_OPTIONS = ["digital", "photographic", "painted", "rendered", "illustrated", "mixed-media"];
const SUBJECT_OPTIONS = ["abstract", "nature", "urban", "portrait", "landscape", "still-life", "architectural"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 3): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateHarmoniousHue(baseHue: number, offset: number): number {
  return (baseHue + offset + 360) % 360;
}

function generateColorPalette(baseHue: number): RandomColorPalette {
  const harmony = randomElement(["complementary", "analogous", "triadic", "split-complementary"]);
  
  let hues: number[];
  switch (harmony) {
    case "complementary":
      hues = [baseHue, generateHarmoniousHue(baseHue, 180)];
      break;
    case "analogous":
      hues = [baseHue, generateHarmoniousHue(baseHue, 30), generateHarmoniousHue(baseHue, -30)];
      break;
    case "triadic":
      hues = [baseHue, generateHarmoniousHue(baseHue, 120), generateHarmoniousHue(baseHue, 240)];
      break;
    case "split-complementary":
      hues = [baseHue, generateHarmoniousHue(baseHue, 150), generateHarmoniousHue(baseHue, 210)];
      break;
    default:
      hues = [baseHue];
  }

  const primaryL = randomFloat(0.45, 0.65);
  const primaryC = randomFloat(0.12, 0.25);
  
  return {
    primary: `oklch(${primaryL} ${primaryC} ${hues[0].toFixed(1)})`,
    secondary: `oklch(${randomFloat(0.4, 0.6)} ${randomFloat(0.08, 0.18)} ${(hues[1] || hues[0]).toFixed(1)})`,
    tertiary: `oklch(${randomFloat(0.5, 0.7)} ${randomFloat(0.1, 0.2)} ${(hues[2] || generateHarmoniousHue(baseHue, 60)).toFixed(1)})`,
    accent: `oklch(${randomFloat(0.55, 0.75)} ${randomFloat(0.18, 0.28)} ${generateHarmoniousHue(baseHue, randomInt(90, 180)).toFixed(1)})`,
    background: `oklch(${randomFloat(0.92, 0.98)} ${randomFloat(0.01, 0.03)} ${baseHue.toFixed(1)})`,
    surface: `oklch(${randomFloat(0.88, 0.95)} ${randomFloat(0.02, 0.05)} ${baseHue.toFixed(1)})`,
  };
}

function generateRandomTokens(palette: RandomColorPalette, theme: typeof STYLE_THEMES[0]): Record<string, any> {
  const borderRadiusScale = randomElement([
    [0, 2, 4, 8, 12, 16, 24, 9999],
    [0, 4, 8, 16, 24, 32, 48, 9999],
    [0, 1, 2, 4, 6, 8, 12, 9999],
  ]);

  return {
    $schema: "https://design-tokens.github.io/community-group/format/2025.10/schema.json",
    color: {
      primary: { $type: "color", $value: palette.primary, $description: "Primary brand color" },
      secondary: { $type: "color", $value: palette.secondary, $description: "Secondary color" },
      tertiary: { $type: "color", $value: palette.tertiary, $description: "Tertiary color" },
      accent: { $type: "color", $value: palette.accent, $description: "Accent/highlight color" },
      background: { $type: "color", $value: palette.background, $description: "Page background" },
      surface: { $type: "color", $value: palette.surface, $description: "Card/panel background" },
    },
    spacing: {
      "0": { $type: "dimension", $value: "0px", $description: "No spacing" },
      "1": { $type: "dimension", $value: "4px", $description: "Extra small" },
      "2": { $type: "dimension", $value: "8px", $description: "Small" },
      "3": { $type: "dimension", $value: "12px", $description: "Small-medium" },
      "4": { $type: "dimension", $value: "16px", $description: "Medium" },
      "5": { $type: "dimension", $value: "20px", $description: "Medium-large" },
      "6": { $type: "dimension", $value: "24px", $description: "Large" },
      "8": { $type: "dimension", $value: "32px", $description: "Extra large" },
      "10": { $type: "dimension", $value: "40px", $description: "2x large" },
      "12": { $type: "dimension", $value: "48px", $description: "3x large" },
    },
    borderRadius: {
      none: { $type: "dimension", $value: `${borderRadiusScale[0]}px`, $description: "No rounding" },
      sm: { $type: "dimension", $value: `${borderRadiusScale[1]}px`, $description: "Small" },
      md: { $type: "dimension", $value: `${borderRadiusScale[2]}px`, $description: "Medium" },
      lg: { $type: "dimension", $value: `${borderRadiusScale[3]}px`, $description: "Large" },
      xl: { $type: "dimension", $value: `${borderRadiusScale[4]}px`, $description: "Extra large" },
      "2xl": { $type: "dimension", $value: `${borderRadiusScale[5]}px`, $description: "2x large" },
      "3xl": { $type: "dimension", $value: `${borderRadiusScale[6]}px`, $description: "3x large" },
      full: { $type: "dimension", $value: `${borderRadiusScale[7]}px`, $description: "Full/pill" },
    },
    shadow: {
      sm: {
        $type: "shadow",
        $value: {
          offsetX: "0px",
          offsetY: `${randomInt(1, 2)}px`,
          blur: `${randomInt(2, 4)}px`,
          spread: "0px",
          color: `oklch(0 0 0 / ${randomFloat(0.04, 0.08)})`,
        },
        $description: "Small shadow",
      },
      md: {
        $type: "shadow",
        $value: {
          offsetX: "0px",
          offsetY: `${randomInt(3, 6)}px`,
          blur: `${randomInt(6, 10)}px`,
          spread: "-1px",
          color: `oklch(0 0 0 / ${randomFloat(0.08, 0.12)})`,
        },
        $description: "Medium shadow",
      },
      lg: {
        $type: "shadow",
        $value: {
          offsetX: "0px",
          offsetY: `${randomInt(8, 15)}px`,
          blur: `${randomInt(15, 25)}px`,
          spread: "-3px",
          color: `oklch(0 0 0 / ${randomFloat(0.1, 0.15)})`,
        },
        $description: "Large shadow",
      },
    },
    typography: {
      fontFamily: {
        sans: { $type: "fontFamily", $value: "system-ui, -apple-system, sans-serif", $description: "Sans-serif" },
        serif: { $type: "fontFamily", $value: "Georgia, serif", $description: "Serif" },
        mono: { $type: "fontFamily", $value: "ui-monospace, monospace", $description: "Monospace" },
      },
      fontSize: {
        sm: { $type: "dimension", $value: "0.875rem", $description: "Small text" },
        base: { $type: "dimension", $value: "1rem", $description: "Base text" },
        lg: { $type: "dimension", $value: "1.125rem", $description: "Large text" },
        xl: { $type: "dimension", $value: "1.25rem", $description: "Extra large" },
        "2xl": { $type: "dimension", $value: "1.5rem", $description: "2x large" },
        "3xl": { $type: "dimension", $value: "1.875rem", $description: "3x large" },
        "4xl": { $type: "dimension", $value: "2.25rem", $description: "4x large" },
      },
    },
    motion: {
      duration: {
        fast: { $type: "duration", $value: `${randomInt(80, 120)}ms`, $description: "Fast" },
        normal: { $type: "duration", $value: `${randomInt(180, 250)}ms`, $description: "Normal" },
        slow: { $type: "duration", $value: `${randomInt(280, 400)}ms`, $description: "Slow" },
      },
      easing: {
        ease: { $type: "cubicBezier", $value: [0.25, 0.1, 0.25, 1], $description: "Default ease" },
        easeOut: { $type: "cubicBezier", $value: [0, 0, 0.58, 1], $description: "Ease out" },
      },
    },
    $extensions: {
      visualDNA: {
        version: "2.0.0",
        source: "random-generator",
        theme: theme.name,
        generatedAt: new Date().toISOString(),
      },
    },
  };
}

function generateStyleName(): string {
  return `${randomElement(ADJECTIVES)} ${randomElement(NOUNS)}`;
}

function generateDescription(theme: typeof STYLE_THEMES[0], palette: RandomColorPalette): string {
  const moodDesc = theme.mood.slice(0, 2).join(" and ");
  return `A ${moodDesc} visual style inspired by ${theme.name.toLowerCase()}. Features rich tones and harmonious color relationships that evoke a sense of ${theme.mood[0]} atmosphere.`;
}

function generatePromptScaffolding(theme: typeof STYLE_THEMES[0], palette: RandomColorPalette): RandomStyleResult["promptScaffolding"] {
  const basePrompts = [
    `${theme.mood.join(", ")} atmosphere with ${theme.name.toLowerCase()} color palette`,
    `Rich tones in the ${theme.name.toLowerCase()} spectrum, ${theme.mood[0]} mood`,
    `${theme.mood[0]} and ${theme.mood[1] || "elegant"} visual aesthetic`,
  ];

  const modifiers = [
    `dominant ${theme.name.toLowerCase()} tones`,
    `${randomElement(LIGHTING_OPTIONS)} lighting`,
    `${randomElement(TEXTURE_OPTIONS)} textures`,
    `high visual cohesion`,
    `${theme.mood[0]} emotional resonance`,
  ];

  return {
    base: randomElement(basePrompts),
    modifiers: randomElements(modifiers, randomInt(2, 4)),
    negative: "low quality, blurry, distorted, oversaturated, muddy colors, cluttered",
  };
}

function getColorFamily(hue: number): string[] {
  if (hue >= 0 && hue < 30) return ["red", "warm"];
  if (hue >= 30 && hue < 60) return ["orange", "warm"];
  if (hue >= 60 && hue < 90) return ["yellow", "warm"];
  if (hue >= 90 && hue < 150) return ["green", "natural"];
  if (hue >= 150 && hue < 210) return ["cyan", "cool"];
  if (hue >= 210 && hue < 270) return ["blue", "cool"];
  if (hue >= 270 && hue < 330) return ["purple", "cool"];
  return ["pink", "warm"];
}

export function generateRandomStyle(): RandomStyleResult {
  const theme = randomElement(STYLE_THEMES);
  const baseHue = randomInt(theme.hueRange[0], theme.hueRange[1]);
  const palette = generateColorPalette(baseHue);
  const tokens = generateRandomTokens(palette, theme);
  const promptScaffolding = generatePromptScaffolding(theme, palette);
  
  return {
    name: generateStyleName(),
    description: generateDescription(theme, palette),
    tokens,
    promptScaffolding,
    metadataTags: {
      mood: theme.mood,
      colorFamily: getColorFamily(baseHue),
      lighting: randomElements(LIGHTING_OPTIONS, 2),
      texture: randomElements(TEXTURE_OPTIONS, 2),
      era: theme.era,
      artPeriod: [],
      medium: randomElements(MEDIUM_OPTIONS, 2),
      subjects: randomElements(SUBJECT_OPTIONS, 3),
      keywords: [...theme.mood, theme.name.toLowerCase().replace(/\s+/g, "-")],
    },
  };
}
