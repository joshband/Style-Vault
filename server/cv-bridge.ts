/**
 * Node.js bridge to Python CV-based token extraction
 * 
 * This module provides a lightweight interface to the Python
 * CV token extractor, running it as a child process.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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
 * @returns Extracted tokens or error
 */
export async function extractTokensWithCV(imageBase64: string): Promise<CVExtractionResult> {
  const startTime = Date.now();
  
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

    pythonProcess.on('close', (code) => {
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
 * Convert CV-extracted tokens to W3C DTCG format
 */
export function convertToDTCG(cvTokens: CVExtractedTokens): Record<string, any> {
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
  cvTokens.color.forEach((color, index) => {
    const name = colorNames[index] || `color-${index + 1}`;
    dtcg.color.palette[name] = {
      $type: "color",
      $value: `oklch(${color.l} ${color.c} ${color.h})`,
      $description: `Extracted via CV analysis (${cvTokens.meta.method})`,
    };
  });

  cvTokens.spacing.forEach((value, index) => {
    dtcg.spacing[`space-${value}`] = {
      $type: "dimension",
      $value: `${value}px`,
      $description: "Detected spacing value",
    };
  });

  cvTokens.borderRadius.forEach((value, index) => {
    dtcg.borderRadius[`radius-${value}`] = {
      $type: "dimension",
      $value: `${value}px`,
      $description: "Detected border radius",
    };
  });

  dtcg.elevation = {
    level: {
      $type: "number",
      $value: cvTokens.elevation.elevation,
      $description: `Shadow strength: ${cvTokens.elevation.shadowStrength}`,
    },
  };

  cvTokens.strokeWidth.forEach((value) => {
    dtcg.strokeWidth[`stroke-${value}`] = {
      $type: "dimension",
      $value: `${value}px`,
      $description: "Detected stroke width",
    };
  });

  return dtcg;
}
