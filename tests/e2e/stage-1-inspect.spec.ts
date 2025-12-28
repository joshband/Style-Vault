import { test, expect } from '@playwright/test';

test.describe('Stage 1: Inspect Read-Only Tests', () => {
  const placeholderStyleId = '22076530-40ae-4ab9-affb-2f5ae80be1a8';

  test.describe('Style Detail Page (when inspect.enabled = true)', () => {
    test('clicking style card should navigate to detail page', async ({ page }) => {
      await page.goto('/');
      
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const closeButton = modal.locator('button').first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        }
      }

      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      await expect(styleCard).toBeVisible({ timeout: 10000 });
      
      await styleCard.click();
      
      await expect(page).toHaveURL(/\/style\/[a-f0-9-]+/);
    });

    test('style detail page should show style name', async ({ page }) => {
      await page.goto(`/style/${placeholderStyleId}`);
      
      await expect(page.getByText('Welcome to Visual DNA')).toBeVisible({ timeout: 10000 });
    });

    test('style detail page should have back navigation', async ({ page }) => {
      await page.goto(`/style/${placeholderStyleId}`);
      
      const backLink = page.locator('a[href="/"], button').filter({ hasText: /back|return|vault/i }).first();
      await expect(backLink).toBeVisible({ timeout: 5000 });
    });

    test('style detail page should show description if available', async ({ page }) => {
      await page.goto(`/style/${placeholderStyleId}`);
      
      await expect(page.getByText(/placeholder style|Style Vault/i)).toBeVisible({ timeout: 5000 });
    });

    test('non-existent style should show error or not found message', async ({ page }) => {
      await page.goto('/style/00000000-0000-0000-0000-000000000000');
      
      await expect(page.getByText(/not found|error|doesn't exist/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Style Card Click Behavior', () => {
    test('style card should be clickable and interactive', async ({ page }) => {
      await page.goto('/');
      
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const closeButton = modal.locator('button').first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        }
      }

      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      await expect(styleCard).toBeVisible({ timeout: 10000 });
      
      const cursor = await styleCard.evaluate(el => window.getComputedStyle(el).cursor);
      expect(cursor).toBe('pointer');
    });
  });

  test.describe('Round-trip Navigation', () => {
    test('can navigate to detail and back to vault', async ({ page }) => {
      await page.goto('/');
      
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const closeButton = modal.locator('button').first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        }
      }

      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      await expect(styleCard).toBeVisible({ timeout: 10000 });
      await styleCard.click();
      
      await expect(page).toHaveURL(/\/style\//);
      
      await page.goBack();
      
      await expect(page).toHaveURL('/');
      await expect(page.locator('h1')).toContainText('Style Vault');
    });
  });
});
