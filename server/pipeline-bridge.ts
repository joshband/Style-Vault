import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { logger } from "./logger";

export interface PipelineJobResult {
  success: boolean;
  jobId: string;
  styleId: string;
  status: "processing" | "completed" | "failed" | "queued";
  data?: Record<string, any>;
  error?: string;
}

export interface PipelineConfig {
  serverUrl?: string;
  timeout?: number;
}

const DEFAULT_CONFIG: Required<PipelineConfig> = {
  serverUrl: "http://127.0.0.1:8765",
  timeout: 30000,
};

export class PipelineBridge extends EventEmitter {
  private config: Required<PipelineConfig>;
  private serverProcess: ChildProcess | null = null;
  private serverReady: boolean = false;
  private useHttpServer: boolean = false;

  constructor(config: PipelineConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async startServer(): Promise<boolean> {
    if (this.serverProcess) {
      return true;
    }

    return new Promise((resolve) => {
      this.serverProcess = spawn("python3", ["-m", "pipeline.server", "8765"], {
        cwd: globalThis.process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let started = false;

      this.serverProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        logger.info(output.trim(), { module: 'PipelineBridge', operation: 'server' });
        if (output.includes("Running on")) {
          started = true;
          this.useHttpServer = true;
          resolve(true);
        }
      });

      this.serverProcess.stderr?.on("data", (data: Buffer) => {
        logger.error(data.toString().trim(), undefined, { module: 'PipelineBridge', operation: 'server' });
      });

      this.serverProcess.on("close", (code: number | null) => {
        logger.info(`Exited with code ${code}`, { module: 'PipelineBridge', operation: 'server' });
        this.serverProcess = null;
        this.useHttpServer = false;
        if (!started) {
          resolve(false);
        }
      });

      setTimeout(() => {
        if (!started) {
          logger.warn("Failed to start within timeout, using fallback", { module: 'PipelineBridge', operation: 'server' });
          resolve(false);
        }
      }, 5000);
    });
  }

  stopServer(): void {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
      this.useHttpServer = false;
    }
  }

