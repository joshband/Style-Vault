import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Palette, Eye, Sparkles, Code, Download, Share2, 
  ImageIcon, Layers, Zap, Database, Lock, Globe,
  FileText, Cpu, Camera, Search, Wand2, ArrowLeft
} from "lucide-react";
import { useLocation } from "wouter";

const featureSections = [
  {
    title: "Style Intelligence Engine",
    icon: Eye,
    description: "AI-powered visual analysis and style extraction",
    features: [
      {
        name: "Google Cloud Vision Integration",
        description: "Label detection, object localization, dominant color extraction, OCR text detection, safe search, and web entity recognition using Google's production-grade Vision API.",
        badge: "NEW"
      },
      {
        name: "CV-Based Token Extraction",
        description: "Deterministic, explainable token extraction using OpenCV and NumPy. Extracts colors (OKLCH), spacing, border radius, grid patterns, elevation, and stroke width with full algorithm walkthrough.",
        badge: "ADVANCED"
      },
      {
        name: "Typography Recommendation Engine",
        description: "Python CV for style signal extraction combined with TypeScript intent mapping. Recommends fonts from a curated 30-font Google Fonts catalog based on contrast, edge sharpness, geometric bias, and material hints.",
        badge: null
      },
      {
        name: "Metadata Enrichment",
        description: "AI-powered enrichment with objective and subjective 'Visual DNA' descriptors including mood, era, texture, lighting, cultural resonance, and psychological effects.",
        badge: null
      }
    ]
  },
  {
    title: "Design Token System",
    icon: Palette,
    description: "W3C DTCG 2025.10 compliant token architecture",
    features: [
      {
        name: "W3C DTCG Standard",
        description: "Hierarchical JSON tokens with $type, $value, and $description following the latest W3C Design Token Community Group specification.",
        badge: "STANDARD"
      },
      {
        name: "Python Validation Pipeline",
        description: "DTCG validator with alias resolution (up to 10 levels), color/dimension/shadow format validation, and comprehensive schema validation.",
        badge: null
      },
      {
        name: "Lineage Tracking",
        description: "Full provenance tracking with stage execution records, model versions, and intermediate artifacts for complete audit trails.",
        badge: null
      },
      {
        name: "Canonical Assembly",
        description: "Assembles validated data into canonical style artifacts with validation flags and comprehensive summaries.",
        badge: null
      }
    ]
  },
  {
    title: "Multi-Format Export",
    icon: Download,
    description: "18 export formats for any platform or tool",
    features: [
      {
        name: "Code Formats",
        description: "W3C DTCG JSON, CSS Variables, SCSS Variables, React/TypeScript, Tailwind Config, Next.js Theme",
        badge: "6 FORMATS"
      },
      {
        name: "Mobile Formats",
        description: "Flutter/Dart, React Native, Swift/iOS (SwiftUI + UIKit), Android XML (colors.xml/dimens.xml)",
        badge: "4 FORMATS"
      },
      {
        name: "Design Tools",
        description: "Figma Variables JSON, Adobe ASE Swatches (binary), Sketch Palette",
        badge: "3 FORMATS"
      },
      {
        name: "Frameworks & Game/Audio",
        description: "Material UI theme, Web Components, Unity C# ScriptableObject, JUCE C++ header, Unreal Engine DataAsset",
        badge: "5 FORMATS"
      }
    ]
  },
  {
    title: "AI Image Generation",
    icon: Wand2,
    description: "Token-weighted prompt generation for consistent style application",
    features: [
      {
        name: "Google Gemini Integration",
        description: "Image analysis and generation using gemini-2.5-flash, gemini-2.5-pro, and gemini-2.5-flash-image models via Replit AI Integrations.",
        badge: "AI"
      },
      {
        name: "Prodia Fast Generation",
        description: "Sub-second (~500ms) image generation using Flux Fast Schnell model for rapid iteration and real-time previews.",
        badge: "FAST"
      },
      {
        name: "Canonical Preview System",
        description: "Standardized preview images (portrait, landscape, still life) for cross-style comparison with consistent lighting and composition.",
        badge: null
      },
      {
        name: "Prompt Scaffolding",
        description: "Structured prompt templates derived from tokens with design tokens as primary visual directives and semantic context as secondary guidance.",
        badge: null
      }
    ]
  },
  {
    title: "Community Gallery",
    icon: Share2,
    description: "Discover, share, and collaborate on styles",
    features: [
      {
        name: "Style Explorer",
        description: "Browse and compare saved styles with advanced filtering by mood, era, medium, texture, and more.",
        badge: null
      },
      {
        name: "Bookmarking & Ratings",
        description: "Save favorite styles and provide 1-5 star ratings with reviews for community curation.",
        badge: null
      },
      {
        name: "Creator Profiles",
        description: "Styles linked to creators with dedicated galleries and public/private visibility controls.",
        badge: null
      },
      {
        name: "Share Codes",
        description: "6-character alphanumeric codes for easy style sharing and public access.",
        badge: null
      }
    ]
  },
  {
    title: "Backend Infrastructure",
    icon: Database,
    description: "Production-grade pipeline architecture",
    features: [
      {
        name: "Python Pipeline Server",
        description: "Modular HTTP API with job queue, async execution, priority ordering, retry logic, and configurable timeouts.",
        badge: "SCALABLE"
      },
      {
        name: "Semantic Search",
        description: "Style indexing by tags, components, and materials with explainable search results and similar style retrieval.",
        badge: null
      },
      {
        name: "Pluggable Storage",
        description: "In-memory implementations for development with production-ready interfaces for GCP Cloud Storage, PostgreSQL, and vector databases.",
        badge: null
      },
      {
        name: "Safety Hardening",
        description: "File validation (magic bytes, size limits), rate limiting, determinism checking, and schema versioning with migrations.",
        badge: "SECURE"
      }
    ]
  },
  {
    title: "Developer Experience",
    icon: Code,
    description: "Modern tooling and API design",
    features: [
      {
        name: "One-Click Deploy",
        description: "Vercel and Netlify deployment bundles with tokens.css, tokens.json, theme.ts, platform configs, and quick start instructions.",
        badge: null
      },
      {
        name: "Style Versioning",
        description: "Snapshots of style states with change tracking, manual version creation, and owner-only reversion.",
        badge: null
      },
      {
        name: "Background Workers",
        description: "Autonomous asset generation, style name repair, mood board creation, task deduplication, and cache invalidation.",
        badge: null
      },
      {
        name: "Comprehensive API",
        description: "RESTful JSON endpoints with Zod validation, proper error handling, and health/readiness probes for cloud deployment.",
        badge: null
      }
    ]
  }
];

