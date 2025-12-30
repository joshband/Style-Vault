# Visual DNA

## Overview
Visual DNA is a style intelligence application designed to manage visual styles as first-class, standards-based artifacts. It treats styles as reusable, inspectable, and comparable objects comprising reference images, canonical preview images, W3C DTCG design tokens, and AI prompt scaffolding. The core principle is that design tokens are the definitive source of truth, with image generation consuming these styles rather than defining them. The application facilitates browsing and comparing saved styles, creating new styles from various inputs, and generating new images using established styles. The business vision is to standardize and streamline visual asset management, offering market potential in design, marketing, and content creation industries by providing a robust, AI-powered platform for consistent visual branding and rapid prototyping.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS v4 with shadcn/ui (New York style) for a modern, consistent look.
- **Animations**: Framer Motion for smooth page transitions, hover effects, and micro-interactions.
- **Loading States**: Skeleton loaders with shimmer animations for cards and lists, blur-up lazy image loading with IntersectionObserver.
- **Modular Style Inspector**: The Style Inspector (`/style/:id`) uses a feature-based modular architecture in `client/src/features/style-inspector/` with tiered data loading to prevent main-thread stalls:
  - **Tier 1 (Immediate)**: Fetches `/api/styles/:id/hero` (~1KB) containing only name, description, status - NO tokens/metadata
  - **Tier 2 (300ms)**: Mounts ImageSection which fetches `/api/styles/:id/image-ids`
  - **Tier 3 (600ms)**: Mounts CollapsibleSections shell with accordions (no data fetched yet)
  - **Tier 4 (On-Demand)**: Each accordion section (Design DNA, Style Guide, AI Insights, Previews) fetches its data via React Query only when user opens it, using `enabled` guards
  - Components: StyleHeroComponent, ImageSection, CollapsibleSections with OnDemandAccordion pattern
  - Performance target: First paint <1s, no main-thread blocks >200ms
- **Empty States**: Illustrated empty state components (NoStylesEmpty, NoBookmarksEmpty, NoSearchResultsEmpty, NoCollectionsEmpty, etc.) with animated icons and helpful CTAs.
- **Notifications**: Sonner toast system with specialized notifications for styles, collections, exports, and errors.
- **Onboarding**: First-time user welcome modal with feature highlights (stored in localStorage).
- **Mobile Responsive**: Responsive grids (260px min-width cards), collapsible sidebar, touch-friendly interactions.

