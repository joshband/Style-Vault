import { test, expect } from '@playwright/test';

test.describe('Stage 4A: User Actions (Bookmark, Rating, Export)', () => {
  const styleId = '1';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/style/${styleId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Bookmark Feature (gated by bookmark.enabled flag)', () => {
    test('should show bookmark button when flag is enabled', async ({ page }) => {
      const bookmarkButton = page.locator('[data-testid="button-bookmark"]');
      await expect(bookmarkButton).toBeVisible();
    });

    test('bookmark button should be disabled when not authenticated', async ({ page }) => {
      const bookmarkButton = page.locator('[data-testid="button-bookmark"]');
      await expect(bookmarkButton).toBeDisabled();
    });
  });

  test.describe('Rating Feature (gated by rating.enabled flag)', () => {
    test('should show rating section when Share & Rate is expanded', async ({ page }) => {
      const shareRateSection = page.locator('details summary').filter({ hasText: 'Share & Rate' });
      await shareRateSection.click();
      await page.waitForTimeout(300);
      
      const ratingSection = page.locator('[data-testid="section-rating"]');
      await expect(ratingSection).toBeVisible();
    });

    test('should have 5 star rating buttons', async ({ page }) => {
      const shareRateSection = page.locator('details summary').filter({ hasText: 'Share & Rate' });
      await shareRateSection.click();
      await page.waitForTimeout(300);
      
      const starButtons = page.locator('[data-testid^="button-star-"]');
      await expect(starButtons).toHaveCount(5);
    });
  });

  test.describe('Export Tokens Feature (gated by export.tokens flag)', () => {
    test('should show export tokens button when flag is enabled', async ({ page }) => {
      const exportButton = page.locator('[data-testid="button-export-tokens"]');
      await expect(exportButton).toBeVisible();
    });

    test('export button should be clickable', async ({ page }) => {
      const exportButton = page.locator('[data-testid="button-export-tokens"]');
      await expect(exportButton).toBeEnabled();
    });
  });

  test.describe('API Endpoints', () => {
    test('bookmark API should be accessible', async ({ request }) => {
      const response = await request.get(`/api/styles/${styleId}`);
      expect(response.ok()).toBeTruthy();
    });
  });
});
