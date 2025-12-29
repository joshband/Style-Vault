/**
 * Feature Flags Configuration
 * 
 * This file controls which features are enabled/disabled during the refactoring phase.
 * Set flags to `true` to enable features, `false` to disable.
 * 
 * IMPORTANT: This is the single source of truth for feature availability.
 * Both client and server import this configuration.
 */

export interface FeatureFlags {
  // Core features
  'vault.enabled': boolean;
  'auth.enabled': boolean;
  
  // Pages
  'inspect.enabled': boolean;
  'create.enabled': boolean;
  'generate.enabled': boolean;
  'batch.enabled': boolean;
  'library.enabled': boolean;
  'remix.enabled': boolean;
  'creator.enabled': boolean;
  'compare.enabled': boolean;
  'analytics.enabled': boolean;
  'tools.enabled': boolean;
  'admin.enabled': boolean;
  'features.enabled': boolean;
  'sharing.enabled': boolean;
  
  // Navigation
  'nav.basic': boolean;
  'nav.explore': boolean;
  'nav.create': boolean;
  'nav.remix': boolean;
  'nav.tools': boolean;
  'nav.library': boolean;
  'nav.analytics': boolean;
  
  // Explore/Vault features
  'search.enabled': boolean;
  'sort.enabled': boolean;
  'pagination.enabled': boolean;
  'delete.enabled': boolean;
  'refresh.enabled': boolean;
  
  // Inspect page features
  'inspect.summary': boolean;
  'inspect.previews': boolean;
  'inspect.tokens': boolean;
  'inspect.palette': boolean;
  'styleguide.enabled': boolean;
  'usagenotes.enabled': boolean;
  'moodboard.enabled': boolean;
  'uiconcepts.enabled': boolean;
  'materials.enabled': boolean;
  
  // Actions
  'export.tokens': boolean;
  'export.pdf': boolean;
  'deploy.enabled': boolean;
  'audit.enabled': boolean;
  'designtools.enabled': boolean;
  'bookmark.enabled': boolean;
  'rating.enabled': boolean;
  'versions.enabled': boolean;
  'tryit.enabled': boolean;
  'regenerate.enabled': boolean;
  
  // Create features
  'create.upload': boolean;
  'create.analysis': boolean;
  'create.tokens': boolean;
  'create.autoname': boolean;
  
  // AI/Pipeline
  'ai.vision': boolean;
  'ai.tokens': boolean;
  'ai.previews': boolean;
  'ai.moodboard': boolean;
  'ai.uiconcepts': boolean;
  'ai.enrichment': boolean;
  'jobs.enabled': boolean;
  
  // API endpoints
  'api.styles.list': boolean;
  'api.styles.detail': boolean;
  'api.styles.create': boolean;
  'api.styles.delete': boolean;
  'api.regenerate': boolean;
  'api.share': boolean;
  'api.bookmark': boolean;
  'api.rate': boolean;
  'api.generate': boolean;
  'api.remix': boolean;
  'api.analytics': boolean;
  'api.admin': boolean;
  'api.jobs': boolean;
  'api.vision': boolean;
}

/**
 * Default feature flag values
 * 
 * PHASE 1 MINIMAL MVP:
 * - Only vault.enabled and basic navigation are true
 * - All other features disabled for controlled reintroduction
 */
export const defaultFeatureFlags: FeatureFlags = {
  // Core features - ENABLED for Phase 1
  'vault.enabled': true,
  'auth.enabled': true,
  
  // Pages - DISABLED (except vault)
  'inspect.enabled': true,
  'create.enabled': false,
  'generate.enabled': false,
  'batch.enabled': false,
  'library.enabled': false,
  'remix.enabled': false,
  'creator.enabled': false,
  'compare.enabled': false,
  'analytics.enabled': false,
  'tools.enabled': false,
  'admin.enabled': false,
  'features.enabled': false,
  'sharing.enabled': false,
  
  // Navigation - Only basic enabled
  'nav.basic': true,
  'nav.explore': true,
  'nav.create': false,
  'nav.remix': false,
  'nav.tools': false,
  'nav.library': false,
  'nav.analytics': false,
  
  // Explore/Vault features - DISABLED for Phase 1
  'search.enabled': false,
  'sort.enabled': false,
  'pagination.enabled': false,
  'delete.enabled': false,
  'refresh.enabled': false,
  
  // Inspect page features - Stage 3 minimal (display only, only previews visible)
  'inspect.summary': true,
  'inspect.previews': true,
  'inspect.tokens': false,
  'inspect.palette': false,
  'styleguide.enabled': false,
  'usagenotes.enabled': false,
  'moodboard.enabled': false,
  'uiconcepts.enabled': false,
  'materials.enabled': false,
  
  // Actions - ALL DISABLED for Stage 3 minimal
  'export.tokens': false,
  'export.pdf': false,
  'deploy.enabled': false,
  'audit.enabled': false,
  'designtools.enabled': false,
  'bookmark.enabled': false,
  'rating.enabled': false,
  'versions.enabled': false,
  'tryit.enabled': false,
  'regenerate.enabled': false,
  
  // Create features - DISABLED
  'create.upload': false,
  'create.analysis': false,
  'create.tokens': false,
  'create.autoname': false,
  
  // AI/Pipeline - DISABLED
  'ai.vision': false,
  'ai.tokens': false,
  'ai.previews': false,
  'ai.moodboard': false,
  'ai.uiconcepts': false,
  'ai.enrichment': false,
  'jobs.enabled': false,
  
  // API endpoints - Stage 3 minimal (read-only)
  'api.styles.list': true,
  'api.styles.detail': true,
  'api.styles.create': false,
  'api.styles.delete': false,
  'api.regenerate': false,
  'api.share': false,
  'api.bookmark': false,
  'api.rate': false,
  'api.generate': false,
  'api.remix': false,
  'api.analytics': false,
  'api.admin': false,
  'api.jobs': false,
  'api.vision': false,
};

/**
 * Get a feature flag value
 */
export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return defaultFeatureFlags[key] ?? false;
}

/**
 * Check multiple flags at once
 */
export function areAllFeaturesEnabled(keys: (keyof FeatureFlags)[]): boolean {
  return keys.every(key => isFeatureEnabled(key));
}

/**
 * Check if any of the flags are enabled
 */
export function isAnyFeatureEnabled(keys: (keyof FeatureFlags)[]): boolean {
  return keys.some(key => isFeatureEnabled(key));
}

/**
 * Get all enabled features (useful for debugging)
 */
export function getEnabledFeatures(): (keyof FeatureFlags)[] {
  return (Object.keys(defaultFeatureFlags) as (keyof FeatureFlags)[])
    .filter(key => defaultFeatureFlags[key]);
}

/**
 * Get all disabled features
 */
export function getDisabledFeatures(): (keyof FeatureFlags)[] {
  return (Object.keys(defaultFeatureFlags) as (keyof FeatureFlags)[])
    .filter(key => !defaultFeatureFlags[key]);
}
