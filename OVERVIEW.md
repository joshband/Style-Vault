# Style Explorer - Technical Overview

A design intelligence application for managing visual styles as immutable, standards-based artifacts. This document provides comprehensive technical context for LLM assistants.

## Core Philosophy

**Tokens are the source of truth** - Every style must have a comprehensive W3C DTCG 2025.10 design-token JSON. Image generation is merely a consumer of styles, not their definition.

## Application Modes

1. **Style Explorer** - Browse, compare, and discover saved styles with rich filtering
2. **Style Authoring** - Create new styles from reference images or prompts
3. **Image Generation** - Apply saved styles to generate new images

## Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Wouter, TanStack Query |
| Styling | Tailwind CSS v4, shadcn/ui (New York style), Framer Motion |
| Backend | Node.js, Express, TypeScript (ESM) |
| Database | PostgreSQL via Drizzle ORM |
| AI | Google Gemini via Replit AI Integrations |
| Build | Vite (client), esbuild (server) |

### Directory Structure

```
├── client/
│   └── src/
│       ├── components/     # React components
│       │   ├── ui/         # shadcn/ui components
│       │   ├── error-boundary.tsx
│       │   └── job-progress.tsx
│       ├── hooks/          # Custom hooks
│       │   └── use-job.ts  # Job status polling
│       ├── pages/          # Route components
│       └── lib/            # Utilities
├── server/
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database operations
│   ├── job-runner.ts       # Async job orchestration
│   ├── analysis.ts         # Image analysis
│   ├── preview-generation.ts
│   ├── image-generation.ts
│   ├── metadata-enrichment.ts
│   └── cv/                 # Computer vision module
│       └── extract_tokens.py
├── shared/
│   └── schema.ts           # Drizzle schema + types
└── replit.md               # Project documentation
```

## Database Schema

### Core Tables

**styles** - Visual style definitions
- `id` (varchar, UUID) - Primary key
- `name`, `description` - User-provided metadata
- `referenceImage` - Base64 encoded source image
- `designTokens` - W3C DTCG JSON structure
- `promptScaffolding` - Structured prompt templates
- `moodBoard`, `uiConcepts` - Generated visual assets
- `previews` - Canonical preview images
- `metadataTags` - Enriched searchable metadata
- `metadataEnrichmentStatus` - "pending" | "processing" | "complete" | "failed"
- `createdAt` - Timestamp

**jobs** - Async operation tracking
- `id` (varchar, UUID) - Primary key
- `type` - "token_extraction" | "preview_generation" | "image_generation" | "mood_board" | "metadata_enrichment"
- `status` - "queued" | "running" | "succeeded" | "failed" | "canceled"
- `progress` (0-100) - Current completion percentage
- `progressMessage` - Human-readable status
- `input`, `output` - JSON payloads
- `error` - Error message if failed
- `retryCount`, `maxRetries` - Retry tracking
- `styleId` - Optional foreign key to styles
- `createdAt`, `startedAt`, `completedAt` - Timestamps

**generatedImages** - Images created using styles
- `id`, `styleId`, `prompt`, `imageData`, `createdAt`

### Design Token Structure (W3C DTCG 2025.10)

```json
{
  "color": {
    "primary": { "$type": "color", "$value": "oklch(0.7 0.2 240)", "$description": "..." },
    "palette": { "01": {...}, "02": {...} }
  },
  "spacing": {
    "scale": { "$type": "dimension", "$value": "8px" }
  },
  "borderRadius": {...},
  "elevation": {...},
  "typography": {...}
}
```

## API Endpoints

### Styles
- `GET /api/styles` - List all style summaries (cached)
- `GET /api/styles/:id` - Get full style detail (cached)
- `POST /api/styles` - Create new style (triggers analysis)
- `DELETE /api/styles/:id` - Delete style and related images

