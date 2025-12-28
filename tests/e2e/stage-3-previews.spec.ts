import { test, expect } from '@playwright/test';

test.describe('Stage 3: Preview Features', () => {
  const styleId = '22076530-40ae-4ab9-affb-2f5ae80be1a8';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/style/${styleId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Canonical Previews Section (gated by inspect.previews flag)', () => {
    test('should have a Canonical Previews section when flag is enabled', async ({ page }) => {
      const previewsSection = page.locator('[data-testid="section-canonical-previews"]');
      await expect(previewsSection).toBeVisible();
    });

    test('should expand Canonical Previews when clicked', async ({ page }) => {
      const previewsDetails = page.locator('[data-testid="section-canonical-previews"]');
      const summary = previewsDetails.locator('summary');
      
      await summary.click();
      await page.waitForTimeout(300);
      
      await expect(previewsDetails).toHaveAttribute('open', '');
    });

    test('should show three preview slots (landscape, portrait, stillLife)', async ({ page }) => {
      const previewsDetails = page.locator('[data-testid="section-canonical-previews"]');
      await previewsDetails.locator('summary').click();
      await page.waitForTimeout(300);
      
      const previewGrid = previewsDetails.locator('.grid');
      await expect(previewGrid).toBeVisible();
      
      const previewSlots = previewGrid.locator('> div');
      await expect(previewSlots).toHaveCount(3);
    });
  });

  test.describe('Style Guide Section', () => {
    test('should have a collapsible Style Guide section', async ({ page }) => {
      const styleGuideSection = page.locator('details summary').filter({ hasText: 'Style Guide' });
      await expect(styleGuideSection).toBeVisible();
    });
  });

  test.describe('Style Card Metadata Tags', () => {
    test('should show metadata tags on vault cards', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      await expect(styleCard).toBeVisible();
      
      const tags = styleCard.locator('.rounded-full');
      const tagCount = await tags.count();
      expect(tagCount).toBeGreaterThan(0);
    });

    test('should show author or Community on vault cards', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      const authorOrCommunity = styleCard.locator('[data-testid="text-author"], [data-testid="text-community"]');
      await expect(authorOrCommunity).toBeVisible();
    });
  });
});
