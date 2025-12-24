export interface DesignToken {
  $type: string;
  $value: string | number | object;
  $description?: string;
  [key: string]: any;
}

export interface DTCGTokenGroup {
  [key: string]: DesignToken | DTCGTokenGroup;
}

export interface StylePreview {
  url: string;
  type: 'still-life' | 'landscape' | 'portrait' | 'reference';
}

export interface MetadataTags {
  mood: string[];
  colorFamily: string[];
  era: string[];
  medium: string[];
  subjects: string[];
  lighting: string[];
  texture: string[];
}

export interface MoodBoardAssets {
  collage: string;
  status: "pending" | "generating" | "complete" | "failed";
}

export interface UiConceptAssets {
  audioPlugin?: string;
  dashboard?: string;
  componentLibrary?: string;
  status: "pending" | "generating" | "complete" | "failed";
}

export interface Style {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  
  // Images
  referenceImages: string[];
  previews: {
    stillLife: string;
    landscape: string;
    portrait: string;
  };
  
  // Tokens
  tokens: DTCGTokenGroup;
  
  // Prompt Scaffolding
  promptScaffolding: {
    base: string;
    modifiers: string[];
    negative: string;
  };

  // Metadata Tags for visual descriptors
  metadataTags?: MetadataTags;

  // AI-generated mood board and UI concepts
  moodBoard?: MoodBoardAssets | null;
  uiConcepts?: UiConceptAssets | null;
}

export const SAMPLE_TOKENS: DTCGTokenGroup = {
  "color": {
    "primary": { 
      "$type": "color", 
      "$value": "#2A2A2A",
      "$description": "Primary dominant color from image"
    },
    "secondary": { 
      "$type": "color", 
      "$value": "#6B5B4D",
      "$description": "Secondary color supporting primary"
    },
    "accent": { 
      "$type": "color", 
      "$value": "#FF4D4D",
      "$description": "Accent color for highlights and emphasis"
    },
    "background": { 
      "$type": "color", 
      "$value": "#F5F5F5",
      "$description": "Background neutral tone"
    },
    "surface": {
      "$type": "color",
      "$value": "#FFFFFF",
      "$description": "Surface layer color"
    },
    "neutral": {
      "$type": "color",
      "$value": "#E0E0E0",
      "$description": "Neutral gray for borders and dividers"
    }
  },
  "typography": {
    "fontFamily": {
      "serif": { 
        "$type": "fontFamily", 
        "$value": "Lora, Georgia, serif",
        "$description": "Serif font for headings and emphasis"
      },
      "sans": { 
        "$type": "fontFamily", 
        "$value": "Inter, -apple-system, sans-serif",
        "$description": "Sans-serif font for body and UI"
      },
      "mono": { 
        "$type": "fontFamily", 
        "$value": "JetBrains Mono, Courier, monospace",
        "$description": "Monospace font for code and technical content"
      }
    },
    "fontSize": {
      "xs": { "$type": "dimension", "$value": "12px" },
      "sm": { "$type": "dimension", "$value": "14px" },
      "base": { "$type": "dimension", "$value": "16px" },
      "lg": { "$type": "dimension", "$value": "18px" },
      "xl": { "$type": "dimension", "$value": "20px" },
      "2xl": { "$type": "dimension", "$value": "24px" },
      "3xl": { "$type": "dimension", "$value": "30px" },
      "4xl": { "$type": "dimension", "$value": "36px" }
    },
    "fontWeight": {
      "light": { "$type": "number", "$value": 300 },
      "regular": { "$type": "number", "$value": 400 },
      "medium": { "$type": "number", "$value": 500 },
      "semibold": { "$type": "number", "$value": 600 },
      "bold": { "$type": "number", "$value": 700 }
    },
    "lineHeight": {
      "tight": { "$type": "number", "$value": 1.2 },
      "normal": { "$type": "number", "$value": 1.5 },
      "relaxed": { "$type": "number", "$value": 1.75 }
    }
  },
  "spacing": {
    "xs": { "$type": "dimension", "$value": "4px" },
    "sm": { "$type": "dimension", "$value": "8px" },
    "md": { "$type": "dimension", "$value": "16px" },
    "lg": { "$type": "dimension", "$value": "24px" },
    "xl": { "$type": "dimension", "$value": "32px" },
    "2xl": { "$type": "dimension", "$value": "48px" },
    "3xl": { "$type": "dimension", "$value": "64px" }
  },
  "borderRadius": {
    "none": { "$type": "dimension", "$value": "0px" },
    "sm": { "$type": "dimension", "$value": "2px" },
    "md": { "$type": "dimension", "$value": "4px" },
    "lg": { "$type": "dimension", "$value": "8px" },
    "full": { "$type": "dimension", "$value": "9999px" }
  },
  "shadow": {
    "xs": {
      "$type": "shadow",
      "$value": { "offsetX": "0px", "offsetY": "1px", "blur": "2px", "color": "rgba(0, 0, 0, 0.05)" }
    },
    "sm": {
      "$type": "shadow",
      "$value": { "offsetX": "0px", "offsetY": "4px", "blur": "6px", "color": "rgba(0, 0, 0, 0.1)" }
    },
    "md": {
      "$type": "shadow",
      "$value": { "offsetX": "0px", "offsetY": "10px", "blur": "15px", "color": "rgba(0, 0, 0, 0.15)" }
    }
  },
  "texture": {
    "grain": { 
      "$type": "string", 
      "$value": "fine-noise",
      "$description": "Subtle grain pattern applied to surfaces"
    },
    "finish": { 
      "$type": "string", 
      "$value": "matte",
      "$description": "Surface finish: matte, glossy, satin"
    },
    "roughness": {
      "$type": "number",
      "$value": 0.65,
      "$description": "Surface roughness for 3D materials (0-1)"
    }
  },
  "lighting": {
    "type": { 
      "$type": "string", 
      "$value": "diffuse-studio",
      "$description": "Primary lighting setup type"
    } as DesignToken,
    "direction": { 
      "$type": "string", 
      "$value": "top-left",
      "$description": "Primary light direction"
    } as DesignToken,
    "intensity": {
      "$type": "dimension",
      "$value": "0.8",
      "$description": "Light intensity multiplier (0-1)"
    } as DesignToken,
    "ambientOcclusion": {
      "$type": "string",
      "$value": "enabled",
      "$description": "Enable ambient occlusion for depth"
    } as DesignToken
  },
  "composition": {
    "aspectRatio": {
      "landscape": { "$type": "string", "$value": "16:9" },
      "square": { "$type": "string", "$value": "1:1" },
      "portrait": { "$type": "string", "$value": "3:4" }
    },
    "alignment": {
      "$type": "string",
      "$value": "grid-based",
      "$description": "Alignment system: grid-based, modular"
    },
    "depth": {
      "$type": "number",
      "$value": 3,
      "$description": "Number of depth layers in composition"
    }
  },
  "motion": {
    "duration": {
      "fast": { "$type": "dimension", "$value": "150ms" },
      "normal": { "$type": "dimension", "$value": "300ms" },
      "slow": { "$type": "dimension", "$value": "500ms" }
    },
    "easing": {
      "$type": "string",
      "$value": "cubic-bezier(0.4, 0, 0.2, 1)",
      "$description": "Default easing function for transitions"
    }
  },
  "mood": {
    "tone": { 
      "$type": "string", 
      "$value": "editorial",
      "$description": "Overall tone: editorial, playful, minimal, bold"
    },
    "saturation": {
      "$type": "number",
      "$value": 0.85,
      "$description": "Color saturation level (0-1)"
    },
    "contrast": {
      "$type": "number",
      "$value": 1.1,
      "$description": "Contrast multiplier (1.0 = normal)"
    }
  }
};