const techStack = [
  { category: "Frontend", items: ["React 18", "TypeScript", "Tailwind CSS v4", "shadcn/ui", "Framer Motion", "TanStack Query", "Wouter", "Vite"] },
  { category: "Backend", items: ["Node.js", "Express", "TypeScript (ESM)", "Drizzle ORM", "PostgreSQL", "esbuild"] },
  { category: "Python", items: ["OpenCV", "NumPy", "SciPy", "ColorAide", "pytest"] },
  { category: "AI Services", items: ["Google Gemini", "Google Cloud Vision", "Prodia AI"] },
  { category: "Auth & Storage", items: ["Replit Auth (OIDC)", "Object Storage", "Session Management"] }
];

export default function FeaturesPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-12 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight" data-testid="text-page-title">Visual DNA Studio</h1>
            <p className="text-lg text-muted-foreground mt-2">
              W3C DTCG-Compliant Design Token & Style Intelligence Platform
            </p>
          </div>
        </div>

        <Card className="mb-12 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <Camera className="h-3 w-3 mr-1" />
                Vision API Ready
              </Badge>
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <Layers className="h-3 w-3 mr-1" />
                18 Export Formats
              </Badge>
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <Zap className="h-3 w-3 mr-1" />
                Sub-Second Generation
              </Badge>
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <Lock className="h-3 w-3 mr-1" />
                W3C DTCG 2025.10
              </Badge>
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <Cpu className="h-3 w-3 mr-1" />
                Python CV Pipeline
              </Badge>
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <Search className="h-3 w-3 mr-1" />
                Semantic Search
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 print:gap-4">
          {featureSections.map((section, idx) => (
            <Card key={idx} className="print:break-inside-avoid">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {section.features.map((feature, fIdx) => (
                    <div key={fIdx} className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-sm">{feature.name}</h4>
                        {feature.badge && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {feature.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-12" />

        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Technology Stack
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
              {techStack.map((stack, idx) => (
                <div key={idx}>
                  <h4 className="font-semibold text-sm mb-3">{stack.category}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {stack.items.map((item, iIdx) => (
                      <Badge key={iIdx} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-8 print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              API Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm font-mono">
              <div className="space-y-2">
                <h4 className="font-semibold text-base font-sans mb-3">Vision API</h4>
                <div className="p-2 bg-muted rounded">GET /api/vision/status</div>
                <div className="p-2 bg-muted rounded">POST /api/vision/analyze</div>
                <div className="p-2 bg-muted rounded">POST /api/vision/labels</div>
                <div className="p-2 bg-muted rounded">POST /api/vision/colors</div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-base font-sans mb-3">Pipeline API</h4>
                <div className="p-2 bg-muted rounded">GET /api/pipeline/health</div>
                <div className="p-2 bg-muted rounded">POST /api/pipeline/validate-tokens</div>
                <div className="p-2 bg-muted rounded">POST /api/pipeline/assemble</div>
                <div className="p-2 bg-muted rounded">GET /api/pipeline/search</div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-base font-sans mb-3">Style API</h4>
                <div className="p-2 bg-muted rounded">GET /api/styles</div>
                <div className="p-2 bg-muted rounded">POST /api/styles</div>
                <div className="p-2 bg-muted rounded">GET /api/styles/:id</div>
                <div className="p-2 bg-muted rounded">POST /api/style/typography</div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-base font-sans mb-3">Generation API</h4>
                <div className="p-2 bg-muted rounded">POST /api/generate/image</div>
                <div className="p-2 bg-muted rounded">POST /api/generate/prodia</div>
                <div className="p-2 bg-muted rounded">GET /api/prodia-status</div>
                <div className="p-2 bg-muted rounded">POST /api/generate/preview</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center text-sm text-muted-foreground print:hidden">
          <p>Visual DNA Studio v1.0 • Built with React, TypeScript & Python</p>
          <p className="mt-1">Use your browser's print function (Cmd/Ctrl+P) to save as PDF</p>
        </div>
      </div>
    </div>
  );
}
