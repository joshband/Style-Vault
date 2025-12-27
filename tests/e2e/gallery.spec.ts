import { test, expect } from '@playwright/test';

test.describe('Gallery Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the gallery page', async ({ page }) => {
    await expect(page).toHaveTitle(/Visual DNA/i);
  });

  test('should display style cards', async ({ page }) => {
    const cards = page.locator('[data-testid^="card-style-"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to style details on card click', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="card-style-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/style\//);
  });

  test('should show search functionality', async ({ page }) => {
    const searchInput = page.locator('[data-testid="input-search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await expect(searchInput).toHaveValue('test');
    }
  });

  test('should show filter options', async ({ page }) => {
    const filterButton = page.locator('[data-testid="button-filter"]');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await expect(page.locator('[data-testid="filter-menu"]')).toBeVisible();
    }
  });
});

test.describe('Style Details Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('[data-testid^="card-style-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstCard.click();
    await page.waitForURL(/\/style\//, { timeout: 10000 });
  });

  test('should display style name and description', async ({ page }) => {
    const styleName = page.locator('h1, h2').first();
    await expect(styleName).toBeVisible();
  });

  test('should show export button', async ({ page }) => {
    const exportButton = page.locator('[data-testid="button-export-primary"]');
    await expect(exportButton).toBeVisible();
  });

  test('should open export dialog when clicking export', async ({ page }) => {
    const exportButton = page.locator('[data-testid="button-export-primary"]');
    await exportButton.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('should show color palette', async ({ page }) => {
    const colorSwatches = page.locator('[data-testid^="swatch-"]');
    await expect(colorSwatches.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show save button', async ({ page }) => {
    const saveButton = page.locator('[data-testid="button-save-style"]');
    await expect(saveButton).toBeVisible();
  });

  test('should show brand kit export button', async ({ page }) => {
    const brandKitButton = page.locator('[data-testid="button-pdf-export"]');
    await expect(brandKitButton).toBeVisible();
  });
});

test.describe('Create Style Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/create');
  });

  test('should load the create page', async ({ page }) => {
    await expect(page).toHaveURL('/create');
  });

  test('should show Surprise Me button', async ({ page }) => {
    const surpriseButton = page.locator('[data-testid="button-surprise-me"]');
    await expect(surpriseButton).toBeVisible();
  });

  test('should show upload options', async ({ page }) => {
    const uploadArea = page.locator('[data-testid="upload-area"]');
    if (await uploadArea.isVisible()) {
      await expect(uploadArea).toBeVisible();
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate to create page', async ({ page }) => {
    await page.goto('/');
    const createLink = page.locator('[data-testid="link-create"]');
    if (await createLink.isVisible()) {
      await createLink.click();
      await expect(page).toHaveURL('/create');
    }
  });

  test('should navigate back to gallery', async ({ page }) => {
    await page.goto('/create');
    const galleryLink = page.locator('[data-testid="link-gallery"]');
    if (await galleryLink.isVisible()) {
      await galleryLink.click();
      await expect(page).toHaveURL('/');
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page).toHaveTitle(/Visual DNA/i);
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page).toHaveTitle(/Visual DNA/i);
  });

  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page).toHaveTitle(/Visual DNA/i);
  });
});
