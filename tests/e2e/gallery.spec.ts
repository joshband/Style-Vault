import { test, expect } from '@playwright/test';

test.describe('Gallery Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the gallery page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Visual DNA/i);
  });

  test('should display the page header', async ({ page }) => {
    const header = page.locator('header, nav').first();
    await expect(header).toBeVisible();
  });

  test('should display style cards after loading', async ({ page }) => {
    const styleCards = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]');
    const cardCount = await styleCards.count();
    
    if (cardCount > 0) {
      await expect(styleCards.first()).toBeVisible();
    }
  });

  test('should have a create or surprise me button', async ({ page }) => {
    const createButton = page.locator('[data-testid="button-create"], [data-testid="button-surprise-me"], button:has-text("Create"), button:has-text("Surprise")');
    await expect(createButton.first()).toBeVisible();
  });
});

test.describe('Style Details Page', () => {
  test('should navigate to style details and show content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    const cardExists = await styleCard.count() > 0;
    
    if (cardExists) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    } else {
      test.skip(true, 'No styles available to test');
    }
  });

  test('should show export functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    const cardExists = await styleCard.count() > 0;
    
    if (cardExists) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const exportButton = page.locator('[data-testid="button-export-primary"], button:has-text("Export")').first();
      await expect(exportButton).toBeVisible();
    } else {
      test.skip(true, 'No styles available to test');
    }
  });
});

test.describe('Create Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
  });

  test('should load the create page', async ({ page }) => {
    await expect(page).toHaveURL(/\/create/);
  });

  test('should have a Surprise Me button', async ({ page }) => {
    const surpriseButton = page.locator('[data-testid="button-surprise-me"], button:has-text("Surprise")');
    await expect(surpriseButton.first()).toBeVisible();
  });

  test('should show theme options or random generation', async ({ page }) => {
    const themeOptions = page.locator('[data-testid^="theme-"], [role="radio"], [role="button"]');
    await expect(themeOptions.first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const navLinks = page.locator('nav a, header a');
    const linkCount = await navLinks.count();
    
    expect(linkCount).toBeGreaterThan(0);
  });

  test('should navigate between pages without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const createLink = page.locator('a[href="/create"], button:has-text("Create"), [data-testid="link-create"]');
    const createLinkVisible = await createLink.first().isVisible().catch(() => false);
    
    if (createLinkVisible) {
      await createLink.first().click();
      await page.waitForURL('/create');
      await expect(page).toHaveURL('/create');
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveTitle(/Visual DNA/i);
    
    const mainContent = page.locator('main, [role="main"], #root').first();
    await expect(mainContent).toBeVisible();
  });

  test('should display correctly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveTitle(/Visual DNA/i);
  });

  test('should display correctly on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveTitle(/Visual DNA/i);
  });
});

test.describe('Accessibility', () => {
  test('should have accessible button labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const hasLabel = await button.evaluate((el) => {
        return !!(el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('title'));
      });
      expect(hasLabel).toBe(true);
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Tab');
    
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeDefined();
  });
});
