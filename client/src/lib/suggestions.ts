import { Style } from "./store";

// Track browsing history in localStorage
const HISTORY_KEY = "style-browsing-history";
const MAX_HISTORY = 20;

export interface BrowsingHistoryItem {
  styleId: string;
  viewedAt: number;
}

/**
 * Add a style to browsing history
 */
export function trackStyleView(styleId: string) {
  try {
    const history = getBrowsingHistory();
    // Remove if already exists (to move to top)
    const filtered = history.filter((item) => item.styleId !== styleId);
    // Add new entry at the beginning
    const updated = [{ styleId, viewedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to track style view:", e);
  }
}

/**
 * Get browsing history
 */
export function getBrowsingHistory(): BrowsingHistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn("Failed to read browsing history:", e);
    return [];
  }
}

/**
 * Calculate similarity between two styles based on tokens and description
 */
export function calculateStyleSimilarity(style1: Style, style2: Style): number {
  let score = 0;

  // Color palette similarity (weights token colors)
  const colors1 = extractColors(style1.tokens);
  const colors2 = extractColors(style2.tokens);
  if (colors1.length > 0 && colors2.length > 0) {
    const colorMatch = colors1.filter((c) => colors2.includes(c)).length;
    score += (colorMatch / Math.max(colors1.length, colors2.length)) * 30;
  }

  // Typography similarity
  const fonts1 = extractFonts(style1.tokens);
  const fonts2 = extractFonts(style2.tokens);
  if (fonts1.length > 0 && fonts2.length > 0) {
    const fontMatch = fonts1.filter((f) => fonts2.includes(f)).length;
    score += (fontMatch / Math.max(fonts1.length, fonts2.length)) * 20;
  }

  // Description similarity (keyword matching)
  const desc1 = style1.description.toLowerCase().split(/\s+/);
  const desc2 = style2.description.toLowerCase().split(/\s+/);
  const commonWords = desc1.filter((w) => desc2.includes(w) && w.length > 3);
  score += Math.min((commonWords.length / Math.max(desc1.length, desc2.length)) * 50, 50);

  return Math.min(score, 100);
}

/**
 * Extract color values from tokens
 */
function extractColors(tokens: any): string[] {
  const colors: string[] = [];

  function traverse(obj: any) {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      const value = obj[key];
      if (key === "color" && typeof value === "object") {
        for (const colorKey in value) {
          const colorObj = value[colorKey];
          if (colorObj.$value && typeof colorObj.$value === "string") {
            colors.push(colorObj.$value.toLowerCase());
          }
        }
      } else if (typeof value === "object") {
        traverse(value);
      }
    }
  }

  traverse(tokens);
  return Array.from(new Set(colors));
}

/**
 * Extract font families from tokens
 */
function extractFonts(tokens: any): string[] {
  const fonts: string[] = [];

  function traverse(obj: any) {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      const value = obj[key];
      if (key === "fontFamily" && typeof value === "object") {
        for (const fontKey in value) {
          const fontObj = value[fontKey];
          if (fontObj.$value && typeof fontObj.$value === "string") {
            // Extract primary font family
            const primary = fontObj.$value.split(",")[0].trim();
            fonts.push(primary.toLowerCase());
          }
        }
      } else if (typeof value === "object") {
        traverse(value);
      }
    }
  }

  traverse(tokens);
  return Array.from(new Set(fonts));
}

/**
 * Get recommended styles based on browsing history and similarity
 */
export function getRecommendedStyles(allStyles: Style[], limit: number = 3): Style[] {
  if (allStyles.length === 0) return [];

  const history = getBrowsingHistory();
  if (history.length === 0) {
    // If no history, return random diverse styles
    return allStyles.slice(0, limit);
  }

  // Get styles the user has viewed
  const viewedStyleIds = new Set(history.map((item) => item.styleId));
  const viewedStyles = allStyles.filter((s) => viewedStyleIds.has(s.id));

  if (viewedStyles.length === 0) {
    return allStyles.slice(0, limit);
  }

  // Score all unviewed styles based on similarity to viewed styles
  const unviewedStyles = allStyles.filter((s) => !viewedStyleIds.has(s.id));
  const scores = unviewedStyles.map((style) => {
    // Calculate average similarity to all viewed styles
    const similarities = viewedStyles.map((viewed) => calculateStyleSimilarity(style, viewed));
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

    return { style, score: avgSimilarity };
  });

  // Sort by score (descending) and return top N
  return scores.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.style);
}
