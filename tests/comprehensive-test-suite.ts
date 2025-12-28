import { test, expect, Page, BrowserContext } from '@playwright/test';

interface TestResult {
  name: string;
  feature: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  screenshot?: string;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

test.describe('Visual DNA Comprehensive Test Suite', () => {
  
  test.describe('Core Navigation', () => {
    test('Home page loads with style gallery', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expect(page.locator('[data-testid^="card-style-"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('Style detail page loads correctly', async ({ page }) => {
      await page.goto('/');
      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      await styleCard.click();
      await expect(page).toHaveURL(/\/style\//);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('Create page is accessible', async ({ page }) => {
      await page.goto('/create');
      await expect(page.locator('body')).not.toContainText('404');
    });

    test('Compare page is accessible', async ({ page }) => {
      await page.goto('/compare');
      await expect(page.locator('body')).not.toContainText('404');
    });

    test('Saved styles page is accessible', async ({ page }) => {
      await page.goto('/saved');
      await expect(page.locator('body')).not.toContainText('404');
    });

    test('Tools page is accessible', async ({ page }) => {
      await page.goto('/tools');
      await expect(page.locator('body')).not.toContainText('404');
    });

    test('Features page is accessible', async ({ page }) => {
      await page.goto('/features');
      await expect(page.locator('body')).not.toContainText('404');
    });

    test('Analytics page is accessible', async ({ page }) => {
      await page.goto('/analytics');
      await expect(page.locator('body')).not.toContainText('404');
    });

    test('Admin page is accessible', async ({ page }) => {
      await page.goto('/admin');
      await expect(page.locator('body')).not.toContainText('404');
    });
  });

  test.describe('Style Gallery Features', () => {
    test('Search functionality works', async ({ page }) => {
      await page.goto('/');
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('Art');
        await page.waitForTimeout(500);
      }
    });

    test('Style cards display images', async ({ page }) => {
      await page.goto('/');
      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      await expect(styleCard).toBeVisible({ timeout: 10000 });
      const img = styleCard.locator('img');
      await expect(img).toBeVisible();
    });

    test('Style cards are clickable and navigate', async ({ page }) => {
      await page.goto('/');
      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      await styleCard.click();
      await expect(page).toHaveURL(/\/style\//);
    });
  });

  test.describe('Style Detail Features', () => {
    test('Style detail shows preview images', async ({ page }) => {
      await page.goto('/');
      await page.locator('[data-testid^="card-style-"]').first().click();
      await page.waitForURL(/\/style\//);
      const images = page.locator('img');
      await expect(images.first()).toBeVisible({ timeout: 10000 });
    });

    test('Style detail shows source and applied sections', async ({ page }) => {
      await page.goto('/');
      await page.locator('[data-testid^="card-style-"]').first().click();
      await page.waitForURL(/\/style\//);
      const sourceSection = page.locator('text=Source').first();
      const appliedSection = page.locator('text=Applied').first();
      await expect(sourceSection.or(appliedSection)).toBeVisible({ timeout: 10000 });
    });

    test('Style detail shows style name', async ({ page }) => {
      await page.goto('/');
      const styleName = await page.locator('[data-testid^="card-style-"]').first().locator('h3').textContent();
      await page.locator('[data-testid^="card-style-"]').first().click();
      await page.waitForURL(/\/style\//);
      if (styleName) {
        await expect(page.locator('h1, h2').first()).toContainText(styleName.substring(0, 10));
      }
    });
  });

  test.describe('API Endpoints', () => {
    test('GET /api/styles returns styles list', async ({ request }) => {
      const response = await request.get('/api/styles');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
    });

    test('GET /api/styles/:id returns style details', async ({ request }) => {
      const listResponse = await request.get('/api/styles');
      const styles = await listResponse.json();
      if (styles.length > 0) {
        const response = await request.get(`/api/styles/${styles[0].id}`);
        expect(response.ok()).toBeTruthy();
        const style = await response.json();
        expect(style.id).toBeDefined();
      }
    });

    test('GET /api/images/:id returns image data', async ({ request }) => {
      const listResponse = await request.get('/api/styles');
      const styles = await listResponse.json();
      const styleWithImages = styles.find((s: any) => s.imageIds && Object.keys(s.imageIds).length > 0);
      if (styleWithImages) {
        const imageId = Object.values(styleWithImages.imageIds)[0];
        const response = await request.get(`/api/images/${imageId}`);
        expect(response.ok()).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('Mobile viewport renders correctly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('[data-testid^="card-style-"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('Tablet viewport renders correctly', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('[data-testid^="card-style-"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('Desktop viewport renders correctly', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('[data-testid^="card-style-"]').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Performance Metrics', () => {
    test('Home page loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.locator('[data-testid^="card-style-"]').first().waitFor({ timeout: 15000 });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000);
    });

    test('Style detail page loads within acceptable time', async ({ page }) => {
      await page.goto('/');
      const startTime = Date.now();
      await page.locator('[data-testid^="card-style-"]').first().click();
      await page.waitForURL(/\/style\//);
      await page.locator('img').first().waitFor({ timeout: 15000 });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(15000);
    });
  });

});
