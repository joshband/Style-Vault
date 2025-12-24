# Style Explorer

## Overview

Style Explorer is a style intelligence application for managing visual styles as first-class, standards-based artifacts. Unlike typical image generators, this application treats styles as reusable, inspectable, and comparable objects composed of reference images, canonical preview images, W3C DTCG design tokens, and AI prompt scaffolding derived from those tokens.

The core philosophy is that **tokens are the source of truth** - every style must have a comprehensive W3C DTCG 2025.10 design-token JSON, and image generation is merely a consumer of styles, not their definition.

The application operates in three modes:
1. **Style Explorer** - Browse, compare, and discover saved styles
2. **Style Authoring** - Create new styles from reference images or prompts
3. **Image Generation** - Apply saved styles to generate new images

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for UI transitions and gestures
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON endpoints under `/api/` prefix
- **Build Process**: esbuild for server bundling, Vite for client

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command
- **Key Tables**:
  - `users` - Basic user accounts
  - `styles` - Visual style definitions with tokens, previews, and metadata
  - `generatedImages` - Images generated using styles
  - `conversations`/`messages` - Chat history for AI interactions

### AI Integration
- **Provider**: Google Gemini via Replit AI Integrations
- **Models Used**:
  - `gemini-2.5-flash` - Fast text generation and image analysis
  - `gemini-2.5-pro` - Advanced reasoning tasks
  - `gemini-2.5-flash-image` - Image generation
- **Features**:
  - Image analysis for style extraction (`server/analysis.ts`)
  - Canonical preview generation (`server/preview-generation.ts`)
  - Styled image generation (`server/image-generation.ts`)
  - Metadata enrichment for searchable tags (`server/metadata-enrichment.ts`)

### CV-Based Token Extraction (Optional)
- **Location**: `server/cv/extract_tokens.py` - Python script
- **Bridge**: `server/cv-bridge.ts` - Node.js child_process interface
- **Toggle**: `CV_EXTRACTION_ENABLED` environment variable (set to "true" to enable)
- **Dependencies**: opencv-python-headless, numpy, scipy, coloraide
- **Features**:
  - CPU-only, near-realtime extraction (~100ms)
  - Deterministic and explainable (no deep learning)
  - Extracts: colors (OKLCH), spacing, border radius, grid, elevation, stroke width
  - Produces W3C DTCG 2025.10 compatible output
- **API Endpoints**:
  - `GET /api/cv-status` - Check if CV extraction is enabled
  - `POST /api/analyze-image-cv` - Extract tokens from image using CV (supports `includeWalkthrough: true` for debug visualizations)
- **Algorithm Walkthrough Feature**:
  - Opt-in educational mode showing intermediate CV processing steps
  - Generates debug visualizations: edge maps, color cluster mosaics, histograms, distance transforms, gradient maps
  - Plain-language step-by-step explanations for each token extraction algorithm
  - UI: Collapsible "Algorithm Walkthrough" panel with subsections per token type (color, spacing, border radius, grid, elevation, stroke width)
  - Uses `--with-visuals` flag internally; adds ~5-15 seconds to extraction time
  - Custom `NumpyEncoder` handles JSON serialization of numpy types

### Design Token System
- **Standard**: W3C DTCG (Design Token Community Group) 2025.10 format
- **Structure**: Hierarchical JSON with `$type`, `$value`, and `$description` properties
- **Usage**: Tokens define color palettes, typography, spacing, and visual characteristics that are applied consistently across generated images

### Async Job Orchestration
- **Location**: `server/job-runner.ts` - Core job execution engine
- **Database Table**: `jobs` - Tracks all async operations
- **Configuration**:
  - Timeout: 120 seconds per attempt
  - Max Retries: 3 attempts
  - Backoff: Exponential (2s × 2^attempt)
  - Polling: 1-2 second intervals
- **Job Types**: token_extraction, preview_generation, image_generation, mood_board, metadata_enrichment
- **Job States**: queued → running → succeeded/failed/canceled
- **API Endpoints**:
  - `GET /api/jobs/:id` - Get job status with progress
  - `GET /api/jobs?styleId=xxx` - Get jobs for a style
  - `POST /api/jobs/:id/cancel` - Cancel running job
  - `POST /api/jobs/:id/retry` - Retry failed job
- **Frontend Integration**:
  - `useJob` hook for status polling (`client/src/hooks/use-job.ts`)
  - `JobProgress` component for UI (`client/src/components/job-progress.tsx`)
  - `ErrorBoundary` for graceful error recovery (`client/src/components/error-boundary.tsx`)

### Key Design Decisions

**Tokens as Source of Truth**: The application enforces that no style can exist without a complete token definition. This ensures styles are portable, comparable, and can be applied consistently.

**Canonical Preview System**: Each style generates three standardized preview images (portrait, landscape, still-life) using fixed subjects. This enables meaningful cross-style comparison.

**Prompt Scaffolding**: Styles include structured prompt templates (base, modifiers, negative) derived from tokens, ensuring consistent application of style characteristics during image generation.

**Job-Based Async Operations**: All long-running operations use a persistent job system with automatic retry, exponential backoff, and progress tracking. This prevents stuck states and enables recovery from transient failures.

**Background Metadata Enrichment**: After style creation and mood board generation, an AI-powered background worker enriches styles with comprehensive metadata for discovery and classification. The system extracts both objective characteristics and subjective "Visual DNA" descriptors:

**Objective Characteristics:**
- **Visual Characteristics**: mood, color family, lighting, texture
- **Art Historical Context**: era, art period (movements like art-deco, impressionism), historical influences (design schools, cultural movements), similar artists
- **Technical Aspects**: medium, subjects
- **Application Guidance**: usage examples (practical applications like album-covers, web-design, brand-identity)

**Subjective Visual DNA:**
- **Emotional Resonance**: narrativeTone (storytelling voice), sensoryPalette (cross-sensory associations), movementRhythm (visual tempo/flow)
- **Design Voice**: stylisticPrinciples (core philosophy), signatureMotifs (recurring elements), contrastDynamics (tension/harmony)
- **Experiential Impact**: psychologicalEffect (viewer response), culturalResonance (cultural connections), audiencePerception (who responds)

- **Search**: general keywords

This enables sophisticated filtering and discovery across the style library via the `/api/tags` endpoint. Tags use lowercase, hyphenated format for consistency.

## External Dependencies

### AI Services
- **Replit AI Integrations**: Provides Gemini API access without requiring a separate API key
  - Environment variables: `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`

### Database
- **PostgreSQL**: Primary data store
  - Environment variable: `DATABASE_URL`
  - Connection: `pg` driver with Drizzle ORM

### UI Components
- **shadcn/ui**: Comprehensive component library built on Radix UI primitives
- **Radix UI**: Accessible, unstyled UI primitives
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build and dev server
- **Drizzle Kit**: Database schema management and migrations
- **esbuild**: Server bundling for production