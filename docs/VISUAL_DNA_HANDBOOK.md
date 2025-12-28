# Visual DNA Studio - Technical Handbook

**Version:** 1.0.0  
**Last Updated:** December 28, 2025  
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Feature Matrix](#feature-matrix)
4. [Release Notes & Changelog](#release-notes--changelog)
5. [Architecture](#architecture)
6. [Technical Specifications](#technical-specifications)
7. [Data Models](#data-models)
8. [Integration Guide](#integration-guide)
9. [API Reference](#api-reference)
10. [Operational Runbook](#operational-runbook)
11. [Testing & Quality Assurance](#testing--quality-assurance)
12. [Appendices](#appendices)
13. [Image Generation Strategy](#image-generation-strategy)

---

## Executive Summary

Visual DNA Studio is a W3C DTCG 2025.10-compliant design token and style intelligence platform that transforms visual assets into structured, reusable design systems. The platform combines computer vision, AI-powered analysis, and comprehensive export capabilities to create a complete style management solution.

### Key Value Propositions

- **Standards-Based**: Full W3C Design Token Community Group (DTCG) 2025.10 compliance
- **AI-Powered**: Gemini and Cloud Vision API integration for intelligent style analysis
- **Universal Export**: 18 export formats covering web, mobile, design tools, and game engines
- **Production-Ready**: Comprehensive backend with job orchestration, caching, and health monitoring

### Target Users

- UI/UX Designers seeking consistent design token workflows
- Frontend Developers needing platform-agnostic style exports
- Design System Teams building scalable component libraries
- Creative Directors maintaining brand consistency across projects

---

## Product Overview

### What is Visual DNA?

Visual DNA treats visual styles as first-class, standards-based artifacts. Each style comprises:

1. **Reference Image**: The source visual that defines the aesthetic
2. **Design Tokens**: W3C DTCG-compliant hierarchical token structure
3. **Canonical Previews**: Standardized preview images (portrait, landscape, still life)
4. **UI Concepts**: Generated software interface mockups applying the style
5. **Prompt Scaffolding**: Structured AI prompts for consistent generation
6. **Metadata Tags**: Rich semantic descriptors for search and classification

### Core Workflow

```
Reference Image → Token Extraction → AI Enrichment → Preview Generation → Export
```

1. **Upload**: User provides a reference image
2. **Extract**: CV pipeline extracts colors, spacing, typography signals
3. **Enrich**: AI adds mood, era, texture, cultural context
4. **Generate**: Canonical previews and UI concepts are created
5. **Export**: Tokens exported to any of 18 supported formats

---

## Feature Matrix

### Style Intelligence Engine

| Feature | Description | Status |
|---------|-------------|--------|
| Google Cloud Vision Integration | Label detection, object localization, dominant colors, OCR, safe search | Production |
| CV-Based Token Extraction | OpenCV/NumPy pipeline for deterministic token extraction | Production |
| Typography Recommendation | Font matching from 30-font Google Fonts catalog | Production |
| Metadata Enrichment | AI-generated mood, era, texture, cultural descriptors | Production |
| Component Detection | UI element detection (buttons, sliders, knobs, cards) | Production |
| Material Intelligence | Texture/material signals (translucency, specular, grain) | Production |

### Design Token System

| Feature | Description | Status |
|---------|-------------|--------|
| W3C DTCG Standard | Hierarchical JSON tokens with $type, $value, $description | Production |
| Python Validation | Alias resolution, color/dimension validation, schema checking | Production |
| Lineage Tracking | Full provenance with stage records and model versions | Production |
| Canonical Assembly | Validated artifact assembly with summary generation | Production |

### Multi-Format Export (18 Formats)

| Category | Formats | Count |
|----------|---------|-------|
| Code | W3C DTCG JSON, CSS Variables, SCSS, React/TS, Tailwind, Next.js | 6 |
| Mobile | Flutter/Dart, React Native, Swift/iOS, Android XML | 4 |
| Design Tools | Figma Variables, Adobe ASE, Sketch Palette | 3 |
| Frameworks/Games | Material UI, Web Components, Unity C#, JUCE C++, Unreal | 5 |

### AI Image Generation

| Feature | Description | Status |
|---------|-------------|--------|
| Gemini Integration | Image analysis and generation via Replit AI Integrations | Production |
| Prodia Fast Generation | ~500ms image generation with Flux Fast Schnell | Production |
| Canonical Previews | Portrait, landscape, still life with consistent composition | Production |
| UI Concept Generation | Software app, audio plugin, dashboard mockups | Production |
| Style Transfer | Reference image passed to AI for artistic style matching | Production |

### Community & Collaboration

| Feature | Description | Status |
|---------|-------------|--------|
| Style Explorer | Browse/filter styles by mood, era, medium, texture | Production |
| Bookmarking | Save favorite styles for quick access | Production |
| Ratings & Reviews | 1-5 star ratings with text reviews | Production |
| Creator Profiles | Styles linked to creators with galleries | Production |
| Share Codes | 6-character codes for easy sharing | Production |
| Public/Private Visibility | Control style visibility | Production |

### Backend Infrastructure

| Feature | Description | Status |
|---------|-------------|--------|
| Job Orchestration | Async jobs with retry logic and backoff | Production |
| Python Pipeline | Modular HTTP API with job queue | Production |
| Semantic Search | Tag/component/material-based style search | Production |
| Object Storage | GCP Cloud Storage with compression variants | Production |
| Session Management | PostgreSQL-backed session handling | Production |

---

## Release Notes & Changelog

### Version 1.0.0 (December 2025)

#### UI Concept Style Transfer
- **Fixed**: UI concept generation now passes reference image to Gemini for proper style transfer
- **Impact**: Software app, audio plugin, and dashboard mockups now match source artistic styles
- **Files**: `server/mood-board-generation.ts`

#### Thumbnail Priority System
- **Changed**: StyleCard now prioritizes `ui_software_app` as primary thumbnail
- **Rationale**: Core purpose is UI style analysis; UI preview should be primary visual
- **Files**: `client/src/components/style-card.tsx`

#### Comprehensive Testing Infrastructure
- **Added**: 24-test automated test suite covering APIs, pages, and data integrity
- **Added**: Code analysis with 82/100 quality score reporting
- **Added**: Markdown report generation with metrics and recommendations
- **Files**: `tests/run-comprehensive-tests.ts`, `tests/run-code-analysis.ts`

#### Image Service Improvements
- **Fixed**: Non-paginated `/api/styles` endpoint now includes `imageIds`
- **Added**: Compression variants (thumb, medium, original) for all images
- **Files**: `server/routes.ts`, `server/image-service.ts`

### Version 0.9.0 (December 2025)

#### Material Intelligence Pipeline
- **Added**: CV-based component detection for UI elements
- **Added**: 12 material recipes (glassmorphic, anodized metal, soft plastic, neon, etc.)
- **Added**: Confidence-scored material matching
- **Added**: Material Intelligence Panel in Style Inspector

#### Style Regeneration System
- **Added**: Complete style regeneration with before/after tracking
- **Added**: Async job orchestration for long-running operations
- **Added**: Background worker system for autonomous asset generation

#### One-Click Deployment
- **Added**: Vercel and Netlify deployment bundles
- **Added**: Platform-specific configurations and asset bundling
- **Added**: 8 hosting platform support

### Version 0.8.0 (December 2025)

#### W3C DTCG Compliance
- **Added**: Full W3C DTCG 2025.10 token structure support
- **Added**: 12 token categories (color, spacing, typography, etc.)
- **Added**: Python validation pipeline with alias resolution
- **Added**: 18-format export pipeline

#### Google Cloud Vision Integration
- **Added**: Production-grade Vision API for image analysis
- **Added**: Label detection, object localization, OCR
- **Added**: Dominant color extraction and safe search

---

## Architecture

### System Topology

```mermaid
graph TB
    subgraph Client["Frontend (React 18)"]
        UI[React Components]
        TQ[TanStack Query]
        Router[Wouter Router]
    end
    
    subgraph Server["Backend (Node.js/Express)"]
        API[REST API Routes]
        Auth[Replit Auth OIDC]
        Jobs[Job Runner]
        Cache[In-Memory Cache]
    end
    
    subgraph Storage["Data Layer"]
        PG[(PostgreSQL)]
        OBJ[(Object Storage)]
    end
    
    subgraph AI["AI Services"]
        Gemini[Google Gemini]
        Vision[Cloud Vision API]
        Prodia[Prodia AI]
    end
    
    subgraph Python["Python Pipeline"]
        CV[OpenCV Processor]
        DTCG[DTCG Validator]
        Typography[Typography Engine]
    end
    
    UI --> TQ --> API
    Router --> UI
    API --> Auth
    API --> Jobs
    API --> Cache
    Jobs --> PG
    Jobs --> OBJ
    Jobs --> Gemini
    Jobs --> Vision
    Jobs --> Prodia
    API --> Python
    Python --> CV
    Python --> DTCG
    Python --> Typography
```

### Style Regeneration Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Jobs
    participant CV as CV Pipeline
    participant AI as Gemini AI
    participant Storage
    
    User->>API: POST /api/styles/:id/regenerate
    API->>Jobs: Create regeneration job
    Jobs->>Storage: Get reference image
    
    par Token Extraction
        Jobs->>CV: Extract tokens (OpenCV)
        CV-->>Jobs: Color, spacing, typography signals
    and Vision Analysis
        Jobs->>AI: Analyze with Cloud Vision
        AI-->>Jobs: Labels, objects, safe search
    end
    
    Jobs->>AI: Enrich metadata (Gemini)
    AI-->>Jobs: Mood, era, texture tags
    
    par Preview Generation
        Jobs->>AI: Generate portrait
        Jobs->>AI: Generate landscape
        Jobs->>AI: Generate still life
    end
    
    par UI Concepts (with style transfer)
        Jobs->>AI: Generate software app + reference
        Jobs->>AI: Generate audio plugin + reference
        Jobs->>AI: Generate dashboard + reference
    end
    
    Jobs->>Storage: Store all images with compression
    Jobs->>Storage: Update style record
    Jobs-->>API: Job complete
    API-->>User: 200 OK with updated style
```

### Image Storage Architecture

```mermaid
graph LR
    subgraph Upload["Image Upload"]
        Raw[Raw Image Data]
    end
    
    subgraph Processing["Sharp Processing"]
        Original[Original JPEG 85%]
        Medium[Medium 800px]
        Thumb[Thumbnail 300px]
    end
    
    subgraph Storage["Object Storage"]
        Bucket[(Replit Bucket)]
    end
    
    subgraph Database["PostgreSQL"]
        Assets[image_assets table]
    end
    
    Raw --> Original
    Raw --> Medium
    Raw --> Thumb
    Original --> Bucket
    Medium --> Bucket
    Thumb --> Bucket
    Bucket --> Assets
```

---

## Technical Specifications

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui + Radix | Latest |
| Routing | Wouter | 3.x |
| State Management | TanStack Query | 5.x |
| Backend | Express | 4.x |
| Database | PostgreSQL | 15+ |
| ORM | Drizzle | Latest |
| Python | Python | 3.11 |
| CV Library | OpenCV | 4.x |
| Build Tool | Vite | 5.x |

### Database Schema Overview

```
styles
├── id (UUID)
├── name (VARCHAR)
├── description (TEXT)
├── tokens (JSONB) - W3C DTCG structure
├── promptScaffolding (JSONB)
├── metadataTags (JSONB)
├── keywords (TEXT[])
├── creatorId (UUID, nullable)
├── isPublic (BOOLEAN)
├── shareCode (VARCHAR 6)
├── createdAt (TIMESTAMP)
└── updatedAt (TIMESTAMP)

image_assets
├── id (UUID)
├── styleId (UUID, FK)
├── imageType (ENUM)
├── storagePath (VARCHAR)
├── compressionLevel (ENUM)
├── mimeType (VARCHAR)
├── sizeBytes (INTEGER)
└── createdAt (TIMESTAMP)

users
├── id (UUID)
├── replitId (VARCHAR)
├── displayName (VARCHAR)
├── profileImage (TEXT)
└── createdAt (TIMESTAMP)
```

### Image Types

| Type | Dimensions | Use Case |
|------|-----------|----------|
| `reference` | Original | Source style image |
| `preview_portrait` | 3:4 | Canonical portrait preview |
| `preview_landscape` | 16:9 | Canonical landscape preview |
| `preview_still_life` | 1:1 | Canonical still life preview |
| `ui_software_app` | 16:9 | Software UI mockup |
| `ui_audio_plugin` | 16:9 | Audio plugin mockup |
| `ui_dashboard` | 16:9 | Dashboard mockup |
| `mood_board` | 16:9 | Style mood board collage |

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PRODIA_TOKEN` | Prodia AI API key | Optional |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit bucket ID | Yes |
| `SESSION_SECRET` | Session encryption key | Auto-generated |

---

## Data Models

### Style Entity

The core entity representing a visual style with all its associated data.

```typescript
interface Style {
  id: string;                    // UUID primary key
  name: string;                  // Display name
  description: string | null;    // Style description
  tokens: Record<string, any>;   // W3C DTCG token structure
  promptScaffolding: {           // AI prompt templates
    base: string;
    modifiers: string[];
  };
  metadataTags: MetadataTags;    // Rich semantic descriptors
  keywords: string[];            // Searchable keywords
  previews: {                    // Legacy preview storage
    portrait?: string;
    landscape?: string;
    stillLife?: string;
  };
  moodBoardAssets: MoodBoardAssets;
  uiConceptAssets: UiConceptAssets;
  creatorId: string | null;      // Link to user
  creatorName: string | null;
  isPublic: boolean;             // Visibility control
  shareCode: string | null;      // 6-char share code
  createdAt: Date;
  updatedAt: Date;
}
```

### MetadataTags Structure

```typescript
interface MetadataTags {
  era: string[];                 // e.g., ["retro-futuristic", "1980s"]
  mood: string[];                // e.g., ["energetic", "playful"]
  medium: string[];              // e.g., ["digital-illustration"]
  texture: string[];             // e.g., ["smooth", "polished"]
  lighting: string[];            // e.g., ["soft-diffused", "dramatic"]
  subjects: string[];            // e.g., ["abstract-forms"]
  artPeriod: string[];           // e.g., ["digital-modernism"]
  colorFamily: string[];         // e.g., ["neon", "pastel"]
  narrativeTone: string[];       // e.g., ["nostalgic", "futuristic"]
  usageExamples: string[];       // e.g., ["album-covers", "ui-design"]
  keywords: string[];            // General keywords
  // ... additional fields
}
```

### Image Asset Entity

```typescript
interface ImageAsset {
  id: string;                    // UUID primary key
  styleId: string;               // Foreign key to style
  imageType: ImageType;          // Type of image
  storagePath: string;           // Object storage path
  compressionLevel: "original" | "medium" | "thumb";
  mimeType: string;              // e.g., "image/jpeg"
  sizeBytes: number;
  createdAt: Date;
}

type ImageType = 
  | "reference"
  | "preview_portrait"
  | "preview_landscape"
  | "preview_still_life"
  | "ui_software_app"
  | "ui_audio_plugin"
  | "ui_dashboard"
  | "mood_board";
```

### User Entity

```typescript
interface User {
  id: string;                    // UUID primary key
  replitId: string;              // Replit user ID
  displayName: string;           // Display name
  profileImage: string | null;   // Avatar URL
  createdAt: Date;
}
```

### Session Entity

```typescript
interface Session {
  sid: string;                   // Session ID (primary key)
  sess: object;                  // Session data (JSON)
  expire: Date;                  // Expiration timestamp
}
```

---

## Integration Guide

### Google Gemini (via Replit AI Integrations)

**Purpose**: Image analysis, generation, and metadata enrichment.

**Configuration**: Automatically configured via Replit AI Integrations.

**Usage**:
```typescript
import { ai } from "@replit/ai";

// Image generation
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  config: { responseModalities: ["image", "text"] },
});
```

**Models Used**:
- `gemini-2.5-flash-image`: Fast image generation
- `gemini-2.5-flash`: Text analysis and enrichment

### Google Cloud Vision API

**Purpose**: Production-grade image analysis.

**Features**:
- Label detection
- Object localization
- Dominant color extraction
- OCR text detection
- Safe search classification
- Web entity recognition

**Configuration**: Requires Vision API access via service account or API key.

### Prodia AI

**Purpose**: Fast (~500ms) image generation using Flux Fast Schnell model.

**Configuration**:
```
PRODIA_TOKEN=your_prodia_api_key
```

**Usage**:
```typescript
import { generateWithFluxSchnell } from "./prodia-generation";

const result = await generateWithFluxSchnell({
  prompt: "Your generation prompt",
});
```

### Replit Object Storage

**Purpose**: Persistent storage for generated images with compression variants.

**Configuration**:
```
DEFAULT_OBJECT_STORAGE_BUCKET_ID=bucket_id
PRIVATE_OBJECT_DIR=.private
PUBLIC_OBJECT_SEARCH_PATHS=public
```

**Usage**:
```typescript
import { storeImage, getImageData } from "./image-service";

// Store image with automatic compression variants
const imageId = await storeImage(base64Data, "preview_portrait", styleId);

// Retrieve image
const imageData = await getImageData(imageId, "medium");
```

### Replit Auth (OIDC)

**Purpose**: User authentication via Replit accounts.

**Flow**:
1. User clicks "Sign in with Replit"
2. Redirect to Replit OAuth
3. Callback with user claims
4. Session created in PostgreSQL

**Configuration**: Automatic via Replit integration.

**Protected Routes**:
```typescript
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}
```

### PostgreSQL Database

**Purpose**: Primary data storage for all entities.

**Configuration**:
```
DATABASE_URL=postgresql://user:pass@host:port/database
```

**ORM**: Drizzle ORM with full TypeScript type safety.

**Schema Management**:
```bash
# Push schema changes
npm run db:push

# Force push (for breaking changes)
npm run db:push --force
```

---

## API Reference

### Styles API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/styles` | GET | List all styles (paginated) |
| `/api/styles/:id` | GET | Get style details |
| `/api/styles` | POST | Create new style |
| `/api/styles/:id` | PATCH | Update style |
| `/api/styles/:id` | DELETE | Delete style |
| `/api/styles/:id/regenerate` | POST | Regenerate all assets |
| `/api/styles/:id/export/:format` | GET | Export tokens in format |

### Images API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/images/:id` | GET | Get image by ID |
| `/api/images/:id?size=thumb` | GET | Get thumbnail variant |
| `/api/images/:id?size=medium` | GET | Get medium variant |

### System API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/diagnostics` | GET | System diagnostics |
| `/api/jobs` | GET | List active jobs |

---

## Operational Runbook

### Starting the Application

```bash
npm run dev
```

### Running Tests

```bash
# Comprehensive test suite
npx tsx tests/run-comprehensive-tests.ts

# Code analysis
npx tsx tests/run-code-analysis.ts

# Playwright E2E tests
npx playwright test
```

### Database Management

```bash
# Push schema changes
npm run db:push

# Force push (destructive)
npm run db:push --force
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Images not loading | Check Object Storage configuration |
| Style regeneration stuck | Check job runner logs, restart workflow |
| Authentication failing | Verify Replit Auth configuration |
| Token export failing | Validate token structure in style |

---

## Testing & Quality Assurance

### Test Coverage Summary

| Category | Tests | Pass Rate |
|----------|-------|-----------|
| API Endpoints | 8 | 100% |
| Error Handling | 3 | 100% |
| Page Accessibility | 10 | 100% |
| Data Integrity | 3 | 100% |
| **Total** | **24** | **100%** |

### Code Quality Metrics

| Metric | Value |
|--------|-------|
| Total Files | 233 |
| Total Lines | 55,477 |
| TypeScript Coverage | 98% |
| Quality Score | 82/100 |

### Performance Benchmarks

| Metric | Value | Target |
|--------|-------|--------|
| API Response Time | 8ms | <500ms |
| Image Load Time | 7ms | <200ms |
| Initial Page Load | ~1-2s | <3s |

---

## Appendices

### Appendix A: W3C DTCG Token Structure

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "primary": {
      "$type": "color",
      "$value": "#4F46E5",
      "$description": "Primary brand color"
    }
  },
  "spacing": {
    "base": {
      "$type": "dimension",
      "$value": "16px",
      "$description": "Base spacing unit"
    }
  }
}
```

### Appendix B: Export Format Examples

**CSS Variables:**
```css
:root {
  --color-primary: #4F46E5;
  --spacing-base: 16px;
}
```

**Tailwind Config:**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5'
      },
      spacing: {
        base: '16px'
      }
    }
  }
}
```

### Appendix C: Material Recipes

| Recipe | Key Properties |
|--------|---------------|
| Glassmorphic | Translucency, blur, frosted glass effect |
| Anodized Metal | Subtle grain, matte finish, color shifts |
| Soft Plastic | Smooth, rounded edges, subtle specular |
| Neon | High emission, glow effects, vibrant saturation |
| Paper/Matte | No specular, subtle texture, flat lighting |
| Brushed Metal | Directional grain, reflective, industrial |

---

## Image Generation Strategy

### Current Architecture

The style regeneration pipeline currently processes images in stages:

1. **Token Extraction** (Sequential - required first)
   - CV-based token extraction must complete before image generation
   - Provides color palette and style signals for prompts

2. **Preview Generation** (Internal Parallel)
   - Portrait, landscape, and still life generated via Promise.all
   - Uses Gemini with reference image for style transfer

3. **Mood Board** (Sequential after previews)
   - Single collage image generation

4. **UI Concepts** (Can be parallelized)
   - Software app, audio plugin, dashboard mockups
   - Each uses reference image for style transfer

### Parallel Generation Opportunities

```mermaid
graph LR
    subgraph Sequential["Must Be Sequential"]
        A[Token Extraction] --> B[Style Signals Ready]
    end
    
    subgraph Parallel["Can Run in Parallel"]
        B --> C[Previews]
        B --> D[Mood Board]
        B --> E[UI Concepts]
    end
    
    subgraph Storage["Storage"]
        C --> F[Store Images]
        D --> F
        E --> F
    end
```

### Performance Considerations

| Stage | Current | Optimized | Savings |
|-------|---------|-----------|---------|
| Token Extraction | ~3-5s | ~3-5s | N/A (required first) |
| All Images (sequential) | ~30-45s | N/A | Baseline |
| All Images (parallel) | N/A | ~10-15s | ~60-70% |

### API Rate Limits

When parallelizing, consider:
- **Gemini**: Rate limits per minute/day
- **Prodia**: Concurrent request limits
- **Memory**: Multiple large base64 images in memory

### Recommended Strategy

1. **Keep token extraction sequential** - Required for all subsequent steps
2. **Parallelize image generation** - Run previews, mood board, and UI concepts concurrently
3. **Use Promise.allSettled** - Allow partial success if one generation fails
4. **Implement concurrency limits** - Prevent overwhelming API quotas

### Implementation Example

```typescript
// Parallel image generation after token extraction
const [previewResult, moodResult, uiResult] = await Promise.allSettled([
  generateCanonicalPreviewsWithGemini({ ... }),
  generateMoodBoardWithGemini({ ... }),
  generateUiConceptsWithGemini({ ... }),
]);

// Handle results independently
if (previewResult.status === 'fulfilled') {
  // Store previews
}
if (moodResult.status === 'fulfilled') {
  // Store mood board
}
if (uiResult.status === 'fulfilled') {
  // Store UI concepts
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-28 | System | Initial handbook creation |

---

*This document is automatically maintained and updated with each significant release.*
