import { test, expect } from '@playwright/test';

test.describe('Stage 4: Design Detail Page (Previews + Design DNA)', () => {
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

    test('should show Design DNA section', async ({ page }) => {
      const designDnaSection = page.locator('[data-testid="section-design-dna"]');
      await expect(designDnaSection).toBeVisible();
    });

    test('should display color palette swatches when Design DNA is expanded', async ({ page }) => {
      const designDnaSection = page.locator('[data-testid="section-design-dna"]');
      await designDnaSection.click();
      const colorPaletteHeading = page.getByText('Color Palette');
      await expect(colorPaletteHeading).toBeVisible();
    });
  });

  test.describe('Dropdown Sections (disabled)', () => {
    test('should NOT show Style Guide section', async ({ page }) => {
      const section = page.locator('[data-testid="section-style-guide"]');
      await expect(section).not.toBeVisible();
    });

    test('should NOT show Usage Notes section', async ({ page }) => {
      const section = page.locator('[data-testid="section-usage-notes"]');
      await expect(section).not.toBeVisible();
    });

    test('should NOT show Explorations/Mood Board section', async ({ page }) => {
      const section = page.locator('[data-testid="section-mood-board"]');
      await expect(section).not.toBeVisible();
    });

    test('should NOT show Revisions section', async ({ page }) => {
      const section = page.locator('[data-testid="section-revisions"]');
      await expect(section).not.toBeVisible();
    });

    test('should NOT show Share & Rate section', async ({ page }) => {
      const section = page.locator('[data-testid="section-share-rate"]');
      await expect(section).not.toBeVisible();
    });
  });

  test.describe('Action Buttons (all disabled)', () => {
    test('should NOT show bookmark button', async ({ page }) => {
      const button = page.locator('[data-testid="button-bookmark"]');
      await expect(button).not.toBeVisible();
    });

    test('should NOT show export tokens button', async ({ page }) => {
      const button = page.locator('[data-testid="button-export-tokens"]');
      await expect(button).not.toBeVisible();
    });

    test('should NOT show brand kit PDF button', async ({ page }) => {
      const button = page.locator('[data-testid="button-pdf-export"]');
      await expect(button).not.toBeVisible();
    });

    test('should NOT show deploy button', async ({ page }) => {
      const button = page.locator('[data-testid="button-deploy-primary"]');
      await expect(button).not.toBeVisible();
    });

    test('should NOT show audit button', async ({ page }) => {
      const button = page.locator('[data-testid="button-audit-primary"]');
      await expect(button).not.toBeVisible();
    });

    test('should NOT show Figma/XD button', async ({ page }) => {
      const button = page.locator('[data-testid="button-design-tools"]');
      await expect(button).not.toBeVisible();
    });

    test('should NOT show remix button', async ({ page }) => {
      const button = page.locator('[data-testid="button-remix-style"]');
      await expect(button).not.toBeVisible();
    });
  });
});