export const MOCK_STYLES: Style[] = [
  {
    id: "style-001",
    name: "Neo-Brutalist Clay",
    description: "Soft clay render style with harsh geometric shadows and vibrant primary colors.",
    createdAt: "2024-03-10T14:30:00Z",
    referenceImages: ["https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=600&auto=format&fit=crop"],
    previews: {
      stillLife: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=600&auto=format&fit=crop",
      landscape: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=600&auto=format&fit=crop",
      portrait: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
    },
    tokens: SAMPLE_TOKENS,
    promptScaffolding: {
      base: "3d clay render, isometric view",
      modifiers: ["soft lighting", "matte finish", "vibrant colors", "geometric shapes"],
      negative: "photo-realistic, noisy, grainy, dark"
    }
  },
  {
    id: "style-002",
    name: "Cyber-Noir Film",
    description: "High contrast, neon-lit rainy streets, cinematic grain and anamorphic lens flares.",
    createdAt: "2024-03-12T09:15:00Z",
    referenceImages: ["https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=600&auto=format&fit=crop"],
    previews: {
      stillLife: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=600&auto=format&fit=crop",
      landscape: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=600&auto=format&fit=crop",
      portrait: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=600&auto=format&fit=crop",
    },
    tokens: {
      ...SAMPLE_TOKENS,
      "lighting": { "type": { "$type": "string", "$value": "neon-volumetric" } }
    },
    promptScaffolding: {
      base: "cinematic shot, cyberpunk atmosphere",
      modifiers: ["neon lights", "rain", "wet pavement", "anamorphic lens flare", "film grain"],
      negative: "bright day, flat lighting, cartoon, 3d render"
    }
  },
  {
    id: "style-003",
    name: "Bauhaus Minimal",
    description: "Clean lines, primary colors, geometric abstraction, lack of ornamentation.",
    createdAt: "2024-03-14T11:45:00Z",
    referenceImages: ["https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?q=80&w=600&auto=format&fit=crop"],
    previews: {
      stillLife: "https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?q=80&w=600&auto=format&fit=crop",
      landscape: "https://images.unsplash.com/photo-1584285465710-53b475459392?q=80&w=600&auto=format&fit=crop",
      portrait: "https://images.unsplash.com/photo-1515462277126-2dd0c162007a?q=80&w=600&auto=format&fit=crop",
    },
    tokens: {
      ...SAMPLE_TOKENS,
      "color": { 
        "palette": {
          "primary": { "$type": "color", "$value": "#FFD700" }, // Yellow
          "secondary": { "$type": "color", "$value": "#0057B7" }, // Blue
          "accent": { "$type": "color", "$value": "#DA291C" } // Red
        }
      }
    },
    promptScaffolding: {
      base: "bauhaus style illustration",
      modifiers: ["geometric shapes", "clean lines", "primary colors", "minimalist composition"],
      negative: "ornamentation, texture, shading, realistic"
    }
  }
];

// API functions for persistent storage
export async function fetchStyles(): Promise<Style[]> {
  const response = await fetch("/api/styles");
  if (!response.ok) {
    throw new Error("Failed to fetch styles");
  }
  return response.json();
}

export async function fetchStyleById(id: string): Promise<Style | null> {
  const response = await fetch(`/api/styles/${id}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Failed to fetch style");
  }
  return response.json();
}

export async function createStyle(style: Omit<Style, "id" | "createdAt">): Promise<Style> {
  const response = await fetch("/api/styles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(style),
  });
  if (!response.ok) {
    throw new Error("Failed to create style");
  }
  return response.json();
}

export async function deleteStyleApi(id: string): Promise<void> {
  const response = await fetch(`/api/styles/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete style");
  }
}
