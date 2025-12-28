import { test, expect } from '@playwright/test';

test.describe('Stage 0: Baseline MVP Tests', () => {
  test.describe('Style Vault (Explore Page)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const closeButton = modal.locator('button').filter({ hasText: /close|skip|×|x/i }).first();
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeButton.click();
        }
      }
    });

    test('should load the Style Vault page with correct heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Style Vault');
    });

    test('should display at least one style card', async ({ page }) => {
      const styleCards = page.locator('[data-testid^="card-style-"]');
      await expect(styleCards.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show placeholder style "Retro Industrial Audio"', async ({ page }) => {
      await expect(page.getByText('Retro Industrial Audio')).toBeVisible({ timeout: 10000 });
    });

    test('should NOT show search/filter controls (disabled in Phase 1)', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
      await expect(searchInput).not.toBeVisible();
    });

    test('should NOT show Compare button (disabled in Phase 1)', async ({ page }) => {
      const compareButton = page.locator('[data-testid="button-toggle-compare"]');
      await expect(compareButton).not.toBeVisible();
    });
  });

  test.describe('Disabled Routes', () => {
    test('/create should show FeatureDisabled message', async ({ page }) => {
      await page.goto('/create');
      await expect(page.getByText(/coming soon|not available|disabled/i)).toBeVisible();
    });

    test('/compare should show FeatureDisabled message', async ({ page }) => {
      await page.goto('/compare');
      await expect(page.getByText(/coming soon|not available|disabled/i)).toBeVisible();
    });

    test('/style/:id should show FeatureDisabled message', async ({ page }) => {
      await page.goto('/style/test-id-123');
      await expect(page.getByText(/coming soon|not available|disabled/i)).toBeVisible();
    });

    test('/library should show FeatureDisabled message', async ({ page }) => {
      await page.goto('/library');
      await expect(page.getByText(/coming soon|not available|disabled/i)).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('should have Explore navigation link visible', async ({ page }) => {
      const exploreLink = page.locator('a[href="/"], nav').filter({ hasText: /explore|vault/i });
      await expect(exploreLink.first()).toBeVisible();
    });

    test('should NOT show Create navigation link (disabled in Phase 1)', async ({ page }) => {
      const createNavLink = page.locator('nav a[href="/create"]');
      await expect(createNavLink).not.toBeVisible();
    });
  });

  test.describe('Performance Baseline', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(5000);
      console.log(`Page load time: ${loadTime}ms`);
    });

    test('should have no console errors on load', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const criticalErrors = errors.filter(e => 
        !e.includes('favicon') && 
        !e.includes('404') &&
        !e.includes('Failed to load resource')
      );
      
      expect(criticalErrors).toHaveLength(0);
    });
  });
});
