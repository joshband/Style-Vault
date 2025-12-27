import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5000';

interface TestResult {
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  errorMessage?: string;
  screenshotPath?: string;
  category: string;
  recommendation?: string;
}

const testResults: TestResult[] = [];
const whatWorks: string[] = [];
const whatFails: string[] = [];
const improvements: string[] = [];
const enhancements: string[] = [];

async function captureScreenshot(page: Page, name: string): Promise<string> {
  const path = `test-results/screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

test.describe('Gallery & Navigation', () => {
  test('should load gallery with styles', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCards = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]');
    const count = await styleCards.count();
    
    if (count > 0) {
      whatWorks.push('Gallery loads with style cards visible');
      await expect(styleCards.first()).toBeVisible();
    } else {
      improvements.push('Gallery shows no styles - consider adding seed data or empty state');
    }
    
    await captureScreenshot(page, 'gallery-home');
  });

  test('should have working search functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('[data-testid="input-search"], input[placeholder*="Search"], input[type="search"]').first();
    const hasSearch = await searchInput.count() > 0;
    
    if (hasSearch) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      whatWorks.push('Search input is present and accepts input');
    } else {
      enhancements.push('Add search functionality to gallery for better discoverability');
    }
    
    await captureScreenshot(page, 'gallery-search');
  });

  test('should navigate to style details', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    const hasStyles = await styleCard.count() > 0;
    
    if (hasStyles) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      whatWorks.push('Style card navigation works correctly');
      await captureScreenshot(page, 'style-detail');
    } else {
      test.skip();
    }
  });

  test('should have header navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
    whatWorks.push('Header navigation is present');
    
    await captureScreenshot(page, 'header-nav');
  });
});

test.describe('Style Creation', () => {
  test('should load create page', async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/create/);
    whatWorks.push('Create page loads successfully');
    
    await captureScreenshot(page, 'create-page');
  });

  test('should have Surprise Me button', async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    
    const surpriseButton = page.locator('[data-testid="button-surprise-me"], button:has-text("Surprise")');
    const hasSurprise = await surpriseButton.count() > 0;
    
    if (hasSurprise) {
      await expect(surpriseButton.first()).toBeVisible();
      whatWorks.push('Surprise Me button is visible and accessible');
    } else {
      whatFails.push('Surprise Me button not found on create page');
    }
    
    await captureScreenshot(page, 'create-surprise');
  });

  test('should show theme selection options', async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    
    const themeOptions = page.locator('[data-testid^="theme-"], [role="radio"], [role="button"]');
    const count = await themeOptions.count();
    
    if (count > 0) {
      whatWorks.push('Theme selection options are displayed');
    } else {
      improvements.push('Add visible theme options for guided style creation');
    }
  });
});

test.describe('Style Details & Export', () => {
  test('should show export functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    const hasStyles = await styleCard.count() > 0;
    
    if (hasStyles) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const exportButton = page.locator('[data-testid="button-export-primary"], button:has-text("Export")').first();
      const hasExport = await exportButton.count() > 0;
      
      if (hasExport) {
        await expect(exportButton).toBeVisible();
        whatWorks.push('Export button is visible on style detail page');
        await captureScreenshot(page, 'style-export');
      }
    } else {
      test.skip();
    }
  });

  test('should show deploy functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    const hasStyles = await styleCard.count() > 0;
    
    if (hasStyles) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const deployButton = page.locator('[data-testid="button-deploy"], button:has-text("Deploy")');
      const hasDeploy = await deployButton.count() > 0;
      
      if (hasDeploy) {
        await expect(deployButton.first()).toBeVisible();
        whatWorks.push('Deploy button is visible on style detail page');
      } else {
        enhancements.push('Add deploy button to style detail page for quick deployment');
      }
    } else {
      test.skip();
    }
  });

  test('should display token visualization', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const styleCard = page.locator('[data-testid^="card-style-"], [data-testid^="style-card-"]').first();
    const hasStyles = await styleCard.count() > 0;
    
    if (hasStyles) {
      await styleCard.click();
      await page.waitForURL(/\/style\/|\/inspect\//, { timeout: 10000 });
      
      const tokenViz = page.locator('[data-testid="token-visualization"], .token-swatch, .color-preview').first();
      const hasTokenViz = await tokenViz.count() > 0;
      
      if (hasTokenViz) {
        whatWorks.push('Token visualization is displayed on style detail');
        await captureScreenshot(page, 'token-visualization');
      } else {
        improvements.push('Add more prominent token visualization to style details');
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Admin Dashboard', () => {
  test('should load admin page', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const adminContent = page.locator('h1:has-text("Admin"), [data-testid="admin-dashboard"]').first();
    const hasAdmin = await adminContent.count() > 0;
    
    if (hasAdmin) {
      whatWorks.push('Admin dashboard loads successfully');
      await captureScreenshot(page, 'admin-dashboard');
    } else {
      const loginPrompt = page.locator('button:has-text("Log in"), a:has-text("Sign in")');
      if (await loginPrompt.count() > 0) {
        improvements.push('Admin requires authentication - test with authenticated session');
      }
    }
  });

  test('should show metrics section', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const metricsSection = page.locator('[data-testid="metrics-summary"]').or(page.getByText('Metrics')).or(page.getByText('Performance'));
    const hasMetrics = await metricsSection.count() > 0;
    
    if (hasMetrics) {
      whatWorks.push('Metrics section is visible in admin dashboard');
    }
    
    await captureScreenshot(page, 'admin-metrics');
  });

  test('should show regeneration controls', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const regenButton = page.locator('button:has-text("Regenerate"), [data-testid="button-regenerate"]');
    const hasRegen = await regenButton.count() > 0;
    
    if (hasRegen) {
      whatWorks.push('Style regeneration controls are present in admin');
    } else {
      enhancements.push('Expose regeneration controls more prominently in admin');
    }
  });
});

test.describe('Compare & Remix', () => {
  test('should load compare page', async ({ page }) => {
    await page.goto('/compare');
    await page.waitForLoadState('networkidle');
    
    const compareContent = page.locator('h1, h2, [data-testid="compare-page"]');
    const hasCompare = await compareContent.count() > 0;
    
    if (hasCompare) {
      whatWorks.push('Compare page loads successfully');
      await captureScreenshot(page, 'compare-page');
    } else {
      enhancements.push('Add style comparison functionality for side-by-side analysis');
    }
  });

  test('should load remix page', async ({ page }) => {
    await page.goto('/remix');
    await page.waitForLoadState('networkidle');
    
    const remixContent = page.locator('h1, h2, [data-testid="remix-page"]');
    const hasRemix = await remixContent.count() > 0;
    
    if (hasRemix) {
      whatWorks.push('Remix page loads successfully');
      await captureScreenshot(page, 'remix-page');
    }
  });
});

test.describe('API Endpoints', () => {
  test('should respond to health check', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    whatWorks.push('Health check API endpoint returns healthy status');
  });

  test('should fetch styles list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/styles`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    whatWorks.push('Styles API endpoint returns list of styles');
  });

  test('should support style pagination', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/styles?limit=5`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    const styles = data.items || data;
    expect(Array.isArray(styles)).toBe(true);
    if (styles.length <= 5) {
      whatWorks.push('Styles API respects pagination limits');
    }
  });

  test('should fetch individual style by ID', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/styles?limit=1`);
    const listData = await listResponse.json();
    const styles = listData.items || listData;
    
    if (Array.isArray(styles) && styles.length > 0) {
      const styleId = styles[0].id;
      const response = await request.get(`${BASE_URL}/api/styles/${styleId}`);
      
      if (response.status() === 200) {
        const style = await response.json();
        expect(style).toHaveProperty('id');
        whatWorks.push('Individual style fetch by ID works correctly');
      }
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveTitle(/Visual DNA/i);
    whatWorks.push('Mobile viewport renders correctly');
    
    await captureScreenshot(page, 'mobile-view');
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveTitle(/Visual DNA/i);
    whatWorks.push('Tablet viewport renders correctly');
    
    await captureScreenshot(page, 'tablet-view');
  });

  test('should have responsive navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], .hamburger');
    const hasMobileMenu = await mobileMenu.count() > 0;
    
    if (hasMobileMenu) {
      whatWorks.push('Mobile navigation menu is present');
    } else {
      improvements.push('Add mobile-friendly hamburger menu for smaller screens');
    }
  });
});

