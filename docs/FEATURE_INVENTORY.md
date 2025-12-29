# Visual DNA Studio - Feature Inventory

**Created:** December 28, 2025  
**Purpose:** Track all features during the refactoring phase  
**Status Legend:** ✅ Enabled | ❌ Disabled | 🔄 Partial

---

## Phase 1: Minimal MVP (Current Target)

Only these features are enabled in Phase 1:

| Feature | Status | Flag Key |
|---------|--------|----------|
| Style Vault (read-only) | ✅ | `vault.enabled` |
| Basic Navigation | ✅ | `nav.basic` |
| Authentication | ✅ | `auth.enabled` |

---

## Pages Inventory

| Page | Route | Status | Flag Key | Description |
|------|-------|--------|----------|-------------|
| Explore (Vault) | `/` | ✅ | `vault.enabled` | Main style gallery grid |
| Inspect | `/style/:id` | ❌ | `inspect.enabled` | Style detail view with tokens, previews |
| Create/Author | `/create` | ❌ | `create.enabled` | Upload images to create new style |
| Generate | `/generate/:styleId` | ❌ | `generate.enabled` | Generate images using a style |
| Batch Upload | `/batch` | ❌ | `batch.enabled` | Bulk style upload |
| Saved Styles | `/saved` | ❌ | `library.enabled` | User's bookmarked styles |
| Remix | `/remix` | ❌ | `remix.enabled` | Blend multiple styles |
| Creator Profile | `/creator/:creatorId` | ❌ | `creator.enabled` | User gallery pages |
| Compare | `/compare` | ❌ | `compare.enabled` | Side-by-side style comparison |
| Analytics | `/analytics` | ❌ | `analytics.enabled` | Usage statistics dashboard |
| Tools | `/tools` | ❌ | `tools.enabled` | Design utilities |
| Admin | `/admin` | ❌ | `admin.enabled` | Admin dashboard |
| Features | `/features` | ❌ | `features.enabled` | Feature showcase page |
| Shared Style | `/shared/:code` | ❌ | `sharing.enabled` | View shared style by code |

---

## Navigation Items

| Item | Location | Status | Flag Key |
|------|----------|--------|----------|
| Explore | Sidebar | ✅ | `nav.explore` |
| Create | Sidebar | ❌ | `nav.create` |
| Remix | Sidebar | ❌ | `nav.remix` |
| Tools | Sidebar | ❌ | `nav.tools` |
| My Library | User Menu | ❌ | `nav.library` |
| Analytics | User Menu | ❌ | `nav.analytics` |
| Search Bar | Header | ❌ | `search.enabled` |

---

## Explore Page Features

| Feature | Status | Flag Key | Description |
|---------|--------|----------|-------------|
| Style Grid | ✅ | `vault.enabled` | Display style cards |
| Search/Filter | ❌ | `search.enabled` | Search and filter styles |
| Sort Options | ❌ | `sort.enabled` | Sort by date, name, rating |
| Compare Mode | ❌ | `compare.enabled` | Select styles to compare |
| Delete Style | ❌ | `delete.enabled` | Remove styles |
| Infinite Scroll | ❌ | `pagination.enabled` | Load more styles |
| Refresh Button | ❌ | `refresh.enabled` | Manual refresh |

---

## Inspect Page Features

| Feature | Status | Flag Key | Description |
|---------|--------|----------|-------------|
| Style Summary | ❌ | `inspect.summary` | Name, description, metadata |
| Preview Images | ❌ | `inspect.previews` | Portrait, landscape, still life |
| Design Tokens | ❌ | `inspect.tokens` | W3C DTCG token viewer |
| Color Palette | ❌ | `inspect.palette` | Extracted color swatches |
| Mood Board | ❌ | `moodboard.enabled` | AI-generated mood board |
| UI Concepts | ❌ | `uiconcepts.enabled` | App/dashboard mockups |
| Token Export | ❌ | `export.tokens` | Export to various formats |
| PDF Export | ❌ | `export.pdf` | Brand kit PDF |
| Sharing | ❌ | `sharing.enabled` | Generate share codes |
| Bookmarking | ❌ | `bookmark.enabled` | Save to library |
| Rating/Reviews | ❌ | `rating.enabled` | Star ratings |
| Version History | ❌ | `versions.enabled` | Style snapshots |
| Try It Now | ❌ | `tryit.enabled` | Quick image generation |
| Regenerate Assets | ❌ | `regenerate.enabled` | Rebuild previews/assets |
| Material Intelligence | ❌ | `materials.enabled` | CV material analysis |

