import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

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
      this.serverProcess = spawn("python3", ["pipeline/server.py", "8765"], {
        cwd: globalThis.process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let started = false;

      this.serverProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.log(`[Pipeline Server] ${output.trim()}`);
        if (output.includes("Running on")) {
          started = true;
          this.useHttpServer = true;
          resolve(true);
        }
      });

      this.serverProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`[Pipeline Server Error] ${data.toString().trim()}`);
      });

      this.serverProcess.on("close", (code: number | null) => {
        console.log(`[Pipeline Server] Exited with code ${code}`);
        this.serverProcess = null;
        this.useHttpServer = false;
        if (!started) {
          resolve(false);
        }
      });

      setTimeout(() => {
        if (!started) {
          console.warn("[Pipeline Server] Failed to start within timeout, using fallback");
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
}

export const pipelineBridge = new PipelineBridge();
