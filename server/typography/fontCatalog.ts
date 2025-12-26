/**
 * Font Catalog
 * 
 * Curated Google Fonts with metadata scores on typography intent dimensions.
 * Each font is hand-scored based on its typographic characteristics.
 */

export interface FontMetadata {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'monospace' | 'handwriting';
  googleFontsUrl: string;
  
  // Intent dimension scores (0-1)
  serifness: number;
  weightBias: number;      // 0=light, 1=heavy (typical weight)
  widthBias: number;       // 0=condensed, 1=wide
  formality: number;
  humanist: number;
  decorative: number;
  legibility: number;
  
  // Era affinities (0-1)
  eraScores: {
    modern: number;
    industrial: number;
    classical: number;
    futurist: number;
  };
  
  // Brief description for explainability
  description: string;
}

/**
 * Curated font catalog - opinionated selection of versatile Google Fonts
 */
export const FONT_CATALOG: FontMetadata[] = [
  // === SANS-SERIF ===
  {
    family: 'Inter',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Inter',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.6,
    humanist: 0.4,
    decorative: 0.1,
    legibility: 0.95,
    eraScores: { modern: 0.9, industrial: 0.3, classical: 0.1, futurist: 0.6 },
    description: 'Highly legible, versatile sans-serif designed for screens',
  },
  {
    family: 'Space Grotesk',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Space+Grotesk',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.45,
    formality: 0.5,
    humanist: 0.3,
    decorative: 0.25,
    legibility: 0.85,
    eraScores: { modern: 0.8, industrial: 0.5, classical: 0.1, futurist: 0.9 },
    description: 'Technical grotesque with quirky details for tech and space themes',
  },
  {
    family: 'DM Sans',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/DM+Sans',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.55,
    humanist: 0.5,
    decorative: 0.15,
    legibility: 0.9,
    eraScores: { modern: 0.85, industrial: 0.3, classical: 0.2, futurist: 0.5 },
    description: 'Friendly geometric sans with subtle humanist touches',
  },
  {
    family: 'Plus Jakarta Sans',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Plus+Jakarta+Sans',
    serifness: 0.0,
    weightBias: 0.55,
    widthBias: 0.5,
    formality: 0.6,
    humanist: 0.45,
    decorative: 0.2,
    legibility: 0.88,
    eraScores: { modern: 0.9, industrial: 0.25, classical: 0.15, futurist: 0.6 },
    description: 'Contemporary geometric sans with elegant proportions',
  },
  {
    family: 'Outfit',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Outfit',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.55,
    formality: 0.5,
    humanist: 0.35,
    decorative: 0.2,
    legibility: 0.88,
    eraScores: { modern: 0.85, industrial: 0.35, classical: 0.1, futurist: 0.7 },
    description: 'Clean geometric sans with excellent weight range',
  },
  {
    family: 'Manrope',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Manrope',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.55,
    humanist: 0.4,
    decorative: 0.15,
    legibility: 0.9,
    eraScores: { modern: 0.88, industrial: 0.3, classical: 0.15, futurist: 0.65 },
    description: 'Semi-rounded geometric with modern professional feel',
  },
  {
    family: 'Work Sans',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Work+Sans',
    serifness: 0.0,
    weightBias: 0.45,
    widthBias: 0.5,
    formality: 0.6,
    humanist: 0.5,
    decorative: 0.1,
    legibility: 0.92,
    eraScores: { modern: 0.8, industrial: 0.4, classical: 0.2, futurist: 0.4 },
    description: 'Optimized for screen reading with humanist touches',
  },
  {
    family: 'Archivo',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Archivo',
    serifness: 0.0,
    weightBias: 0.6,
    widthBias: 0.45,
    formality: 0.7,
    humanist: 0.25,
    decorative: 0.15,
    legibility: 0.85,
    eraScores: { modern: 0.75, industrial: 0.7, classical: 0.15, futurist: 0.5 },
    description: 'Industrial grotesque with strong vertical emphasis',
  },
  {
    family: 'Sora',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Sora',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.55,
    humanist: 0.3,
    decorative: 0.25,
    legibility: 0.85,
    eraScores: { modern: 0.85, industrial: 0.3, classical: 0.1, futurist: 0.85 },
    description: 'Geometric sans with distinctive Japanese-inspired proportions',
  },
  {
    family: 'Rubik',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Rubik',
    serifness: 0.0,
    weightBias: 0.55,
    widthBias: 0.55,
    formality: 0.45,
    humanist: 0.4,
    decorative: 0.2,
    legibility: 0.88,
    eraScores: { modern: 0.8, industrial: 0.35, classical: 0.1, futurist: 0.5 },
    description: 'Friendly rounded sans with subtle quirkiness',
  },
  
  // === SERIF ===
  {
    family: 'Source Serif 4',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Source+Serif+4',
    serifness: 0.85,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.7,
    humanist: 0.6,
    decorative: 0.15,
    legibility: 0.9,
    eraScores: { modern: 0.6, industrial: 0.2, classical: 0.7, futurist: 0.2 },
    description: 'Contemporary serif with excellent readability',
  },
  {
    family: 'Lora',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Lora',
    serifness: 0.9,
    weightBias: 0.45,
    widthBias: 0.5,
    formality: 0.65,
    humanist: 0.7,
    decorative: 0.25,
    legibility: 0.88,
    eraScores: { modern: 0.5, industrial: 0.15, classical: 0.75, futurist: 0.15 },
    description: 'Calligraphic serif with moderate contrast',
  },
  {
    family: 'Fraunces',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Fraunces',
    serifness: 0.95,
    weightBias: 0.65,
    widthBias: 0.55,
    formality: 0.55,
    humanist: 0.75,
    decorative: 0.6,
    legibility: 0.7,
    eraScores: { modern: 0.6, industrial: 0.4, classical: 0.5, futurist: 0.3 },
    description: 'Expressive variable serif with distinctive character',
  },
  {
    family: 'Libre Baskerville',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Libre+Baskerville',
    serifness: 0.95,
    weightBias: 0.5,
    widthBias: 0.55,
    formality: 0.8,
    humanist: 0.55,
    decorative: 0.2,
    legibility: 0.85,
    eraScores: { modern: 0.3, industrial: 0.2, classical: 0.9, futurist: 0.1 },
    description: 'Classic transitional serif for formal contexts',
  },
  {
    family: 'Crimson Pro',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Crimson+Pro',
    serifness: 0.9,
    weightBias: 0.4,
    widthBias: 0.5,
    formality: 0.75,
    humanist: 0.6,
    decorative: 0.2,
    legibility: 0.88,
    eraScores: { modern: 0.4, industrial: 0.15, classical: 0.85, futurist: 0.1 },
    description: 'Refined old-style serif for long-form reading',
  },
  {
    family: 'Playfair Display',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Playfair+Display',
    serifness: 0.95,
    weightBias: 0.55,
    widthBias: 0.55,
    formality: 0.85,
    humanist: 0.5,
    decorative: 0.5,
    legibility: 0.65,
    eraScores: { modern: 0.45, industrial: 0.2, classical: 0.85, futurist: 0.15 },
    description: 'High-contrast display serif for elegant headlines',
  },
  {
    family: 'DM Serif Display',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/DM+Serif+Display',
    serifness: 0.9,
    weightBias: 0.55,
    widthBias: 0.5,
    formality: 0.7,
    humanist: 0.55,
    decorative: 0.35,
    legibility: 0.7,
    eraScores: { modern: 0.65, industrial: 0.25, classical: 0.6, futurist: 0.25 },
    description: 'Contemporary display serif with refined details',
  },
  {
    family: 'Cormorant Garamond',
    category: 'serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Cormorant+Garamond',
    serifness: 0.95,
    weightBias: 0.35,
    widthBias: 0.45,
    formality: 0.85,
    humanist: 0.65,
    decorative: 0.35,
    legibility: 0.75,
    eraScores: { modern: 0.25, industrial: 0.1, classical: 0.95, futurist: 0.05 },
    description: 'Elegant display Garamond for sophisticated contexts',
  },
  
  // === DISPLAY ===
  {
    family: 'Bebas Neue',
    category: 'display',
    googleFontsUrl: 'https://fonts.google.com/specimen/Bebas+Neue',
    serifness: 0.0,
    weightBias: 0.7,
    widthBias: 0.25,
    formality: 0.55,
    humanist: 0.15,
    decorative: 0.5,
    legibility: 0.5,
    eraScores: { modern: 0.7, industrial: 0.85, classical: 0.1, futurist: 0.6 },
    description: 'Bold condensed display for impactful headlines',
  },
  {
    family: 'Oswald',
    category: 'display',
    googleFontsUrl: 'https://fonts.google.com/specimen/Oswald',
    serifness: 0.0,
    weightBias: 0.6,
    widthBias: 0.3,
    formality: 0.55,
    humanist: 0.2,
    decorative: 0.35,
    legibility: 0.6,
    eraScores: { modern: 0.7, industrial: 0.75, classical: 0.15, futurist: 0.55 },
    description: 'Condensed gothic reworked for digital use',
  },
  {
    family: 'Poppins',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Poppins',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.55,
    formality: 0.5,
    humanist: 0.35,
    decorative: 0.2,
    legibility: 0.85,
    eraScores: { modern: 0.85, industrial: 0.3, classical: 0.1, futurist: 0.6 },
    description: 'Geometric sans with friendly, approachable character',
  },
  {
    family: 'Montserrat',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Montserrat',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.55,
    humanist: 0.3,
    decorative: 0.25,
    legibility: 0.82,
    eraScores: { modern: 0.8, industrial: 0.4, classical: 0.15, futurist: 0.55 },
    description: 'Urban geometric inspired by Buenos Aires signage',
  },
  {
    family: 'Barlow',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Barlow',
    serifness: 0.0,
    weightBias: 0.45,
    widthBias: 0.45,
    formality: 0.6,
    humanist: 0.35,
    decorative: 0.1,
    legibility: 0.88,
    eraScores: { modern: 0.8, industrial: 0.55, classical: 0.15, futurist: 0.65 },
    description: 'Slightly rounded grotesk with California tech aesthetics',
  },
  {
    family: 'IBM Plex Sans',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/IBM+Plex+Sans',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.7,
    humanist: 0.4,
    decorative: 0.1,
    legibility: 0.92,
    eraScores: { modern: 0.85, industrial: 0.5, classical: 0.2, futurist: 0.65 },
    description: 'Corporate grotesque with excellent technical clarity',
  },
  {
    family: 'Raleway',
    category: 'sans-serif',
    googleFontsUrl: 'https://fonts.google.com/specimen/Raleway',
    serifness: 0.0,
    weightBias: 0.35,
    widthBias: 0.55,
    formality: 0.65,
    humanist: 0.4,
    decorative: 0.3,
    legibility: 0.78,
    eraScores: { modern: 0.8, industrial: 0.3, classical: 0.25, futurist: 0.55 },
    description: 'Elegant display sans with Art Deco influences',
  },
  
  // === MONOSPACE ===
  {
    family: 'JetBrains Mono',
    category: 'monospace',
    googleFontsUrl: 'https://fonts.google.com/specimen/JetBrains+Mono',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.6,
    humanist: 0.2,
    decorative: 0.15,
    legibility: 0.9,
    eraScores: { modern: 0.9, industrial: 0.4, classical: 0.05, futurist: 0.85 },
    description: 'Developer-focused mono with excellent legibility',
  },
  {
    family: 'Fira Code',
    category: 'monospace',
    googleFontsUrl: 'https://fonts.google.com/specimen/Fira+Code',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.55,
    humanist: 0.25,
    decorative: 0.2,
    legibility: 0.88,
    eraScores: { modern: 0.85, industrial: 0.35, classical: 0.05, futurist: 0.8 },
    description: 'Programmer font with coding ligatures',
  },
  {
    family: 'Space Mono',
    category: 'monospace',
    googleFontsUrl: 'https://fonts.google.com/specimen/Space+Mono',
    serifness: 0.0,
    weightBias: 0.5,
    widthBias: 0.5,
    formality: 0.5,
    humanist: 0.2,
    decorative: 0.35,
    legibility: 0.75,
    eraScores: { modern: 0.7, industrial: 0.5, classical: 0.05, futurist: 0.95 },
    description: 'Retro-futurist mono with distinctive character',
  },
];

/**
 * Get all fonts in the catalog
 */
export function getAllFonts(): FontMetadata[] {
  return FONT_CATALOG;
}

/**
 * Get fonts by category
 */
export function getFontsByCategory(category: FontMetadata['category']): FontMetadata[] {
  return FONT_CATALOG.filter(font => font.category === category);
}

/**
 * Get a specific font by family name
 */
export function getFontByFamily(family: string): FontMetadata | undefined {
  return FONT_CATALOG.find(font => font.family.toLowerCase() === family.toLowerCase());
}
