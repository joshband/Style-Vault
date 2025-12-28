import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.describe('Gallery Page Screenshots', () => {
    test('gallery page desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('gallery-desktop.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });

    test('gallery page mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('gallery-mobile.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });

    test('gallery page tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('gallery-tablet.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });
  });

  test.describe('Create Page Screenshots', () => {
    test('create page desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/create');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('create-desktop.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });

    test('create page mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/create');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('create-mobile.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });
  });

  test.describe('Style Details Screenshots', () => {
    test('style details page desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      
      const firstCard = page.locator('[data-testid^="card-style-"]').first();
      await firstCard.waitFor({ state: 'visible', timeout: 10000 });
      await firstCard.click();
      await page.waitForURL(/\/style\//, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('style-details-desktop.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });

    test('style details page mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      
      const firstCard = page.locator('[data-testid^="card-style-"]').first();
      await firstCard.waitFor({ state: 'visible', timeout: 10000 });
      await firstCard.click();
      await page.waitForURL(/\/style\//, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('style-details-mobile.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });
  });

  test.describe('Export Dialog Screenshots', () => {
    test('export dialog open', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      
      const firstCard = page.locator('[data-testid^="card-style-"]').first();
      await firstCard.waitFor({ state: 'visible', timeout: 10000 });
      await firstCard.click();
      await page.waitForURL(/\/style\//, { timeout: 10000 });
      
      const exportButton = page.locator('[data-testid="button-export-primary"]');
      await exportButton.click();
      
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      
      await expect(dialog).toHaveScreenshot('export-dialog.png', {
        maxDiffPixels: 300,
      });
    });
  });

  test.describe('Dark Mode Screenshots', () => {
    test('gallery page dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('gallery-dark-mode.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });
  });
});

test.describe('Component Visual Tests', () => {
  test('color palette swatches', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    
    const firstCard = page.locator('[data-testid^="card-style-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstCard.click();
    await page.waitForURL(/\/style\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    const colorPalette = page.locator('[data-testid="color-palette"]');
    if (await colorPalette.isVisible()) {
      await expect(colorPalette).toHaveScreenshot('color-palette.png', {
        maxDiffPixels: 200,
      });
    }
  });

  test('token visualization component', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    
    const firstCard = page.locator('[data-testid^="card-style-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstCard.click();
    await page.waitForURL(/\/style\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    const tokenViz = page.locator('[data-testid="token-visualization"]');
    if (await tokenViz.isVisible()) {
      await expect(tokenViz).toHaveScreenshot('token-visualization.png', {
        maxDiffPixels: 200,
      });
    }
  });
});
