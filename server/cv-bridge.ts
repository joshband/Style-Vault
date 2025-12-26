/**
 * Node.js bridge to Python CV-based token extraction
 * 
 * This module provides a lightweight interface to the Python
 * CV token extractor, running it as a child process.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeImageHash, getCachedTokens, setCachedTokens } from './token-cache';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CVColorToken {
  space: string;
  l: number;
  c: number;
  h: number;
}

export interface CVGridToken {
  columns: number;
  rows: number;
}

export interface CVElevationToken {
  elevation: number;
  shadowStrength: number;
  direction: string;
  directionAngle: number;
  blurRadius: number;
  contrast: number;
  depthStyle: string;
  distribution: {
    dark: number;
    mid: number;
    light: number;
  };
  shadowColor: {
    space: string;
    l: number;
    c: number;
    h: number;
  } | null;
}

export interface CVExtractedTokens {
  color: CVColorToken[];
  spacing: number[];
  borderRadius: number[];
  grid: CVGridToken;
  elevation: CVElevationToken;
  strokeWidth: number[];
  meta: {
    method: string;
    confidence: string;
    realtimeSafe: boolean;
  };
}

export interface CVExtractionResult {
  success: boolean;
  tokens?: CVExtractedTokens;
  error?: string;
  processingTimeMs?: number;
}

export interface CVDebugVisual {
  label: string;
  description: string;
  image: string;
}

export interface CVDebugInfo {
  visuals: CVDebugVisual[];
  steps: string[];
}

export interface CVWalkthroughResult {
  success: boolean;
  tokens?: CVExtractedTokens;
  debug?: Record<string, CVDebugInfo>;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Check if CV extraction is enabled via environment variable
 */
export function isCVExtractionEnabled(): boolean {
  return process.env.CV_EXTRACTION_ENABLED === 'true';
}

/**
 * Extract design tokens from an image using Python CV
 * 
 * @param imageBase64 - Base64 encoded image data (with or without data URL prefix)
 * @param useCache - Whether to use caching (default: true)
 * @returns Extracted tokens or error
 */
export async function extractTokensWithCV(imageBase64: string, useCache: boolean = true): Promise<CVExtractionResult> {
  const startTime = Date.now();
  
  const imageHash = computeImageHash(imageBase64);
  
  if (useCache) {
    const cached = await getCachedTokens(imageHash);
    if (cached) {
      return {
        success: true,
        tokens: cached as CVExtractedTokens,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'cv', 'extract_tokens.py');
    
    const pythonProcess = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      const processingTimeMs = Date.now() - startTime;

      if (code !== 0) {
        console.error('[CV Bridge] Python process failed:', stderr);
        resolve({
          success: false,
          error: stderr || 'CV extraction failed',
          processingTimeMs,
        });
        return;
      }

      try {
        const tokens = JSON.parse(stdout) as CVExtractedTokens;
        
        if (useCache) {
          await setCachedTokens(imageHash, tokens, processingTimeMs);
        }
        
        resolve({
          success: true,
          tokens,
          processingTimeMs,
        });
      } catch (parseError) {
        console.error('[CV Bridge] Failed to parse output:', stdout);
        resolve({
          success: false,
          error: 'Failed to parse CV extraction output',
          processingTimeMs,
        });
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('[CV Bridge] Process error:', err);
      resolve({
        success: false,
        error: `Process error: ${err.message}`,
        processingTimeMs: Date.now() - startTime,
      });
    });

    pythonProcess.stdin.write(imageBase64);
    pythonProcess.stdin.end();
  });
}

/**
 * Extract design tokens with walkthrough mode (includes debug visualizations and explanations)
 * 
 * @param imageBase64 - Base64 encoded image data
 * @returns Extracted tokens with debug info or error
 */
export async function extractTokensWithWalkthrough(imageBase64: string): Promise<CVWalkthroughResult> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'cv', 'extract_tokens.py');
    
    const pythonProcess = spawn('python3', [scriptPath, '--with-visuals'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code: number | null) => {
      const processingTimeMs = Date.now() - startTime;

      if (code !== 0) {
        console.error('[CV Bridge] Walkthrough process failed:', stderr);
        resolve({
          success: false,
          error: stderr || 'CV walkthrough extraction failed',
          processingTimeMs,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve({
          success: true,
          tokens: result.tokens as CVExtractedTokens,
          debug: result.debug as Record<string, CVDebugInfo>,
          processingTimeMs,
        });
      } catch (parseError) {
        console.error('[CV Bridge] Failed to parse walkthrough output:', stdout.substring(0, 500));
        resolve({
          success: false,
          error: 'Failed to parse CV walkthrough output',
          processingTimeMs,
        });
      }
    });

    pythonProcess.on('error', (err: Error) => {
      console.error('[CV Bridge] Walkthrough process error:', err);
      resolve({
        success: false,
        error: `Process error: ${err.message}`,
        processingTimeMs: Date.now() - startTime,
      });
    });

    pythonProcess.stdin.write(imageBase64);
    pythonProcess.stdin.end();
  });
}

/**
 * Validate and normalize a single OKLCH color token
 * Returns normalized values with bounds checking
 * Note: OKLCH chroma can go up to ~0.5 for very saturated colors
 */