### Analysis & Generation
- `POST /api/analyze-image` - AI-powered style extraction
- `POST /api/analyze-image-cv` - CV-based token extraction (if enabled)
- `GET /api/cv-status` - Check CV extraction availability
- `POST /api/generate-previews` - Generate canonical previews
- `POST /api/generate-mood-board/:id` - Generate mood board assets
- `POST /api/generate-image` - Generate styled image

### Jobs (Async Operations)
- `GET /api/jobs/:id` - Get job status with derived fields
- `GET /api/jobs?styleId=xxx` - Get jobs for a style
- `POST /api/jobs/:id/cancel` - Cancel running job
- `POST /api/jobs/:id/retry` - Retry failed job

### Metadata
- `GET /api/tags` - Get aggregated tag statistics
- `POST /api/enrich/:id` - Queue style for enrichment
- `POST /api/enrich/process` - Process pending enrichments

## Job Orchestration System

### Configuration
- **Timeout**: 120 seconds per attempt
- **Max Retries**: 3 attempts
- **Backoff**: Exponential (2s × 2^attempt)
- **Polling**: 1-2 second intervals

### Job Lifecycle
```
queued → running → succeeded
              ↓
           failed → (retry) → queued
              ↓
          canceled
```

### Key Functions

```typescript
// Create and run a job
createAndRunJob(type, input, executor, config, styleId?)

// Run with retry logic
runJobWithRetries(jobId, executor, config)

// Get derived status fields
getJobProgress(job) → { status, progress, message, canRetry, canCancel }
```

### Frontend Integration

```typescript
// Hook for job status polling
const { job, isPolling, cancel, retry } = useJob(jobId, {
  onSuccess: (job) => { /* handle completion */ },
  onError: (job) => { /* handle failure */ },
});

// Progress component
<JobProgress jobId={jobId} onSuccess={handleSuccess} />
```

## CV-Based Token Extraction

### Enable/Disable
Set `CV_EXTRACTION_ENABLED=true` environment variable

### Algorithms
- **Color**: K-means clustering in OKLCH space
- **Spacing**: Edge detection + histogram analysis
- **Border Radius**: Contour approximation
- **Grid**: Line detection + spacing patterns
- **Elevation**: Gradient analysis + depth estimation
- **Stroke Width**: Edge profile analysis

### Algorithm Walkthrough Mode
Request with `includeWalkthrough: true` for debug visualizations:
- Edge maps, color cluster mosaics
- Histograms, distance transforms
- Step-by-step explanations

## Metadata Enrichment

### Objective Characteristics
- Visual: mood, color family, lighting, texture
- Art Historical: era, art period, influences, similar artists
- Technical: medium, subjects
- Application: usage examples

### Subjective Visual DNA
- Emotional Resonance: narrative tone, sensory palette, movement rhythm
- Design Voice: stylistic principles, signature motifs, contrast dynamics
- Experiential Impact: psychological effect, cultural resonance, audience perception

## Caching Strategy

- **Style summaries**: Cached with STYLE_SUMMARIES key
- **Style detail**: Cached per-style with STYLE_DETAIL(id)
- **Tag summaries**: Cached with TAG_SUMMARIES key
- **Invalidation**: On style create/update/delete/enrich

## Error Handling

### Frontend
- `ErrorBoundary` wraps entire app for graceful recovery
- `AsyncBoundary` for component-level loading/error states
- `QueryErrorFallback` for React Query error display

### Backend
- Structured error responses with message field
- Job-level error tracking with retry capability
- Exponential backoff for transient failures

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Gemini API key (auto-provided) |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Gemini base URL (auto-provided) |
| `CV_EXTRACTION_ENABLED` | Enable CV token extraction ("true"/"false") |

## Key Design Decisions

1. **Immutable Styles**: Styles are created once and not modified (additive only)
2. **Tokens First**: No style without complete token definition
3. **Canonical Previews**: Three standardized preview images per style
4. **Background Enrichment**: Metadata added asynchronously after creation
5. **Job-Based Async**: All long-running operations use job system
6. **Graceful Degradation**: Error boundaries prevent cascading failures