---

## Create Page Features

| Feature | Status | Flag Key | Description |
|---------|--------|----------|-------------|
| Image Upload | ❌ | `create.upload` | Upload reference images |
| Style Analysis | ❌ | `create.analysis` | AI image analysis |
| Token Extraction | ❌ | `create.tokens` | Extract design tokens |
| Auto Name Generation | ❌ | `create.autoname` | AI-generated style name |

---

## Backend API Routes

| Route | Method | Status | Flag Key | Description |
|-------|--------|--------|----------|-------------|
| `/api/styles` | GET | ✅ | `api.styles.list` | List styles |
| `/api/styles/:id` | GET | ❌ | `api.styles.detail` | Get style details |
| `/api/styles` | POST | ❌ | `api.styles.create` | Create new style |
| `/api/styles/:id` | DELETE | ❌ | `api.styles.delete` | Delete style |
| `/api/styles/:id/regenerate` | POST | ❌ | `api.regenerate` | Regenerate assets |
| `/api/styles/:id/share` | POST | ❌ | `api.share` | Generate share code |
| `/api/styles/:id/bookmark` | POST | ❌ | `api.bookmark` | Bookmark style |
| `/api/styles/:id/rate` | POST | ❌ | `api.rate` | Rate style |
| `/api/generate-image` | POST | ❌ | `api.generate` | Generate image |
| `/api/remix` | POST | ❌ | `api.remix` | Remix styles |
| `/api/analytics/*` | GET | ❌ | `api.analytics` | Analytics data |
| `/api/admin/*` | ALL | ❌ | `api.admin` | Admin endpoints |
| `/api/jobs/*` | ALL | ❌ | `api.jobs` | Background jobs |
| `/api/vision/*` | ALL | ❌ | `api.vision` | Vision analysis |

---

## AI/Pipeline Features

| Feature | Status | Flag Key | Description |
|---------|--------|----------|-------------|
| Gemini Vision Analysis | ❌ | `ai.vision` | Image analysis |
| Token Extraction | ❌ | `ai.tokens` | DTCG token generation |
| Preview Generation | ❌ | `ai.previews` | Canonical previews |
| Mood Board Generation | ❌ | `ai.moodboard` | AI mood boards |
| UI Concept Generation | ❌ | `ai.uiconcepts` | UI mockups |
| Metadata Enrichment | ❌ | `ai.enrichment` | Tags and descriptions |
| Background Jobs | ❌ | `jobs.enabled` | Async task processing |

---

## Reactivation Roadmap

### Phase 2: Read-Only Vault with Detail View
- Enable: `inspect.enabled`, `inspect.summary`, `inspect.previews`, `inspect.palette`
- Test: Style detail page loads correctly, navigation works

### Phase 3: Token System
- Enable: `inspect.tokens`, `export.tokens`
- Test: Token viewer, export functionality

### Phase 4: Search & Filter
- Enable: `search.enabled`, `sort.enabled`, `pagination.enabled`
- Test: Search, filters, infinite scroll

### Phase 5: User Features
- Enable: `library.enabled`, `bookmark.enabled`, `rating.enabled`
- Test: Bookmarks, ratings, saved styles

### Phase 6: Creation Flow
- Enable: `create.enabled`, `ai.vision`, `ai.tokens`
- Test: Full style creation pipeline

### Phase 7: Generation & Advanced
- Enable: `generate.enabled`, `ai.previews`, `ai.moodboard`, `ai.uiconcepts`
- Test: Asset generation, mood boards

### Phase 8: Full Feature Set
- Enable: `remix.enabled`, `compare.enabled`, `tools.enabled`, `analytics.enabled`
- Test: All advanced features

---

## Notes

- **Data Preservation:** All styles remain in database, just hidden via `isArchived` flag
- **Placeholder Style:** A single demo style is shown in Phase 1
- **Feature Flags:** Stored in `shared/featureFlags.ts` and evaluated client + server side
- **Rollback:** Set all flags to `true` to restore full functionality
