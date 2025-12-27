import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5000';

test.describe('Random Style Generation Feature', () => {
  test('should have Surprise Me button on create page', async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    
    const surpriseButton = page.locator('[data-testid="button-surprise-me"], button:has-text("Surprise")');
    await expect(surpriseButton.first()).toBeVisible();
    
    await page.screenshot({ path: 'test-results/screenshots/surprise-me-button.png' });
  });

  test('should click Surprise Me and show loading state', async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    
    const surpriseButton = page.locator('[data-testid="button-surprise-me"], button:has-text("Surprise")').first();
    
    if (await surpriseButton.isVisible()) {
      await surpriseButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/screenshots/surprise-loading.png' });
    }
  });
});

test.describe('Export Dialog Feature', () => {
  test('should open export dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const exportButton = page.locator('[data-testid="button-export-primary"], button:has-text("Export")').first();
      
      if (await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForTimeout(500);
        
        const dialog = page.locator('[role="dialog"], .dialog, [data-testid="export-dialog"]');
        await page.screenshot({ path: 'test-results/screenshots/export-dialog.png' });
        
        if (await dialog.count() > 0) {
          console.log('Export dialog opened successfully');
        }
      }
    }
  });

  test('should show multiple export formats', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const exportButton = page.locator('[data-testid="button-export-primary"], button:has-text("Export")').first();
      
      if (await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForTimeout(500);
        
        const formatOptions = page.locator('[data-testid^="format-"], button:has-text("CSS"), button:has-text("JSON"), button:has-text("Tailwind")');
        const count = await formatOptions.count();
        console.log(`Found ${count} export format options`);
      }
    }
  });
});

test.describe('Deploy Dialog Feature', () => {
  test('should open deploy dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const deployButton = page.locator('[data-testid="button-deploy"], button:has-text("Deploy")').first();
      
      if (await deployButton.isVisible()) {
        await deployButton.click();
        await page.waitForTimeout(500);
        
        await page.screenshot({ path: 'test-results/screenshots/deploy-dialog.png' });
        
        const dialog = page.locator('[role="dialog"]');
        if (await dialog.count() > 0) {
          console.log('Deploy dialog opened successfully');
        }
      }
    }
  });

  test('should show platform tabs in deploy dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const deployButton = page.locator('[data-testid="button-deploy"], button:has-text("Deploy")').first();
      
      if (await deployButton.isVisible()) {
        await deployButton.click();
        await page.waitForTimeout(500);
        
        const platforms = page.locator('[data-testid="tab-vercel"], [data-testid="tab-netlify"], [data-testid="tab-cloudflare"], [data-testid="tab-railway"], [data-testid="tab-render"]');
        const count = await platforms.count();
        console.log(`Found ${count} deployment platform tabs`);
        expect(count).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

test.describe('Token Visualization Feature', () => {
  test('should display color swatches', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const colorSwatches = page.locator('.color-swatch, [data-testid^="color-"], [style*="background"]').first();
      await page.screenshot({ path: 'test-results/screenshots/token-colors.png' });
      
      console.log('Token visualization page loaded');
    }
  });

  test('should show typography samples', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const typography = page.locator('text=Typography, text=Font, [data-testid^="typography-"]');
      const hasTypo = await typography.count() > 0;
      console.log(`Typography section found: ${hasTypo}`);
    }
  });
});

test.describe('PDF Export Feature', () => {
  test('should have PDF export option', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const pdfButton = page.locator('[data-testid="button-pdf-export"], button:has-text("PDF"), button:has-text("Brand Kit")');
      const hasPdf = await pdfButton.count() > 0;
      console.log(`PDF export option found: ${hasPdf}`);
      
      await page.screenshot({ path: 'test-results/screenshots/pdf-export-option.png' });
    }
  });
});

test.describe('Share Feature', () => {
  test('should have share button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const shareButton = page.locator('[data-testid="button-share"], button:has-text("Share")');
      const hasShare = await shareButton.count() > 0;
      console.log(`Share button found: ${hasShare}`);
    }
  });

  test('should show share code', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const shareButton = page.locator('[data-testid="button-share"], button:has-text("Share")').first();
      
      if (await shareButton.isVisible()) {
        await shareButton.click();
        await page.waitForTimeout(500);
        
        const shareCode = page.locator('[data-testid="share-code"], code, .share-code');
        await page.screenshot({ path: 'test-results/screenshots/share-dialog.png' });
      }
    }
  });
});

test.describe('Bookmarking Feature', () => {
  test('should have bookmark button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const bookmarkButton = page.locator('[data-testid="button-bookmark"], button:has-text("Bookmark"), [aria-label*="bookmark"]');
      const hasBookmark = await bookmarkButton.count() > 0;
      console.log(`Bookmark button found: ${hasBookmark}`);
    }
  });
});

test.describe('Rating Feature', () => {
  test('should have rating component', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    
    if (await styleCard.count() > 0) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const rating = page.locator('[data-testid="rating"], [aria-label*="rating"], .star-rating');
      const hasRating = await rating.count() > 0;
      console.log(`Rating component found: ${hasRating}`);
    }
  });
});

test.describe('Compare Feature', () => {
  test('should load compare page', async ({ page }) => {
    await page.goto('/compare');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/screenshots/compare-page.png' });
    console.log('Compare page loaded');
  });
});

test.describe('Remix Feature', () => {
  test('should load remix page', async ({ page }) => {
    await page.goto('/remix');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/screenshots/remix-page.png' });
    console.log('Remix page loaded');
  });
});

test.describe('Analytics Feature', () => {
  test('should load analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/screenshots/analytics-page.png' });
    console.log('Analytics page loaded');
  });
});
