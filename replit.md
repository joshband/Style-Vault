# Visual DNA

## Overview
Visual DNA is a style intelligence application designed to manage visual styles as first-class, standards-based artifacts. It treats styles as reusable, inspectable, and comparable objects comprising reference images, canonical preview images, W3C DTCG design tokens, and AI prompt scaffolding. The core principle is that design tokens are the definitive source of truth, with image generation consuming these styles rather than defining them. The application facilitates browsing and comparing saved styles, creating new styles from various inputs, and generating new images using established styles. The business vision is to standardize and streamline visual asset management, offering market potential in design, marketing, and content creation industries by providing a robust, AI-powered platform for consistent visual branding and rapid prototyping.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS v4 with shadcn/ui (New York style) for a modern, consistent look.
- **Animations**: Framer Motion for smooth, engaging user interactions.

### Technical Implementations
- **Frontend**: Utilizes Wouter for routing, TanStack React Query for state management, and Vite for building.
- **Backend**: Node.js with Express and TypeScript (ESM modules) providing RESTful JSON endpoints. esbuild is used for server bundling.
- **Authentication**: Replit Auth (OpenID Connect) handles user sign-ins, session management via PostgreSQL, and user profiles.
- **Data Storage**: PostgreSQL with Drizzle ORM manages all persistent data, including `styles`, `users`, `sessions`, `bookmarks`, `ratings`, and `generatedImages`.
- **AI Integration**: Leverages Google Gemini via Replit AI Integrations for image analysis, canonical preview generation, styled image generation, and metadata enrichment. AI image generation prioritizes Design Tokens.
- **UI Concept Style Transfer**: The `generateSingleUiConcept` function in `server/mood-board-generation.ts` now passes the reference image directly to Gemini for proper style transfer, ensuring UI mockups (softwareApp, audioPlugin, dashboard) match the artistic rendering style of the source reference image.
- **Comprehensive DTCG Generator**: Combines CV, Vision API, and AI to produce full W3C DTCG 2025.10 token structures, encompassing 12 categories (color, spacing, typography, etc.) with confidence tracking and source attribution.
- **Token Export Pipeline**: A modular pipeline exports design tokens into 18 different formats, including various code, mobile, design tool, and game engine formats.
- **One-Click Deploy**: Supports deployment to Vercel and Netlify by generating platform-specific configurations and bundling necessary assets.
- **Async Job Orchestration**: A robust system (`server/job-runner.ts`) manages long-running operations like token_extraction, image_generation, and metadata_enrichment with retry logic and backoff.
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