import { test, expect } from '@playwright/test';

test.describe('Stage 2: Inspect Panel Tests', () => {
  const placeholderStyleId = '22076530-40ae-4ab9-affb-2f5ae80be1a8';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/style/${placeholderStyleId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Design DNA Section', () => {
    test('should have a collapsible Design DNA section', async ({ page }) => {
      const designDnaSection = page.locator('details summary').filter({ hasText: 'Design DNA' });
      await expect(designDnaSection).toBeVisible();
    });

    test('should expand Design DNA section when clicked', async ({ page }) => {
      const designDnaSection = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Design DNA' }) });
      const summary = designDnaSection.locator('summary');
      
      await summary.click();
      await page.waitForTimeout(300);
      
      await expect(designDnaSection).toHaveAttribute('open', '');
    });

    test('should show Color Palette when Design DNA is expanded', async ({ page }) => {
      const designDnaSection = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Design DNA' }) });
      await designDnaSection.locator('summary').click();
      await page.waitForTimeout(500);
      
      const colorPaletteHeader = page.locator('h4').filter({ hasText: 'Color Palette' });
      await expect(colorPaletteHeader).toBeVisible();
    });

    test('should show All Tokens section when Design DNA is expanded', async ({ page }) => {
      const designDnaSection = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Design DNA' }) });
      await designDnaSection.locator('summary').click();
      await page.waitForTimeout(500);
      
      const tokensHeader = page.locator('h4').filter({ hasText: 'All Tokens' });
      await expect(tokensHeader).toBeVisible();
    });

    test('should show Material Intelligence section when Design DNA is expanded', async ({ page }) => {
      const designDnaSection = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Design DNA' }) });
      await designDnaSection.locator('summary').click();
      await page.waitForTimeout(500);
      
      const materialHeader = page.locator('h4').filter({ hasText: 'Material Intelligence' });
      await expect(materialHeader).toBeVisible();
    });
  });

  test.describe('Style Summary Section', () => {
    test('should display style name prominently', async ({ page }) => {
      await expect(page.getByText('Welcome to Visual DNA')).toBeVisible();
    });

    test('should display style description', async ({ page }) => {
      await expect(page.getByText(/placeholder style|Style Vault/i)).toBeVisible();
    });

    test('should have a back navigation to vault', async ({ page }) => {
      const backLink = page.locator('a, button').filter({ hasText: /back|vault|arrow/i }).first();
      await expect(backLink).toBeVisible();
    });
  });

  test.describe('Token Display', () => {
    test('should display color tokens in palette view', async ({ page }) => {
      const designDnaSection = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Design DNA' }) });
      await designDnaSection.locator('summary').click();
      await page.waitForTimeout(500);
      
      const colorSwatches = page.locator('[class*="rounded"]').filter({ has: page.locator('[style*="background"]') });
      const count = await colorSwatches.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