### Technical Implementations
- **Frontend**: Utilizes Wouter for routing, TanStack React Query for state management, and Vite for building.
- **Backend**: Node.js with Express and TypeScript (ESM modules) providing RESTful JSON endpoints. esbuild is used for server bundling.
- **Authentication**: Replit Auth (OpenID Connect) handles user sign-ins, session management via PostgreSQL, and user profiles.
- **Data Storage**: PostgreSQL with Drizzle ORM manages all persistent data, including `styles`, `users`, `sessions`, `bookmarks`, `ratings`, and `generatedImages`.
- **AI Integration**: Leverages Google Gemini via Replit AI Integrations for image analysis, canonical preview generation, styled image generation, and metadata enrichment. AI image generation prioritizes Design Tokens.
- **UI Concept Style Transfer**: The `generateSingleUiConcept` function in `server/mood-board-generation.ts` now passes the reference image directly to Gemini for proper style transfer, ensuring UI mockups (softwareApp, audioPlugin, dashboard) match the artistic rendering style of the source reference image. UI concepts use optimized aspect ratios: softwareApp and dashboard use 1:1 square, audioPlugin uses 16:9 landscape.
- **Comprehensive DTCG Generator**: Combines CV, Vision API, and AI to produce full W3C DTCG 2025.10 token structures, encompassing 12 categories (color, spacing, typography, etc.) with confidence tracking and source attribution.
- **Token Export Pipeline**: A modular pipeline exports design tokens into 18 different formats, including various code, mobile, design tool, and game engine formats.
- **One-Click Deploy**: Supports deployment to Vercel and Netlify by generating platform-specific configurations and bundling necessary assets.
- **Async Job Orchestration**: A robust system (`server/job-runner.ts`) manages long-running operations like token_extraction, image_generation, and metadata_enrichment with retry logic and backoff.
- **Parallel Image Generation**: Uses `Promise.allSettled` for independent stage persistence, achieving 60-70% faster style regeneration with token snapshots to prevent race conditions.
- **Optimized Image Storage**: All generated images (previews, mood boards, UI concepts) flow through `server/object-image-service.ts` via `storeImageToObjectStorage()` which creates WebP-optimized variants: thumb (300px), medium (800px), and full (original quality). The UI loads appropriate sizes: vault thumbnails use ?size=thumb, detail views use ?size=medium, and downloads use ?size=full. Images are stored in Replit Object Storage, NOT as base64 in the database.
- **Automatic Usage Notes Generation**: The metadata enrichment pipeline (`queueStyleForEnrichment()`) now calls both `enrichStyleMetadata()` for tags AND `enrichStyleSpec()` for usage guidelines and design notes, ensuring complete style documentation on style creation/regeneration.
- **AI Retry Logic**: Production-grade retry wrapper (`server/retry-utils.ts`) using p-retry with exponential backoff (4 retries, 2-60s timeout) for Gemini/OpenAI/Prodia API calls.
- **Modular Route Architecture**: Domain-specific routers in `server/routes/` (styles, images, jobs, analytics, system, pipeline, vision, batch-processing) for maintainability.
- **Node.js-to-Python Pipeline Integration**: A bridge (`server/pipeline-bridge.ts`) facilitates communication with a Python backend for advanced CV, validation, and semantic search capabilities.
- **Component + Material Intelligence Pipeline**: CV-based system for detecting UI components (buttons, sliders, knobs, cards) and extracting material/texture signals (translucency, specular, emission, grain, microcontrast). Features a library of 12 material recipes (glassmorphic, anodized metal, soft plastic, neon, etc.) with confidence-scored matching. Optional Gemini AI semantic classification for enhanced component labeling.

### Feature Specifications
- **User Features**: Bookmarking, 1-5 star ratings and reviews, creator-linked style galleries, public/private style visibility, and protected routes requiring authentication.
- **Background Worker System**: Autonomous system for style name repair, mood board generation, task deduplication, and cache invalidation.
- **Style Sharing**: Styles can be shared via 6-character alphanumeric codes.
- **Style Versioning**: Tracks style changes in a `style_versions` table, allowing for manual snapshots and reverts.

### System Design Choices
- **Tokens as Source of Truth**: Design tokens are central to ensuring style portability and consistency.
- **Canonical Preview System**: Standardized previews enable consistent cross-style comparison.
- **Prompt Scaffolding**: Structured prompts derived from tokens ensure consistent application of styles in AI generation.
- **Job-Based Async Operations**: Guarantees reliability for long-running and resource-intensive tasks.
- **Pluggable Storage**: Utilizes in-memory storage for development and production-ready interfaces for cloud services.
- **Python Pipeline Backend**: Modular Python services for advanced functionalities like DTCG validation, canonical assembly, semantic search, safety hardening, and material intelligence.
- **Material Intelligence Panel**: Interactive UI component in the Style Inspector for analyzing material properties, viewing detected components, and exploring matched recipes with layer topology and interaction bindings.
- **Image Service Migration**: `server/image-service.ts` functions (storeImage, getImage, migrateStyleImages) are deprecated in favor of `server/object-image-service.ts`. Admin endpoints `/api/admin/migrate-to-object-storage` and `/api/admin/migration-status` facilitate migrating existing `imageAssets` table data to `objectAssets` table with Object Storage backing.

## External Dependencies

### AI Services
- **Replit AI Integrations**: For Google Gemini API access.
- **Google Cloud Vision API**: For production-grade image analysis (labels, colors, objects, text, safe search).
- **Prodia AI**: For fast image generation (Flux Fast Schnell model).

### Database
- **PostgreSQL**: The primary relational database.

### UI Components
- **shadcn/ui**: Component library.
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.

### Development Tools
- **Vite**: Frontend build tool.
- **Drizzle Kit**: Database schema management.
- **esbuild**: Server bundling.