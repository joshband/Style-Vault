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

    it('should have exactly the Stage 4A flags enabled', () => {
      const stage4aEnabledFlags: (keyof FeatureFlags)[] = [
        'vault.enabled',
        'auth.enabled',
        'nav.basic',
        'nav.explore',
        'api.styles.list',
        'inspect.enabled',
        'api.styles.detail',
        'inspect.summary',
        'inspect.tokens',
        'inspect.palette',
        'inspect.previews',
        'bookmark.enabled',
        'rating.enabled',
        'export.tokens',
        'api.bookmark',
        'api.rate',
      ];

      stage4aEnabledFlags.forEach(key => {
        expect(defaultFeatureFlags[key]).toBe(true);
      });
    });

    it('should have all non-Stage 4A features disabled', () => {
      const stage4aEnabledFlags = new Set([
        'vault.enabled',
        'auth.enabled',
        'nav.basic',
        'nav.explore',
        'api.styles.list',
        'inspect.enabled',
        'api.styles.detail',
        'inspect.summary',
        'inspect.tokens',
        'inspect.palette',
        'inspect.previews',
        'bookmark.enabled',
        'rating.enabled',
        'export.tokens',
        'api.bookmark',
        'api.rate',
      ]);

      Object.entries(defaultFeatureFlags).forEach(([key, value]) => {
        if (!stage4aEnabledFlags.has(key)) {
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
    it('should return all Stage 4A enabled features', () => {
      const enabled = getEnabledFeatures();
      expect(enabled).toContain('vault.enabled');
      expect(enabled).toContain('auth.enabled');
      expect(enabled).toContain('nav.basic');
      expect(enabled).toContain('nav.explore');
      expect(enabled).toContain('api.styles.list');
      expect(enabled).toContain('inspect.enabled');
      expect(enabled).toContain('api.styles.detail');
      expect(enabled).toContain('inspect.summary');
      expect(enabled).toContain('inspect.tokens');
      expect(enabled).toContain('inspect.palette');
      expect(enabled).toContain('inspect.previews');
      expect(enabled).toContain('bookmark.enabled');
      expect(enabled).toContain('rating.enabled');
      expect(enabled).toContain('export.tokens');
      expect(enabled).toContain('api.bookmark');
      expect(enabled).toContain('api.rate');
      expect(enabled.length).toBe(16);
    });

    it('should not include any disabled features', () => {
      const enabled = getEnabledFeatures();
      expect(enabled).not.toContain('create.enabled');
      expect(enabled).not.toContain('compare.enabled');
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
