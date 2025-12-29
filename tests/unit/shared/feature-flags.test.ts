import { describe, it, expect } from 'vitest';
import {
  defaultFeatureFlags,
  isFeatureEnabled,
  areAllFeaturesEnabled,
  isAnyFeatureEnabled,
  getEnabledFeatures,
  getDisabledFeatures,
  type FeatureFlags,
} from '../../../shared/featureFlags';

describe('Feature Flags System', () => {
  describe('defaultFeatureFlags', () => {
    it('should have all expected flag keys defined', () => {
      const expectedKeys: (keyof FeatureFlags)[] = [
        'vault.enabled',
        'auth.enabled',
        'inspect.enabled',
        'create.enabled',
        'generate.enabled',
        'batch.enabled',
        'library.enabled',
        'remix.enabled',
        'creator.enabled',
        'compare.enabled',
        'analytics.enabled',
        'tools.enabled',
        'admin.enabled',
        'features.enabled',
        'sharing.enabled',
        'nav.basic',
        'nav.explore',
        'nav.create',
        'nav.remix',
        'nav.tools',
        'nav.library',
        'nav.analytics',
        'search.enabled',
        'sort.enabled',
        'pagination.enabled',
        'delete.enabled',
        'refresh.enabled',
        'inspect.summary',
        'inspect.previews',
        'inspect.tokens',
        'inspect.palette',
        'moodboard.enabled',
        'uiconcepts.enabled',
        'materials.enabled',
        'export.tokens',
        'export.pdf',
        'styleguide.enabled',
        'usagenotes.enabled',
        'deploy.enabled',
        'audit.enabled',
        'designtools.enabled',
        'bookmark.enabled',
        'rating.enabled',
        'versions.enabled',
        'tryit.enabled',
        'regenerate.enabled',
        'create.upload',
        'create.analysis',
        'create.tokens',
        'create.autoname',
        'ai.vision',
        'ai.tokens',
        'ai.previews',
        'ai.moodboard',
        'ai.uiconcepts',
        'ai.enrichment',
        'jobs.enabled',
        'api.styles.list',
        'api.styles.detail',
        'api.styles.create',
        'api.styles.delete',
        'api.regenerate',
        'api.share',
        'api.bookmark',
        'api.rate',
        'api.generate',
        'api.remix',
        'api.analytics',
        'api.admin',
        'api.jobs',
        'api.vision',
      ];

      expectedKeys.forEach(key => {
        expect(defaultFeatureFlags).toHaveProperty(key);
        expect(typeof defaultFeatureFlags[key]).toBe('boolean');
      });
    });

    it('should have exactly the Stage 4 flags enabled (previews + Design DNA)', () => {
      const stage4Flags: (keyof FeatureFlags)[] = [
        'vault.enabled',
        'auth.enabled',
        'nav.basic',
        'nav.explore',
        'api.styles.list',
        'inspect.enabled',
        'api.styles.detail',
        'inspect.summary',
        'inspect.previews',
        'inspect.tokens',
        'inspect.palette',
      ];

      stage4Flags.forEach(key => {
        expect(defaultFeatureFlags[key]).toBe(true);
      });
    });

    it('should have all section and action features disabled for Stage 4', () => {
      const disabledActionFlags: (keyof FeatureFlags)[] = [
        'styleguide.enabled',
        'usagenotes.enabled',
        'versions.enabled',
        'sharing.enabled',
        'bookmark.enabled',
        'rating.enabled',
        'export.tokens',
        'export.pdf',
        'deploy.enabled',
        'audit.enabled',
        'designtools.enabled',
        'tryit.enabled',
        'moodboard.enabled',
        'uiconcepts.enabled',
        'materials.enabled',
        'api.bookmark',
        'api.rate',
      ];

      disabledActionFlags.forEach(key => {
        expect(defaultFeatureFlags[key]).toBe(false);
      });
    });

    it('should have all non-Stage 4 features disabled', () => {
      const stage4EnabledFlags = new Set([
        'vault.enabled',
        'auth.enabled',
        'nav.basic',
        'nav.explore',
        'api.styles.list',
        'inspect.enabled',
        'api.styles.detail',
        'inspect.summary',
        'inspect.previews',
        'inspect.tokens',
        'inspect.palette',
      ]);

      Object.entries(defaultFeatureFlags).forEach(([key, value]) => {
        if (!stage4EnabledFlags.has(key)) {
          expect(value).toBe(false);
        }
      });
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', () => {
      expect(isFeatureEnabled('vault.enabled')).toBe(true);
      expect(isFeatureEnabled('auth.enabled')).toBe(true);
      expect(isFeatureEnabled('api.styles.list')).toBe(true);
    });

    it('should return false for disabled features', () => {
      expect(isFeatureEnabled('create.enabled')).toBe(false);
      expect(isFeatureEnabled('compare.enabled')).toBe(false);
      expect(isFeatureEnabled('search.enabled')).toBe(false);
    });

    it('should return true for Stage 1 newly enabled features', () => {
      expect(isFeatureEnabled('inspect.enabled')).toBe(true);
      expect(isFeatureEnabled('api.styles.detail')).toBe(true);
    });
  });

  describe('areAllFeaturesEnabled', () => {
    it('should return true when all specified features are enabled', () => {
      expect(areAllFeaturesEnabled(['vault.enabled', 'auth.enabled'])).toBe(true);
    });

    it('should return false when any specified feature is disabled', () => {
      expect(areAllFeaturesEnabled(['vault.enabled', 'create.enabled'])).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(areAllFeaturesEnabled([])).toBe(true);
    });
  });

  describe('isAnyFeatureEnabled', () => {
    it('should return true when at least one feature is enabled', () => {
      expect(isAnyFeatureEnabled(['vault.enabled', 'inspect.enabled'])).toBe(true);
    });

    it('should return false when all specified features are disabled', () => {
      expect(isAnyFeatureEnabled(['compare.enabled', 'create.enabled'])).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isAnyFeatureEnabled([])).toBe(false);
    });
  });

  describe('getEnabledFeatures', () => {
    it('should return all Stage 4 enabled features (previews + Design DNA)', () => {
      const enabled = getEnabledFeatures();
      expect(enabled).toContain('vault.enabled');
      expect(enabled).toContain('auth.enabled');
      expect(enabled).toContain('nav.basic');
      expect(enabled).toContain('nav.explore');
      expect(enabled).toContain('api.styles.list');
      expect(enabled).toContain('inspect.enabled');
      expect(enabled).toContain('api.styles.detail');
      expect(enabled).toContain('inspect.summary');
      expect(enabled).toContain('inspect.previews');
      expect(enabled).toContain('inspect.tokens');
      expect(enabled).toContain('inspect.palette');
      expect(enabled.length).toBe(11);
    });

    it('should not include any disabled section or action features', () => {
      const enabled = getEnabledFeatures();
      expect(enabled).not.toContain('styleguide.enabled');
      expect(enabled).not.toContain('usagenotes.enabled');
      expect(enabled).not.toContain('versions.enabled');
      expect(enabled).not.toContain('sharing.enabled');
      expect(enabled).not.toContain('bookmark.enabled');
      expect(enabled).not.toContain('rating.enabled');
      expect(enabled).not.toContain('export.tokens');
      expect(enabled).not.toContain('deploy.enabled');
      expect(enabled).not.toContain('audit.enabled');
      expect(enabled).not.toContain('designtools.enabled');
      expect(enabled).not.toContain('tryit.enabled');
    });
  });

  describe('getDisabledFeatures', () => {
    it('should return all disabled features', () => {
      const disabled = getDisabledFeatures();
      expect(disabled).toContain('create.enabled');
      expect(disabled).toContain('compare.enabled');
      expect(disabled).toContain('search.enabled');
    });

    it('should not include enabled features', () => {
      const disabled = getDisabledFeatures();
      expect(disabled).not.toContain('vault.enabled');
      expect(disabled).not.toContain('auth.enabled');
      expect(disabled).not.toContain('inspect.enabled');
      expect(disabled).not.toContain('api.styles.detail');
    });

    it('should have total flags = enabled + disabled', () => {
      const enabled = getEnabledFeatures();
      const disabled = getDisabledFeatures();
      const totalFlags = Object.keys(defaultFeatureFlags).length;
      expect(enabled.length + disabled.length).toBe(totalFlags);
    });
  });

  describe('Type Safety', () => {
    it('should not allow invalid flag keys at compile time', () => {
      const validKey: keyof FeatureFlags = 'vault.enabled';
      expect(isFeatureEnabled(validKey)).toBeDefined();
    });

    it('should have boolean values for all flags', () => {
      Object.values(defaultFeatureFlags).forEach(value => {
        expect(typeof value).toBe('boolean');
      });
    });
  });
});
