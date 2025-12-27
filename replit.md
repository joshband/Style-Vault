# Visual DNA

## Overview
Visual DNA is a style intelligence application that manages visual styles as first-class, standards-based artifacts. It treats styles as reusable, inspectable, and comparable objects composed of reference images, canonical preview images, W3C DTCG design tokens, and AI prompt scaffolding. The core philosophy is that design tokens are the source of truth, and image generation is a consumer of these styles, not their definition. The application supports browsing and comparing saved styles (Style Explorer), creating new styles from images or prompts (Style Authoring), and generating new images using saved styles (Image Generation).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS v4 with shadcn/ui (New York style)
- **Animations**: Framer Motion
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON endpoints
- **Build Process**: esbuild for server, Vite for client

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Features**: Sign in with various providers, session management via PostgreSQL, user profiles.
- **Client Hook**: `useAuth()` for UI integration.

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Key Tables**: `users`, `sessions`, `styles` (with tokens, previews, metadata, creatorId), `bookmarks`, `ratings`, `generatedImages`, `conversations`, `messages`.

### User Features
- **Bookmarking**: Save and manage favorite styles.
- **Ratings & Reviews**: Provide 1-5 star ratings and reviews for styles.
- **Creator Tracking**: Styles are linked to their creators, allowing for creator-specific style galleries.
- **Public/Private Visibility**: Styles can be toggled between public and private visibility by their creators.
- **Protected Routes**: User-specific endpoints require authentication.

