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
}

export const SAMPLE_TOKENS: DTCGTokenGroup = {
  "color": {
    "palette": {
      "primary": { "$type": "color", "$value": "#2A2A2A" },
      "accent": { "$type": "color", "$value": "#FF4D4D" },
      "background": { "$type": "color", "$value": "#F5F5F5" }
    }
  },
  "typography": {
    "fontFamily": { "$type": "fontFamily", "$value": "Helvetica Neue" },
    "fontSize": { "$type": "dimension", "$value": "16px" }
  },
  "texture": {
    "grain": { "$type": "string", "$value": "fine-noise" },
    "finish": { "$type": "string", "$value": "matte" }
  },
  "lighting": {
    "type": { "$type": "string", "$value": "diffuse-studio" },
    "direction": { "$type": "string", "$value": "top-left" }
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

// Simple in-memory store for the prototype
let styles = [...MOCK_STYLES];

export const getStyles = () => styles;
export const getStyleById = (id: string) => styles.find(s => s.id === id);
export const addStyle = (style: Style) => {
  styles = [style, ...styles];
  return style;
};
