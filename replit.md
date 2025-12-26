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

### CV-Based Token Extraction (Optional)
- **Technology**: Python script using `opencv-python-headless`, `numpy`, `scipy`, `coloraide` for deterministic, explainable token extraction.
- **Capabilities**: Extracts colors (OKLCH), spacing, border radius, grid, elevation, stroke width. Includes advanced color analysis (harmony, WCAG contrast, temperature) and multi-cue depth estimation.
- **Algorithm Walkthrough**: Opt-in feature to visualize intermediate CV processing steps for educational purposes.

### Design Token System
- **Standard**: W3C DTCG 2025.10 format.
- **Structure**: Hierarchical JSON with `$type`, `$value`, and `$description`.
- **Usage**: Defines visual characteristics for consistent application across generated images.

### Token Export Pipeline
- **Architecture**: Modular pipeline with normalization → alias resolution → transformation stages.
- **Core File**: `client/src/lib/token-pipeline.ts` - Pipeline types, normalization, alias resolution, shared utilities.
- **Exporter Registry**: Plugin-style registration pattern in `client/src/lib/exporters/`.
- **Exporters** (13 formats):
  - **Code**: W3C DTCG JSON (.tokens.json), CSS Variables, SCSS Variables, React/TypeScript, Tailwind Config
  - **Mobile**: Flutter/Dart, React Native, Swift/iOS (SwiftUI + UIKit)
  - **Design Tools**: Figma Variables JSON
  - **Frameworks**: Material UI theme, Web Components
  - **Game/Audio**: Unity C# ScriptableObject, JUCE C++ header
- **Features**: Alias resolution ({} syntax), type inference, color format conversion, dimension parsing.
- **UI**: Multi-target export dialog with category grouping, sub-options per format, toast notifications.

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

### Key Design Decisions
- **Tokens as Source of Truth**: All styles must have complete token definitions for portability and consistency.
- **Canonical Preview System**: Standardized preview images for cross-style comparison.
- **Prompt Scaffolding**: Structured prompt templates derived from tokens for consistent style application.
- **Job-Based Async Operations**: Robust system for long-running tasks with retry and progress tracking.
- **Background Metadata Enrichment**: AI-powered enrichment of styles with objective and subjective "Visual DNA" descriptors for advanced search and discovery.

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