### AI Integration
- **Provider**: Google Gemini via Replit AI Integrations (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-image`).
- **Features**: Image analysis for style extraction, canonical preview generation, styled image generation, and metadata enrichment.
- **Token-Weighted Prompts**: AI image generation prioritizes Design Tokens as primary visual directives, with semantic context as secondary guidance.

### Google Cloud Vision API
- **Service**: `server/vision-service.ts` - Production-grade image analysis using GCP Vision API.
- **Authentication**: Uses `GOOGLE_CLOUD_CREDENTIALS` secret (service account JSON key).
- **Capabilities**: Label detection (up to 15 labels with confidence scores), dominant color extraction (10 colors with RGB, score, pixel fraction), object localization with bounding boxes, OCR text detection with locale, safe search moderation, web entity recognition.
- **Endpoints**:
  - `GET /api/vision/status` - Check Vision service availability
  - `POST /api/vision/analyze` - Full analysis (labels, colors, objects, text, safe search, web entities)
  - `POST /api/vision/labels` - Label detection only
  - `POST /api/vision/colors` - Dominant color extraction only
- **Input**: Accepts base64-encoded images or URLs (http://, https://, gs://).

### Fast Image Generation (Prodia)
- **Provider**: Prodia AI with Flux Fast Schnell model.
- **Endpoint**: `POST /api/generate/prodia` - accepts prompt, optional seed, optional styleId.
- **Speed**: ~500ms generation time (sub-second).
- **Service**: `server/prodia-service.ts` - wrapper with error handling and status checking.
- **Status Check**: `GET /api/prodia-status` - returns enabled status and configuration message.
- **Use Case**: Rapid iteration, real-time previews, quick drafts during style exploration.

### CV-Based Token Extraction (Optional)
- **Technology**: Python script using `opencv-python-headless`, `numpy`, `scipy`, `coloraide` for deterministic, explainable token extraction.
- **Capabilities**: Extracts colors (OKLCH), spacing, border radius, grid, elevation, stroke width. Includes advanced color analysis (harmony, WCAG contrast, temperature) and multi-cue depth estimation.
- **Algorithm Walkthrough**: Opt-in feature to visualize intermediate CV processing steps for educational purposes.

### Typography Recommendation Engine
- **Endpoint**: `POST /api/style/typography` - accepts image, returns font recommendations.
- **Technology**: Python CV for signal extraction + TypeScript for intent mapping and scoring.
- **Modular Design**:
  - `server/typography/styleSignals.ts` - Extracts contrast, edge sharpness, geometric bias, density, symmetry, material hints via Python CV.
  - `server/typography/typographyIntent.ts` - Deterministic mapping from signals to typography intent (serifness, weightBias, widthBias, formality, eraBias, humanist, decorative, legibility).
  - `server/typography/fontCatalog.ts` - Curated ~30 Google Fonts with hand-scored metadata across all intent dimensions.
  - `server/typography/recommendFonts.ts` - Weighted similarity scoring, returns top 3 ranked fonts + heading/body pairing.
- **Key Design**: Works on images with zero text (suggestion engine, not detector). No ML - all mappings are deterministic and explainable.

### Design Token System
- **Standard**: W3C DTCG 2025.10 format.
- **Structure**: Hierarchical JSON with `$type`, `$value`, and `$description`.
- **Usage**: Defines visual characteristics for consistent application across generated images.

### Token Export Pipeline
- **Architecture**: Modular pipeline with normalization → alias resolution → transformation stages.
- **Core File**: `client/src/lib/token-pipeline.ts` - Pipeline types, normalization, alias resolution, shared utilities.
- **Exporter Registry**: Plugin-style registration pattern in `client/src/lib/exporters/`.
- **Exporters** (18 formats):
  - **Code**: W3C DTCG JSON (.tokens.json), CSS Variables, SCSS Variables, React/TypeScript, Tailwind Config, Next.js Theme
  - **Mobile**: Flutter/Dart, React Native, Swift/iOS (SwiftUI + UIKit), Android XML (colors.xml/dimens.xml)
  - **Design Tools**: Figma Variables JSON, Adobe ASE Swatches (binary), Sketch Palette
  - **Frameworks**: Material UI theme, Web Components
  - **Game/Audio**: Unity C# ScriptableObject, JUCE C++ header, Unreal Engine DataAsset
- **Features**: Alias resolution ({} syntax), type inference, color format conversion, dimension parsing.
- **UI**: Multi-target export dialog with category grouping, sub-options per format, toast notifications.

### One-Click Deploy
- **Platforms**: Vercel and Netlify support via DeployDialog component.
- **Bundle Contents**: Single ZIP archive containing tokens.css, tokens.json, theme.ts, platform config (vercel.json or netlify.toml), package.json, and README.md.
- **Features**: Platform-specific configuration generation, copy-to-clipboard commands, quick start instructions, and single-file download.

### Async Job Orchestration
- **Engine**: `server/job-runner.ts` manages all long-running operations.
- **Features**: Persistent job tracking, configurable timeouts, max retries, exponential backoff, and polling.
- **Job Types**: token_extraction, preview_generation, image_generation, mood_board, metadata_enrichment, style_name_repair, background_asset_generation.

### Background Worker System
- **Purpose**: Autonomous asset generation and maintenance.
- **Tasks**: Style name repair, automatic generation of mood boards and UI concepts, deduplication of tasks, and cache invalidation.

### Style Sharing
- **Mechanism**: 6-character alphanumeric share codes.
- **Functionality**: Generate share codes for styles and access styles via these codes for public viewing.

### Style Versioning
- **Database**: `style_versions` table for snapshots of style states.
- **Features**: Tracks versions with change types, allows manual snapshots, and enables reverting to previous versions (owner only).

### Node.js-to-Python Pipeline Integration
- **Bridge**: `server/pipeline-bridge.ts` - HTTP client to call Python pipeline services
- **Pipeline Storage**: `server/pipeline-storage.ts` - Adapters connecting Replit Object Storage and PostgreSQL
- **API Endpoints**:
  - `GET /api/pipeline/health` - Check Python pipeline status
  - `POST /api/pipeline/validate-tokens` - Validate DTCG tokens using Python validator
  - `POST /api/pipeline/assemble` - Assemble canonical style artifacts
  - `GET /api/pipeline/search` - Semantic search
  - `GET /api/pipeline/storage` - Storage configuration status
- **Production Endpoints**:
  - `GET /api/ready` - Kubernetes/Cloud Run readiness probe
  - `GET /api/live` - Liveness probe

### Pipeline Backend Infrastructure (Python)
- **Location**: `pipeline/` directory with modular Python modules
- **Version**: Pipeline v1.0.0, Schema v1.0.0, W3C DTCG 2025.10
- **HTTP Server**: `pipeline/server.py` - Lightweight HTTP API for pipeline operations

#### Stage 9: Normalization Engine (`pipeline/normalize/`)
- **DTCG Validator**: Validates W3C DTCG 2025.10 tokens, resolves aliases (up to 10 levels), validates color/dimension/shadow formats
- **Schema Validator**: JSON schema validation for components, layers, lighting, materials, motion, style semantics
- **Lineage Tracker**: Full provenance tracking with stage execution records, model versions, intermediate artifacts
- **Canonical Assembler**: Assembles validated data into canonical style artifacts with flags and validation summary

#### Stage 10: API Service (`pipeline/api/`)
- **Job Queue**: Async job-based execution with priority ordering, retry logic (max 3), configurable timeouts
- **Pipeline Orchestrator**: Stage sequencing, result aggregation, parallel execution support
- **REST Routes**: GCP Cloud Run compatible endpoints (POST /ingest/image, GET /styles/:id, GET /jobs/:id, etc.)

#### Stage 10: Storage Abstraction (`pipeline/storage/`)
- **Blob Storage**: Protocol for images, masks, depth maps (in-memory for dev, GCP Cloud Storage interface)
- **Structured Storage**: Protocol for style artifacts, metadata (in-memory for dev, Postgres interface)
- **Vector Storage**: Protocol for embeddings (in-memory with cosine similarity, pluggable for Pinecone/pgvector)
- **Unified Storage**: Combines all three with atomic operations

#### Stage 11: Semantic Search (`pipeline/search/`)
- **Style Indexer**: Indexes styles by tags, components, materials for fast filtering
- **Search Engine**: Text-based search with pseudo-embeddings, similar style retrieval, component-based search
- **Explainable Results**: Each search result includes human-readable explanation of match reason

#### Stage 12: Test Suite (`pipeline/tests/`)
- **Coverage**: 101 pytest tests covering validators, lineage, assembly, job queue, storage, search
- **Frameworks**: pytest, pytest-asyncio for async tests
- **Pattern**: Unit tests for each module with comprehensive edge case coverage

#### Stage 13: Safety Hardening (`pipeline/safety/`)
- **File Validators**: Magic byte detection, size limits (50MB), content type validation, filename sanitization
- **Rate Limiter**: Sliding window algorithm, per-endpoint configuration, middleware support
- **Determinism Checker**: Reproducibility verification, output caching, mismatch detection
- **Schema Versioning**: Version tracking, migration support, backward compatibility

### Key Design Decisions
- **Tokens as Source of Truth**: All styles must have complete token definitions for portability and consistency.
- **Canonical Preview System**: Standardized preview images for cross-style comparison.
- **Prompt Scaffolding**: Structured prompt templates derived from tokens for consistent style application.
- **Job-Based Async Operations**: Robust system for long-running tasks with retry and progress tracking.
- **Background Metadata Enrichment**: AI-powered enrichment of styles with objective and subjective "Visual DNA" descriptors for advanced search and discovery.
- **Pluggable Storage**: In-memory implementations for development, production-ready interfaces for GCP services.

## External Dependencies

### AI Services
- **Replit AI Integrations**: Provides Google Gemini API access.

### Database
- **PostgreSQL**: Primary data store.

### UI Components
- **shadcn/ui**: Component library based on Radix UI.
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.

### Development Tools
- **Vite**: Frontend build and dev server.
- **Drizzle Kit**: Database schema management.
- **esbuild**: Server bundling.