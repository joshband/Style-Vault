import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { styles } from "../shared/schema";
import type { MetadataTags, MoodBoardAssets, UiConceptAssets } from "../shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const sampleStyles = [
  {
    name: "Neon Synthwave",
    description: "Retro-futuristic aesthetic with vibrant neon colors, chrome accents, and 80s-inspired gradients. Perfect for music apps, gaming interfaces, and entertainment platforms.",
    tokens: {
      color: {
        primary: { $type: "color", $value: "#FF00FF", $description: "Hot pink primary" },
        secondary: { $type: "color", $value: "#00FFFF", $description: "Cyan secondary" },
        accent: { $type: "color", $value: "#FF6B00", $description: "Orange accent" },
        background: { $type: "color", $value: "#0D0221", $description: "Deep purple background" },
        surface: { $type: "color", $value: "#1A0A2E", $description: "Elevated surface" },
        text: { $type: "color", $value: "#FFFFFF", $description: "White text" },
      },
      spacing: {
        xs: { $type: "dimension", $value: "4px" },
        sm: { $type: "dimension", $value: "8px" },
        md: { $type: "dimension", $value: "16px" },
        lg: { $type: "dimension", $value: "24px" },
        xl: { $type: "dimension", $value: "32px" },
      },
      borderRadius: {
        sm: { $type: "dimension", $value: "4px" },
        md: { $type: "dimension", $value: "8px" },
        lg: { $type: "dimension", $value: "16px" },
      },
      typography: {
        fontFamily: { $type: "fontFamily", $value: "Orbitron, sans-serif" },
        headingWeight: { $type: "fontWeight", $value: 700 },
        bodyWeight: { $type: "fontWeight", $value: 400 },
      },
    },
    promptScaffolding: {
      base: "Synthwave aesthetic with neon glow effects, chrome reflections, and retro-futuristic design",
      modifiers: ["neon lighting", "chrome accents", "gradient backgrounds", "grid patterns", "sunset palette"],
      negative: "realistic, photography, muted colors, minimalist",
    },
    metadataTags: {
      mood: ["energetic", "nostalgic", "futuristic"],
      colorFamily: ["neon", "vibrant", "gradient"],
      lighting: ["neon glow", "dramatic", "high contrast"],
      texture: ["smooth", "glossy", "chrome"],
      era: ["1980s", "retro-futuristic"],
      artPeriod: ["synthwave", "vaporwave"],
      historicalInfluences: ["miami vice", "blade runner", "tron"],
      similarArtists: ["signalnoise", "james white"],
      medium: ["digital illustration", "vector art"],
      subjects: ["abstract", "geometric", "cityscapes"],
      usageExamples: ["music apps", "gaming UI", "entertainment platforms"],
      narrativeTone: ["exciting", "nostalgic"],
      sensoryPalette: ["electric", "warm glow"],
      movementRhythm: ["dynamic", "pulsing"],
      stylisticPrinciples: ["bold colors", "geometric shapes"],
      signatureMotifs: ["grid lines", "sun rays", "chrome text"],
      contrastDynamics: ["high contrast", "light on dark"],
      psychologicalEffect: ["energizing", "inspiring"],
      culturalResonance: ["80s nostalgia", "sci-fi"],
      audiencePerception: ["youthful", "creative"],
      keywords: ["synthwave", "neon", "retro", "80s", "cyberpunk", "gradient"],
    } as MetadataTags,
  },
  {
    name: "Minimal Nordic",
    description: "Clean Scandinavian design with muted earth tones, generous whitespace, and understated elegance. Ideal for productivity apps, e-commerce, and editorial layouts.",
    tokens: {
      color: {
        primary: { $type: "color", $value: "#2C3E50", $description: "Charcoal primary" },
        secondary: { $type: "color", $value: "#7F8C8D", $description: "Stone gray secondary" },
        accent: { $type: "color", $value: "#E67E22", $description: "Warm terracotta accent" },
        background: { $type: "color", $value: "#FAFAFA", $description: "Off-white background" },
        surface: { $type: "color", $value: "#FFFFFF", $description: "Pure white surface" },
        text: { $type: "color", $value: "#2C3E50", $description: "Dark charcoal text" },
      },
      spacing: {
        xs: { $type: "dimension", $value: "8px" },
        sm: { $type: "dimension", $value: "16px" },
        md: { $type: "dimension", $value: "24px" },
        lg: { $type: "dimension", $value: "48px" },
        xl: { $type: "dimension", $value: "64px" },
      },
      borderRadius: {
        sm: { $type: "dimension", $value: "2px" },
        md: { $type: "dimension", $value: "4px" },
        lg: { $type: "dimension", $value: "8px" },
      },
      typography: {
        fontFamily: { $type: "fontFamily", $value: "Inter, sans-serif" },
        headingWeight: { $type: "fontWeight", $value: 500 },
        bodyWeight: { $type: "fontWeight", $value: 400 },
      },
    },
    promptScaffolding: {
      base: "Minimal Scandinavian design with clean lines, muted colors, and generous whitespace",
      modifiers: ["clean layout", "soft shadows", "natural materials", "warm neutrals", "subtle textures"],
      negative: "cluttered, vibrant colors, ornate, busy patterns",
    },
    metadataTags: {
      mood: ["calm", "sophisticated", "serene"],
      colorFamily: ["neutral", "earth tones", "muted"],
      lighting: ["soft", "natural", "diffused"],
      texture: ["matte", "natural wood", "linen"],
      era: ["contemporary", "modern"],
      artPeriod: ["minimalism", "scandinavian design"],
      historicalInfluences: ["bauhaus", "japanese aesthetics"],
      similarArtists: ["dieter rams", "jony ive"],
      medium: ["product photography", "editorial design"],
      subjects: ["interiors", "products", "lifestyle"],
      usageExamples: ["productivity apps", "e-commerce", "editorial"],
      narrativeTone: ["refined", "thoughtful"],
      sensoryPalette: ["tactile", "warm"],
      movementRhythm: ["still", "balanced"],
      stylisticPrinciples: ["less is more", "functional beauty"],
      signatureMotifs: ["clean lines", "negative space", "natural materials"],
      contrastDynamics: ["subtle", "low contrast"],
      psychologicalEffect: ["calming", "focusing"],
      culturalResonance: ["nordic", "zen"],
      audiencePerception: ["professional", "premium"],
      keywords: ["minimal", "scandinavian", "clean", "nordic", "modern", "elegant"],
    } as MetadataTags,
  },
  {
    name: "Glassmorphic Aurora",
    description: "Modern frosted glass aesthetic with translucent layers, vibrant gradients, and depth effects. Perfect for fintech, dashboards, and contemporary mobile apps.",
    tokens: {
      color: {
        primary: { $type: "color", $value: "#6366F1", $description: "Indigo primary" },
        secondary: { $type: "color", $value: "#8B5CF6", $description: "Purple secondary" },
        accent: { $type: "color", $value: "#06B6D4", $description: "Cyan accent" },
        background: { $type: "color", $value: "#0F172A", $description: "Slate background" },
        surface: { $type: "color", $value: "rgba(255,255,255,0.1)", $description: "Glass surface" },
        text: { $type: "color", $value: "#F8FAFC", $description: "Light text" },
      },
      spacing: {
        xs: { $type: "dimension", $value: "4px" },
        sm: { $type: "dimension", $value: "8px" },
        md: { $type: "dimension", $value: "16px" },
        lg: { $type: "dimension", $value: "24px" },
        xl: { $type: "dimension", $value: "32px" },
      },
      borderRadius: {
        sm: { $type: "dimension", $value: "8px" },
        md: { $type: "dimension", $value: "16px" },
        lg: { $type: "dimension", $value: "24px" },
      },
      effects: {
        blur: { $type: "dimension", $value: "20px", $description: "Glass blur amount" },
        borderOpacity: { $type: "number", $value: 0.2 },
      },
      typography: {
        fontFamily: { $type: "fontFamily", $value: "SF Pro Display, sans-serif" },
        headingWeight: { $type: "fontWeight", $value: 600 },
        bodyWeight: { $type: "fontWeight", $value: 400 },
      },
    },
    promptScaffolding: {
      base: "Glassmorphic UI with frosted glass panels, aurora gradients, and layered depth",
      modifiers: ["frosted glass", "blur effects", "gradient overlays", "subtle borders", "floating cards"],
      negative: "flat design, solid colors, sharp edges, cluttered",
    },
    metadataTags: {
      mood: ["modern", "sophisticated", "futuristic"],
      colorFamily: ["gradient", "aurora", "cool tones"],
      lighting: ["ambient glow", "soft gradients", "diffused"],
      texture: ["frosted glass", "translucent", "smooth"],
      era: ["2020s", "contemporary"],
      artPeriod: ["glassmorphism", "neumorphism"],
      historicalInfluences: ["ios design", "material design"],
      similarArtists: ["apple design team", "stripe"],
      medium: ["digital interface", "UI design"],
      subjects: ["dashboards", "cards", "data visualization"],
      usageExamples: ["fintech apps", "dashboards", "mobile apps"],
      narrativeTone: ["premium", "trustworthy"],
      sensoryPalette: ["cool", "ethereal"],
      movementRhythm: ["fluid", "smooth"],
      stylisticPrinciples: ["depth through transparency", "layered design"],
      signatureMotifs: ["glass cards", "gradient borders", "blur layers"],
      contrastDynamics: ["subtle depth", "transparency layers"],
      psychologicalEffect: ["trustworthy", "innovative"],
      culturalResonance: ["tech-forward", "premium apps"],
      audiencePerception: ["modern", "sophisticated"],
      keywords: ["glassmorphism", "aurora", "gradient", "blur", "modern", "translucent"],
    } as MetadataTags,
  },
  {
    name: "Vintage Paper Craft",
    description: "Warm nostalgic aesthetic with aged paper textures, hand-drawn elements, and earthy color palettes. Great for creative portfolios, artisan brands, and storytelling apps.",
    tokens: {
      color: {
        primary: { $type: "color", $value: "#8B4513", $description: "Saddle brown primary" },
        secondary: { $type: "color", $value: "#CD853F", $description: "Peru secondary" },
        accent: { $type: "color", $value: "#B22222", $description: "Firebrick accent" },
        background: { $type: "color", $value: "#FAF0E6", $description: "Linen background" },
        surface: { $type: "color", $value: "#FFF8DC", $description: "Cornsilk surface" },
        text: { $type: "color", $value: "#3E2723", $description: "Dark brown text" },
      },
      spacing: {
        xs: { $type: "dimension", $value: "6px" },
        sm: { $type: "dimension", $value: "12px" },
        md: { $type: "dimension", $value: "20px" },
        lg: { $type: "dimension", $value: "32px" },
        xl: { $type: "dimension", $value: "48px" },
      },
      borderRadius: {
        sm: { $type: "dimension", $value: "0px" },
        md: { $type: "dimension", $value: "2px" },
        lg: { $type: "dimension", $value: "4px" },
      },
      typography: {
        fontFamily: { $type: "fontFamily", $value: "Playfair Display, serif" },
        headingWeight: { $type: "fontWeight", $value: 700 },
        bodyWeight: { $type: "fontWeight", $value: 400 },
      },
    },
    promptScaffolding: {
      base: "Vintage paper craft aesthetic with aged textures, hand-drawn illustrations, and warm earthy tones",
      modifiers: ["aged paper", "hand-drawn elements", "ink stamps", "worn edges", "sepia tones"],
      negative: "digital, sleek, modern, neon, minimalist",
    },
    metadataTags: {
      mood: ["nostalgic", "warm", "authentic"],
      colorFamily: ["earth tones", "warm browns", "sepia"],
      lighting: ["warm", "soft", "natural"],
      texture: ["paper grain", "aged", "tactile"],
      era: ["vintage", "retro", "timeless"],
      artPeriod: ["arts and crafts", "victorian"],
      historicalInfluences: ["letterpress", "bookbinding", "illustration"],
      similarArtists: ["jessica hische", "vintage illustrators"],
      medium: ["paper craft", "illustration", "print"],
      subjects: ["typography", "botanical", "decorative arts"],
      usageExamples: ["portfolios", "artisan brands", "storytelling"],
      narrativeTone: ["storytelling", "authentic"],
      sensoryPalette: ["tactile", "warm"],
      movementRhythm: ["organic", "flowing"],
      stylisticPrinciples: ["handmade quality", "attention to detail"],
      signatureMotifs: ["decorative borders", "flourishes", "stamps"],
      contrastDynamics: ["warm shadows", "aged patina"],
      psychologicalEffect: ["comforting", "trustworthy"],
      culturalResonance: ["artisanal", "heritage"],
      audiencePerception: ["authentic", "crafted"],
      keywords: ["vintage", "paper", "craft", "retro", "handmade", "nostalgic"],
    } as MetadataTags,
  },
  {
    name: "Cosmic Dark Mode",
    description: "Deep space aesthetic with dark backgrounds, subtle star fields, and ethereal accent colors. Ideal for developer tools, code editors, and night-mode interfaces.",
    tokens: {
      color: {
        primary: { $type: "color", $value: "#7C3AED", $description: "Violet primary" },
        secondary: { $type: "color", $value: "#4F46E5", $description: "Indigo secondary" },
        accent: { $type: "color", $value: "#10B981", $description: "Emerald accent" },
        background: { $type: "color", $value: "#09090B", $description: "Near black background" },
        surface: { $type: "color", $value: "#18181B", $description: "Zinc surface" },
        text: { $type: "color", $value: "#FAFAFA", $description: "Near white text" },
      },
      spacing: {
        xs: { $type: "dimension", $value: "4px" },
        sm: { $type: "dimension", $value: "8px" },
        md: { $type: "dimension", $value: "12px" },
        lg: { $type: "dimension", $value: "16px" },
        xl: { $type: "dimension", $value: "24px" },
      },
      borderRadius: {
        sm: { $type: "dimension", $value: "4px" },
        md: { $type: "dimension", $value: "6px" },
        lg: { $type: "dimension", $value: "8px" },
      },
      typography: {
        fontFamily: { $type: "fontFamily", $value: "JetBrains Mono, monospace" },
        headingWeight: { $type: "fontWeight", $value: 600 },
        bodyWeight: { $type: "fontWeight", $value: 400 },
      },
    },
    promptScaffolding: {
      base: "Cosmic dark mode interface with deep space backgrounds, subtle star fields, and glowing accents",
      modifiers: ["dark background", "star particles", "glowing elements", "subtle gradients", "monospace typography"],
      negative: "bright, colorful, light mode, busy patterns",
    },
    metadataTags: {
      mood: ["focused", "mysterious", "calm"],
      colorFamily: ["dark", "cosmic", "cool"],
      lighting: ["low light", "ambient glow", "point lights"],
      texture: ["smooth", "matte", "subtle grain"],
      era: ["contemporary", "futuristic"],
      artPeriod: ["dark mode design", "developer aesthetic"],
      historicalInfluences: ["terminal interfaces", "space imagery"],
      similarArtists: ["github", "vercel", "linear"],
      medium: ["digital interface", "code editor"],
      subjects: ["developer tools", "dashboards", "terminals"],
      usageExamples: ["code editors", "developer tools", "dark mode apps"],
      narrativeTone: ["focused", "technical"],
      sensoryPalette: ["cool", "quiet"],
      movementRhythm: ["still", "precise"],
      stylisticPrinciples: ["reduce eye strain", "focus on content"],
      signatureMotifs: ["star fields", "glow effects", "monospace text"],
      contrastDynamics: ["high contrast text", "subtle surface differences"],
      psychologicalEffect: ["focusing", "calming"],
      culturalResonance: ["developer culture", "night owls"],
      audiencePerception: ["professional", "technical"],
      keywords: ["dark mode", "cosmic", "developer", "space", "night", "terminal"],
    } as MetadataTags,
  },
  {
    name: "Playful Gradient",
    description: "Fun and vibrant design with colorful gradients, rounded shapes, and energetic compositions. Perfect for social apps, creative tools, and youth-oriented products.",
    tokens: {
      color: {
        primary: { $type: "color", $value: "#F472B6", $description: "Pink primary" },
        secondary: { $type: "color", $value: "#A78BFA", $description: "Violet secondary" },
        accent: { $type: "color", $value: "#FBBF24", $description: "Amber accent" },
        background: { $type: "color", $value: "#FFFFFF", $description: "White background" },
        surface: { $type: "color", $value: "#FDF4FF", $description: "Fuchsia tinted surface" },
        text: { $type: "color", $value: "#1F2937", $description: "Gray text" },
      },
      spacing: {
        xs: { $type: "dimension", $value: "6px" },
        sm: { $type: "dimension", $value: "12px" },
        md: { $type: "dimension", $value: "20px" },
        lg: { $type: "dimension", $value: "32px" },
        xl: { $type: "dimension", $value: "48px" },
      },
      borderRadius: {
        sm: { $type: "dimension", $value: "12px" },
        md: { $type: "dimension", $value: "20px" },
        lg: { $type: "dimension", $value: "32px" },
        full: { $type: "dimension", $value: "9999px" },
      },
      typography: {
        fontFamily: { $type: "fontFamily", $value: "Nunito, sans-serif" },
        headingWeight: { $type: "fontWeight", $value: 800 },
        bodyWeight: { $type: "fontWeight", $value: 600 },
      },
    },
    promptScaffolding: {
      base: "Playful design with vibrant gradients, rounded shapes, and energetic compositions",
      modifiers: ["colorful gradients", "rounded shapes", "bouncy animations", "friendly icons", "bold typography"],
      negative: "corporate, serious, muted, angular, minimal",
    },
    metadataTags: {
      mood: ["playful", "energetic", "joyful"],
      colorFamily: ["vibrant", "rainbow", "gradient"],
      lighting: ["bright", "cheerful", "even"],
      texture: ["smooth", "soft", "glossy"],
      era: ["contemporary", "2020s"],
      artPeriod: ["new wave design", "gen-z aesthetic"],
      historicalInfluences: ["memphis design", "pop art"],
      similarArtists: ["spotify design", "duolingo"],
      medium: ["digital illustration", "app design"],
      subjects: ["characters", "icons", "abstract shapes"],
      usageExamples: ["social apps", "creative tools", "youth products"],
      narrativeTone: ["friendly", "approachable"],
      sensoryPalette: ["sweet", "bubbly"],
      movementRhythm: ["bouncy", "dynamic"],
      stylisticPrinciples: ["fun first", "inclusive design"],
      signatureMotifs: ["blob shapes", "emoji-style icons", "confetti"],
      contrastDynamics: ["vibrant colors", "playful shadows"],
      psychologicalEffect: ["uplifting", "engaging"],
      culturalResonance: ["youth culture", "social media"],
      audiencePerception: ["fun", "accessible"],
      keywords: ["playful", "gradient", "colorful", "fun", "rounded", "vibrant"],
    } as MetadataTags,
  },
];

async function seedDatabase() {
  console.log("Starting database seed...\n");

  for (const styleData of sampleStyles) {
    try {
      const shareCode = generateShareCode();
      
      const emptyPreviews = {
        portrait: "",
        landscape: "",
        stillLife: "",
      };
      
      const moodBoard: MoodBoardAssets = {
        status: "pending",
        history: [],
      };
      
      const uiConcepts: UiConceptAssets = {
        status: "pending",
        history: [],
      };

      await db.insert(styles).values({
        name: styleData.name,
        description: styleData.description,
        tokens: styleData.tokens,
        promptScaffolding: styleData.promptScaffolding,
        metadataTags: styleData.metadataTags,
        previews: emptyPreviews,
        moodBoard,
        uiConcepts,
        isPublic: true,
        shareCode,
        metadataEnrichmentStatus: "complete",
      });

      console.log(`Created style: ${styleData.name} (share code: ${shareCode})`);
    } catch (error) {
      console.error(`Failed to create style "${styleData.name}":`, error);
    }
  }

  console.log("\nDatabase seed complete!");
  console.log(`Created ${sampleStyles.length} sample styles.`);
  
  await pool.end();
  process.exit(0);
}

seedDatabase().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
