import { ImageAnnotatorClient } from "@google-cloud/vision";

interface VisionColor {
  red: number;
  green: number;
  blue: number;
  score: number;
  pixelFraction: number;
}

interface VisionLabel {
  description: string;
  score: number;
}

interface VisionObject {
  name: string;
  score: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface VisionText {
  text: string;
  locale?: string;
}

export interface VisionAnalysisResult {
  labels: VisionLabel[];
  dominantColors: VisionColor[];
  objects: VisionObject[];
  text: VisionText[];
  safeSearch?: {
    adult: string;
    violence: string;
    racy: string;
  };
  webEntities?: Array<{ description: string; score: number }>;
  error?: string;
}

class GoogleCloudVisionService {
  private client: ImageAnnotatorClient | null = null;
  private initialized: boolean = false;
  private initError: string | null = null;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initError) return false;

    try {
      const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS;
      
      if (!credentialsJson) {
        this.initError = "GOOGLE_CLOUD_CREDENTIALS secret not configured";
        console.warn("[Vision Service]", this.initError);
        return false;
      }

      const credentials = JSON.parse(credentialsJson);
      
      this.client = new ImageAnnotatorClient({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
        projectId: credentials.project_id,
      });

      this.initialized = true;
      console.log("[Vision Service] Google Cloud Vision initialized successfully");
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to initialize Vision service";
      this.initError = message;
      console.error("[Vision Service] Initialization error:", this.initError);
      return false;
    }
  }

  async analyzeImage(imageSource: string | Buffer): Promise<VisionAnalysisResult> {
    const result: VisionAnalysisResult = {
      labels: [],
      dominantColors: [],
      objects: [],
      text: [],
    };

    if (!await this.initialize()) {
      return { ...result, error: this.initError || "Vision service not available" };
    }

    try {
      let imageContent: { content?: string; source?: { imageUri: string } };
      
      if (typeof imageSource === "string") {
        if (imageSource.startsWith("http://") || imageSource.startsWith("https://") || imageSource.startsWith("gs://")) {
          imageContent = { source: { imageUri: imageSource } };
        } else {
          imageContent = { content: imageSource };
        }
      } else {
        imageContent = { content: imageSource.toString("base64") };
      }

      const [response] = await this.client!.annotateImage({
        image: imageContent,
        features: [
          { type: "LABEL_DETECTION", maxResults: 15 },
          { type: "IMAGE_PROPERTIES" },
          { type: "OBJECT_LOCALIZATION", maxResults: 10 },
          { type: "TEXT_DETECTION" },
          { type: "SAFE_SEARCH_DETECTION" },
          { type: "WEB_DETECTION" },
        ],
      });

      if (response.labelAnnotations) {
        result.labels = response.labelAnnotations.map((label: { description?: string | null; score?: number | null }) => ({
          description: label.description || "",
          score: label.score || 0,
        }));
      }

      if (response.imagePropertiesAnnotation?.dominantColors?.colors) {
        result.dominantColors = response.imagePropertiesAnnotation.dominantColors.colors
          .slice(0, 10)
          .map((color: { color?: { red?: number | null; green?: number | null; blue?: number | null } | null; score?: number | null; pixelFraction?: number | null }) => ({
            red: color.color?.red || 0,
            green: color.color?.green || 0,
            blue: color.color?.blue || 0,
            score: color.score || 0,
            pixelFraction: color.pixelFraction || 0,
          }));
      }

      if (response.localizedObjectAnnotations) {
        result.objects = response.localizedObjectAnnotations.map((obj: { name?: string | null; score?: number | null; boundingPoly?: { normalizedVertices?: Array<{ x?: number | null; y?: number | null }> | null } | null }) => {
          const vertices = obj.boundingPoly?.normalizedVertices || [];
          let boundingBox: VisionObject["boundingBox"];
          
          if (vertices.length >= 4) {
            const xValues = vertices.map((v: { x?: number | null }) => v.x || 0);
            const yValues = vertices.map((v: { y?: number | null }) => v.y || 0);
            const minX = Math.min(...xValues);
            const maxX = Math.max(...xValues);
            const minY = Math.min(...yValues);
            const maxY = Math.max(...yValues);
            boundingBox = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };
          }

          return {
            name: obj.name || "",
            score: obj.score || 0,
            boundingBox,
          };
        });
      }

      if (response.textAnnotations && response.textAnnotations.length > 0) {
        const fullText = response.textAnnotations[0];
        result.text = [{
          text: fullText.description || "",
          locale: fullText.locale || undefined,
        }];
      }

      if (response.safeSearchAnnotation) {
        result.safeSearch = {
          adult: String(response.safeSearchAnnotation.adult || "UNKNOWN"),
          violence: String(response.safeSearchAnnotation.violence || "UNKNOWN"),
          racy: String(response.safeSearchAnnotation.racy || "UNKNOWN"),
        };
      }

      if (response.webDetection?.webEntities) {
        result.webEntities = response.webDetection.webEntities
          .filter((e: { description?: string | null; score?: number | null }) => e.description && e.score)
          .slice(0, 10)
          .map((e: { description?: string | null; score?: number | null }) => ({
            description: e.description!,
            score: e.score!,
          }));
      }

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Vision analysis failed";
      console.error("[Vision Service] Analysis error:", error);
      return { ...result, error: message };
    }
  }

  async detectLabels(imageSource: string | Buffer): Promise<VisionLabel[]> {
    const result = await this.analyzeImage(imageSource);
    return result.labels;
  }

  async extractColors(imageSource: string | Buffer): Promise<VisionColor[]> {
    const result = await this.analyzeImage(imageSource);
    return result.dominantColors;
  }

  async detectText(imageSource: string | Buffer): Promise<string> {
    const result = await this.analyzeImage(imageSource);
    return result.text[0]?.text || "";
  }

  isAvailable(): boolean {
    return this.initialized || !!process.env.GOOGLE_CLOUD_CREDENTIALS;
  }

  getStatus(): { available: boolean; error?: string } {
    return {
      available: this.initialized,
      error: this.initError || undefined,
    };
  }
}

export const visionService = new GoogleCloudVisionService();
