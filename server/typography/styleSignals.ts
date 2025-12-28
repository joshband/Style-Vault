/**
 * Style Signal Extraction
 * 
 * Extracts visual signals from images that inform typography decisions.
 * Uses lightweight CV heuristics - no ML required.
 */

export interface StyleSignals {
  contrast: number;          // 0-1: low to high contrast
  edgeSharpness: number;     // 0-1: soft/blurry to sharp/crisp
  geometricBias: number;     // 0-1: organic to geometric
  visualDensity: number;     // 0-1: sparse to dense
  symmetry: number;          // 0-1: asymmetric to symmetric
  materialBias: 'paper' | 'metal' | 'glass' | 'organic' | 'digital' | 'unknown';
  colorTemperature: number;  // 0-1: cool to warm
  luminanceRange: number;    // 0-1: narrow to wide tonal range
}

export interface SignalExtractionResult {
  success: boolean;
  signals?: StyleSignals;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Extract style signals from an image using Python CV backend
 */
export async function extractStyleSignals(imageBase64: string): Promise<SignalExtractionResult> {
  const startTime = Date.now();
  
  try {
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.join(__dirname, '..', 'cv', 'extract_typography_signals.py');
    
    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
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
          console.error('[Typography Signals] Python process failed:', stderr);
          resolve({
            success: false,
            error: stderr || 'Signal extraction failed',
            processingTimeMs,
          });
          return;
        }

        try {
          const rawSignals = JSON.parse(stdout);
          const signals = normalizeSignals(rawSignals);
          
          resolve({
            success: true,
            signals,
            processingTimeMs,
          });
        } catch (parseError) {
          console.error('[Typography Signals] Failed to parse output:', stdout);
          resolve({
            success: false,
            error: 'Failed to parse signal extraction output',
            processingTimeMs,
          });
        }
      });

      pythonProcess.on('error', (err: Error) => {
        console.error('[Typography Signals] Process error:', err);
        resolve({
          success: false,
          error: `Process error: ${err.message}`,
          processingTimeMs: Date.now() - startTime,
        });
      });

      pythonProcess.stdin.write(imageBase64);
      pythonProcess.stdin.end();
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Normalize raw CV output to consistent 0-1 ranges
 */
function normalizeSignals(raw: any): StyleSignals {
  return {
    contrast: clamp(raw.contrast ?? 0.5, 0, 1),
    edgeSharpness: clamp(raw.edgeSharpness ?? raw.edge_sharpness ?? 0.5, 0, 1),
    geometricBias: clamp(raw.geometricBias ?? raw.geometric_bias ?? 0.5, 0, 1),
    visualDensity: clamp(raw.visualDensity ?? raw.visual_density ?? 0.5, 0, 1),
    symmetry: clamp(raw.symmetry ?? 0.5, 0, 1),
    materialBias: normalizeMaterial(raw.materialBias ?? raw.material_bias ?? 'unknown'),
    colorTemperature: clamp(raw.colorTemperature ?? raw.color_temperature ?? 0.5, 0, 1),
    luminanceRange: clamp(raw.luminanceRange ?? raw.luminance_range ?? 0.5, 0, 1),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeMaterial(material: string): StyleSignals['materialBias'] {
  const valid = ['paper', 'metal', 'glass', 'organic', 'digital', 'unknown'];
  const lower = material.toLowerCase();
  return valid.includes(lower) ? lower as StyleSignals['materialBias'] : 'unknown';
}

/**
 * Fallback signal extraction using basic JavaScript image analysis
 * Used when Python CV is not available
 */
export async function extractStyleSignalsFallback(imageBase64: string): Promise<SignalExtractionResult> {
  const startTime = Date.now();
  
  const signals: StyleSignals = {
    contrast: 0.5,
    edgeSharpness: 0.5,
    geometricBias: 0.5,
    visualDensity: 0.5,
    symmetry: 0.5,
    materialBias: 'unknown',
    colorTemperature: 0.5,
    luminanceRange: 0.5,
  };
  
  return {
    success: true,
    signals,
    processingTimeMs: Date.now() - startTime,
  };
}
