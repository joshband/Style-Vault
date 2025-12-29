import { test, expect } from '@playwright/test';

test.describe('Stage 3: Basic Design Detail Page (Read-Only Display)', () => {
  const styleId = '22076530-40ae-4ab9-affb-2f5ae80be1a8';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/style/${styleId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Core Display Features (enabled)', () => {
    test('should show style name and description', async ({ page }) => {
      const styleName = page.locator('[data-testid="style-name"]');
      await expect(styleName).toBeVisible();
      await expect(styleName).toContainText('Retro Industrial Audio');
    });

    test('should show canonical previews section', async ({ page }) => {
      const previewsSection = page.locator('[data-testid="section-canonical-previews"]');
      await expect(previewsSection).toBeVisible();
    });

    test('should show Design DNA section with tokens', async ({ page }) => {
      const designDnaSection = page.locator('details summary').filter({ hasText: 'Design DNA' });
      await expect(designDnaSection).toBeVisible();
    });
  });

  test.describe('Action Buttons (disabled in Stage 3)', () => {
    test('should NOT show bookmark button', async ({ page }) => {
      const bookmarkButton = page.locator('[data-testid="button-bookmark"]');
      await expect(bookmarkButton).not.toBeVisible();
    });

    test('should NOT show export tokens button', async ({ page }) => {
      const exportButton = page.locator('[data-testid="button-export-tokens"]');
      await expect(exportButton).not.toBeVisible();
    });

    test('should NOT show brand kit PDF button', async ({ page }) => {
      const pdfButton = page.locator('[data-testid="button-pdf-export"]');
      await expect(pdfButton).not.toBeVisible();
    });

    test('should NOT show deploy button', async ({ page }) => {
      const deployButton = page.locator('[data-testid="button-deploy-primary"]');
      await expect(deployButton).not.toBeVisible();
    });

    test('should NOT show audit button', async ({ page }) => {
      const auditButton = page.locator('[data-testid="button-audit-primary"]');
      await expect(auditButton).not.toBeVisible();
    });

    test('should NOT show Figma/XD button', async ({ page }) => {
      const designToolsButton = page.locator('[data-testid="button-design-tools"]');
      await expect(designToolsButton).not.toBeVisible();
    });

    test('should NOT show remix button', async ({ page }) => {
      const remixButton = page.locator('[data-testid="button-remix-style"]');
      await expect(remixButton).not.toBeVisible();
    });
  });

  test.describe('Advanced Sections (disabled in Stage 3)', () => {
    test('should NOT show mood board section', async ({ page }) => {
      const moodBoardSection = page.locator('[data-testid="section-mood-board"]');
      await expect(moodBoardSection).not.toBeVisible();
    });

    test('should NOT show materials section when Design DNA is expanded', async ({ page }) => {
      const designDnaSection = page.locator('details summary').filter({ hasText: 'Design DNA' });
      await designDnaSection.click();
      await page.waitForTimeout(500);
      
      const materialsSection = page.locator('[data-testid="section-materials"]');
      await expect(materialsSection).not.toBeVisible();
    });
  });
});