  private async httpRequest<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, any>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.config.serverUrl}${path}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async validateTokens(tokens: Record<string, any>): Promise<{
    valid: boolean;
    errors: Array<{ path: string; message: string }>;
    warnings: Array<{ path: string; message: string }>;
    tokenCount: number;
  }> {
    return this.httpRequest("/validate", "POST", { tokens });
  }

  async assembleCanonicalArtifact(
    tokens: Record<string, any>,
    components: Array<Record<string, any>> = [],
    styleSemantics: Record<string, any> = {},
    styleId?: string
  ): Promise<PipelineJobResult> {
    const result = await this.httpRequest<{
      success: boolean;
      styleId: string;
      artifact: Record<string, any>;
    }>("/assemble", "POST", {
      tokens,
      components,
      styleSemantics,
      styleId,
    });

    return {
      success: result.success,
      jobId: "",
      styleId: result.styleId,
      status: "completed",
      data: result.artifact,
    };
  }

  async ingestImage(
    imageBase64: string,
    styleId?: string
  ): Promise<PipelineJobResult> {
    const result = await this.httpRequest<{
      success: boolean;
      jobId: string;
      styleId: string;
      status: string;
    }>("/ingest", "POST", {
      imageBase64,
      styleId,
    });

    return {
      success: result.success,
      jobId: result.jobId,
      styleId: result.styleId,
      status: result.status as any,
    };
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    result?: Record<string, any>;
    error?: string;
  }> {
    return this.httpRequest(`/job/${jobId}`);
  }

  async searchStyles(
    query: string,
    limit: number = 10
  ): Promise<Array<{ styleId: string; score: number; explanation: string }>> {
    const result = await this.httpRequest<{
      results: Array<{ styleId: string; score: number; explanation: string }>;
    }>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return result.results;
  }

  async checkHealth(): Promise<{
    healthy: boolean;
    pythonVersion: string;
    pipelineVersion: string;
  }> {
    try {
      const health = await this.httpRequest<{
        healthy: boolean;
        version: string;
      }>("/health");

      return {
        healthy: health.healthy,
        pythonVersion: "3.11",
        pipelineVersion: health.version,
      };
    } catch (error) {
      return await this.checkHealthFallback();
    }
  }

  private async checkHealthFallback(): Promise<{
    healthy: boolean;
    pythonVersion: string;
    pipelineVersion: string;
  }> {
    return new Promise((resolve) => {
      const script = `
import sys
import json
sys.path.insert(0, './pipeline')

try:
    from normalize.dtcg_validator import validate_dtcg_tokens
    from api.job_queue import InMemoryJobQueue
    print(json.dumps({
        "healthy": True,
        "pythonVersion": sys.version.split()[0],
        "pipelineVersion": "1.0.0"
    }))
except Exception as e:
    print(json.dumps({
        "healthy": False,
        "pythonVersion": sys.version.split()[0],
        "pipelineVersion": "unknown",
        "error": str(e)
    }))
`;

      const proc = spawn("python3", ["-c", script], {
        cwd: globalThis.process.cwd(),
      });

      let stdout = "";
      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill();
        resolve({
          healthy: false,
          pythonVersion: "unknown",
          pipelineVersion: "unknown",
        });
      }, 5000);

      proc.on("close", (code: number | null) => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch {
          resolve({
            healthy: code === 0,
            pythonVersion: "unknown",
            pipelineVersion: "unknown",
          });
        }
      });
    });
  }

  getActiveJobCount(): number {
    return 0;
  }

  async detectComponents(
    imageBase64: string,
    options: {
      maxSize?: number;
      minArea?: number;
      enableClassification?: boolean;
    } = {}
  ): Promise<{
    candidates: Array<{
      id: string;
      bbox: [number, number, number, number];
      shape: Record<string, number>;
      visual: Record<string, any>;
      label: string;
      confidence: number;
    }>;
    count: number;
    timings: Record<string, number>;
  }> {
    if (!this.useHttpServer) {
      return this.detectComponentsFallback(imageBase64, options);
    }

    return this.httpRequest("/api/pipeline/components", "POST", {
      base64: imageBase64,
      max_size: options.maxSize ?? 1024,
      min_area: options.minArea ?? 400,
      enable_classification: options.enableClassification ?? true,
    });
  }

  private async detectComponentsFallback(
    imageBase64: string,
    options: Record<string, any>
  ): Promise<any> {
    return {
      candidates: [],
      count: 0,
      timings: { total_ms: 0 },
      fallback: true,
      message: "Pipeline server not available",
    };
  }

  async extractMaterialSignature(
    imageBase64: string,
    components: Array<{ id: string; bbox: number[] }> = []
  ): Promise<{
    material_signals: { global: Record<string, number>; perComponent: Record<string, any> };
    texture_signals: { global: Record<string, any>; perComponent: Record<string, any> };
    recipe_match: {
      global: {
        recipe_id: string;
        label: string;
        confidence: number;
        description: string;
        layer_topology: string[];
        material_tokens: Record<string, any>;
        texture_tokens: Record<string, any>;
        opacity_tokens: Record<string, any>;
        interaction_hypotheses: Array<{ input: string; target: string; curve: string }>;
      };
      perComponent: Record<string, any>;
    };
    tokens: Record<string, any>;
    interaction_bindings: Array<{ input: string; target: string; curve: string }>;
    layer_topology: string[];
    timings: Record<string, number>;
  }> {
    if (!this.useHttpServer) {
      return this.extractMaterialSignatureFallback(imageBase64);
    }

    return this.httpRequest("/api/pipeline/material-signature", "POST", {
      base64: imageBase64,
      components,
    });
  }

  private async extractMaterialSignatureFallback(imageBase64: string): Promise<any> {
    return {
      material_signals: {
        global: {
          translucency_score: 0.3,
          specular_density: 0.4,
          emission_score: 0.2,
          depth_shadow_complexity: 0.3,
        },
        perComponent: {},
      },
      texture_signals: {
        global: {
          texture_grain: 0.25,
          microcontrast: 0.3,
          anisotropy: 0.15,
          noise_type_hint: "none",
        },
        perComponent: {},
      },
      recipe_match: {
        global: {
          recipe_id: "matte_plastic",
          label: "Matte Plastic",
          confidence: 0.5,
          description: "Default fallback material",
          layer_topology: ["shadow_soft", "plastic_body", "diffuse_highlight"],
          material_tokens: {},
          texture_tokens: {},
          opacity_tokens: {},
          interaction_hypotheses: [],
        },
        perComponent: {},
      },
      tokens: {},
      interaction_bindings: [],
      layer_topology: [],
      timings: { total_ms: 0 },
      fallback: true,
    };
  }

  async enrichStyle(
    imageBase64: string,
    styleId?: string
  ): Promise<{
    components: { candidates: Array<any>; count: number };
    material_signature: {
      signals: { global: Record<string, number>; perComponent: Record<string, any> };
      texture: { global: Record<string, any>; perComponent: Record<string, any> };
      recipe: { id: string; label: string; confidence: number; description: string };
      layer_topology: string[];
      interaction_bindings: Array<any>;
    };
    enriched_tokens: Record<string, any>;
    lineage: {
      style_id: string | null;
      pipeline_version: string;
      stages: string[];
      timings: Record<string, number>;
      timestamp: string;
    };
  }> {
    if (!this.useHttpServer) {
      return this.enrichStyleFallback(styleId);
    }

    return this.httpRequest("/api/pipeline/enrich-style", "POST", {
      base64: imageBase64,
      style_id: styleId,
    });
  }

  private async enrichStyleFallback(styleId?: string): Promise<any> {
    return {
      components: { candidates: [], count: 0 },
      material_signature: {
        signals: { global: {}, perComponent: {} },
        texture: { global: {}, perComponent: {} },
        recipe: {
          id: "unknown",
          label: "Unknown",
          confidence: 0,
          description: "Pipeline unavailable",
        },
        layer_topology: [],
        interaction_bindings: [],
      },
      enriched_tokens: {},
      lineage: {
        style_id: styleId || null,
        pipeline_version: "fallback",
        stages: [],
        timings: {},
        timestamp: new Date().toISOString(),
      },
      fallback: true,
    };
  }

  async listRecipes(): Promise<{
    recipes: Array<{ id: string; label: string; description: string }>;
    count: number;
  }> {
    if (!this.useHttpServer) {
      return {
        recipes: [
          { id: "glassmorphic_emissive", label: "Glassmorphic (Emissive)", description: "Frosted glass with internal glow" },
          { id: "anodized_metal_brushed", label: "Anodized Metal (Brushed)", description: "Brushed aluminum or titanium" },
          { id: "soft_plastic_led_diffuse", label: "Soft Plastic (LED Diffuse)", description: "Soft-touch plastic with LED glow" },
          { id: "matte_plastic", label: "Matte Plastic", description: "Standard matte plastic surface" },
          { id: "neon_emissive", label: "Neon Emissive", description: "Bright neon-like glow" },
        ],
        count: 5,
      };
    }

    return this.httpRequest("/api/pipeline/recipes");
  }

  async getRecipe(recipeId: string): Promise<Record<string, any> | null> {
    if (!this.useHttpServer) {
      return null;
    }

    try {
      return await this.httpRequest(`/api/pipeline/recipes/${recipeId}`);
    } catch {
      return null;
    }
  }

  isServerAvailable(): boolean {
    return this.useHttpServer;
  }
}

export const pipelineBridge = new PipelineBridge();