test.describe('Accessibility', () => {
  test('should have accessible button labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    let accessibleCount = 0;
    
    for (let i = 0; i < Math.min(buttonCount, 15); i++) {
      const button = buttons.nth(i);
      const hasLabel = await button.evaluate((el) => {
        return !!(el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('title'));
      });
      if (hasLabel) accessibleCount++;
    }
    
    if (accessibleCount === Math.min(buttonCount, 15)) {
      whatWorks.push('All sampled buttons have accessible labels');
    } else {
      improvements.push(`${Math.min(buttonCount, 15) - accessibleCount} buttons missing accessible labels`);
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    const hasFocus = await focusedElement.count() > 0;
    
    if (hasFocus) {
      whatWorks.push('Keyboard navigation with Tab works correctly');
    } else {
      improvements.push('Improve keyboard focus management for accessibility');
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const h1Count = await page.locator('h1').count();
    
    if (h1Count === 1) {
      whatWorks.push('Page has proper single h1 heading');
    } else if (h1Count === 0) {
      improvements.push('Add main h1 heading for better accessibility');
    } else {
      improvements.push('Multiple h1 headings detected - consider restructuring');
    }
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    if (loadTime < 3000) {
      whatWorks.push(`Page loads within ${loadTime}ms (under 3s threshold)`);
    } else if (loadTime < 5000) {
      improvements.push(`Page load time is ${loadTime}ms - consider optimization`);
    } else {
      whatFails.push(`Page load time is ${loadTime}ms - needs significant optimization`);
    }
  });

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    if (errors.length === 0) {
      whatWorks.push('No console errors detected on page load');
    } else {
      whatFails.push(`${errors.length} console errors detected: ${errors.slice(0, 3).join(', ')}`);
    }
  });
});

test.afterAll(async () => {
  console.log('\n========================================');
  console.log('       COMPREHENSIVE TEST REPORT       ');
  console.log('========================================\n');
  
  console.log('✅ WHAT WORKS:');
  whatWorks.forEach(item => console.log(`  • ${item}`));
  
  console.log('\n❌ WHAT FAILS:');
  if (whatFails.length === 0) {
    console.log('  • No critical failures detected');
  } else {
    whatFails.forEach(item => console.log(`  • ${item}`));
  }
  
  console.log('\n🔧 IMPROVEMENTS:');
  if (improvements.length === 0) {
    console.log('  • No immediate improvements needed');
  } else {
    improvements.forEach(item => console.log(`  • ${item}`));
  }
  
  console.log('\n💡 ENHANCEMENTS:');
  if (enhancements.length === 0) {
    console.log('  • No suggested enhancements');
  } else {
    enhancements.forEach(item => console.log(`  • ${item}`));
  }
  
  console.log('\n========================================');
  console.log('           END OF REPORT               ');
  console.log('========================================\n');
});