function normalizeOklchColor(color: CVColorToken): CVColorToken {
  return {
    space: color.space || 'oklch',
    l: Math.max(0, Math.min(1, color.l || 0)),
    c: Math.max(0, Math.min(0.5, color.c || 0)),
    h: color.h != null && !isNaN(color.h) ? ((color.h % 360) + 360) % 360 : 0,
  };
}

/**
 * Convert OKLCH to linear sRGB
 * Based on CSS Color Level 4 specification
 */
function oklchToLinearSrgb(l: number, c: number, h: number): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const lCubed = l_ * l_ * l_;
  const mCubed = m_ * m_ * m_;
  const sCubed = s_ * s_ * s_;

  const r = +4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed;
  const g = -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed;
  const bOut = -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.7076147010 * sCubed;

  return [r, g, bOut];
}

/**
 * Apply sRGB gamma correction (linear to sRGB)
 */
function linearToSrgb(c: number): number {
  if (c <= 0.0031308) {
    return 12.92 * c;
  }
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Convert OKLCH color to hex string
 */
function oklchToHex(l: number, c: number, h: number): string {
  const [rLin, gLin, bLin] = oklchToLinearSrgb(l, c, h);
  
  const r = Math.round(Math.max(0, Math.min(1, linearToSrgb(rLin))) * 255);
  const g = Math.round(Math.max(0, Math.min(1, linearToSrgb(gLin))) * 255);
  const b = Math.round(Math.max(0, Math.min(1, linearToSrgb(bLin))) * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Validate extracted tokens and log any issues
 * Returns true if tokens are valid enough to use
 */
export function validateExtractedTokens(tokens: CVExtractedTokens): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!tokens.color || tokens.color.length === 0) {
    warnings.push("No colors extracted");
  } else if (tokens.color.length < 3) {
    warnings.push(`Only ${tokens.color.length} colors extracted, palette may be limited`);
  }
  
  if (!tokens.spacing || tokens.spacing.length === 0) {
    warnings.push("No spacing values detected");
  }
  
  const valid = tokens.color && tokens.color.length > 0;
  
  if (warnings.length > 0) {
    console.log('[CV Validation] Warnings:', warnings.join('; '));
  }
  
  return { valid, warnings };
}

/**
 * Convert CV-extracted tokens to W3C DTCG format
 * Includes validation and normalization
 */
export function convertToDTCG(cvTokens: CVExtractedTokens): Record<string, any> {
  const validation = validateExtractedTokens(cvTokens);
  if (!validation.valid) {
    console.warn('[CV Bridge] Token validation failed:', validation.warnings);
    throw new Error(`CV token extraction failed: ${validation.warnings.join('; ')}`);
  }
  
  const dtcg: Record<string, any> = {
    $schema: "https://design-tokens.github.io/community-group/format/",
    color: {
      palette: {},
    },
    spacing: {},
    borderRadius: {},
    elevation: {},
    strokeWidth: {},
  };

  const colorNames = ['primary', 'secondary', 'tertiary', 'accent', 'background', 'surface', 'muted', 'subtle'];
  const colors = cvTokens.color || [];
  colors.forEach((color, index) => {
    const name = colorNames[index] || `color-${index + 1}`;
    const normalized = normalizeOklchColor(color);
    const hexValue = oklchToHex(normalized.l, normalized.c, normalized.h);
    dtcg.color.palette[name] = {
      $type: "color",
      $value: hexValue,
      $description: `Extracted via CV analysis (${cvTokens.meta.method})`,
    };
  });

  const validSpacing = cvTokens.spacing.filter(s => s > 0 && s <= 500);
  const uniqueSpacing = Array.from(new Set(validSpacing)).sort((a, b) => a - b);
  uniqueSpacing.forEach((value) => {
    dtcg.spacing[`space-${value}`] = {
      $type: "dimension",
      $value: `${value}px`,
      $description: "Detected spacing value",
    };
  });

  const validRadius = cvTokens.borderRadius.filter(r => r >= 0 && r <= 200);
  const uniqueRadius = Array.from(new Set(validRadius)).sort((a, b) => a - b);
  uniqueRadius.forEach((value) => {
    dtcg.borderRadius[`radius-${value}`] = {
      $type: "dimension",
      $value: `${value}px`,
      $description: "Detected border radius",
    };
  });

  const elevationLevel = Math.max(0, Math.min(3, cvTokens.elevation.elevation || 0));
  const shadowStrength = Math.max(0, Math.min(1, cvTokens.elevation.shadowStrength || 0));
  dtcg.elevation = {
    level: {
      $type: "number",
      $value: elevationLevel,
      $description: `Shadow strength: ${shadowStrength.toFixed(2)}`,
    },
  };

  const validStroke = cvTokens.strokeWidth.filter(s => s > 0 && s <= 20);
  const uniqueStroke = Array.from(new Set(validStroke)).sort((a, b) => a - b);
  uniqueStroke.forEach((value) => {
    dtcg.strokeWidth[`stroke-${value}`] = {
      $type: "dimension",
      $value: `${value}px`,
      $description: "Detected stroke width",
    };
  });

  return dtcg;
}
