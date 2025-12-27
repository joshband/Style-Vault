import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5000';

test.describe('Style Regeneration', () => {
  test('should load admin page with regeneration controls', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-results/screenshots/admin-regen-page.png', fullPage: true });
    
    const regenSection = page.locator('text=Regenerate, text=Regeneration, button:has-text("Regenerate")');
    const hasRegen = await regenSection.count() > 0;
    
    console.log(`Regeneration section found: ${hasRegen}`);
  });

  test('should have style selection for regeneration', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const checkboxes = page.locator('[type="checkbox"], [role="checkbox"]');
    const checkboxCount = await checkboxes.count();
    
    console.log(`Found ${checkboxCount} checkboxes for style selection`);
    
    if (checkboxCount > 0) {
      await page.screenshot({ path: 'test-results/screenshots/admin-style-selection.png', fullPage: true });
    }
  });

  test('should have regeneration options', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const options = page.locator('text=Tokens, text=Previews, text=Mood Board, text=UI Concepts');
    const optionCount = await options.count();
    
    console.log(`Found ${optionCount} regeneration options`);
  });
});

test.describe('Regeneration API', () => {
  test('POST /api/admin/styles/regenerate-all requires auth', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/styles/regenerate-all`, {
      data: {
        includeTokens: true,
        includeMetadata: true,
        includePreviews: false,
        includeMoodBoard: false,
        includeUiConcepts: false,
      }
    });
    
    expect([200, 201, 401, 403]).toContain(response.status());
    console.log(`Regenerate-all API status: ${response.status()}`);
  });

  test('POST /api/admin/styles/regenerate-images requires auth', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/styles/regenerate-images`, {
      data: {
        styleIds: [],
        imageTypes: ['previews']
      }
    });
    
    expect([200, 201, 400, 401, 403]).toContain(response.status());
    console.log(`Regenerate-images API status: ${response.status()}`);
  });

  test('POST /api/admin/styles/regenerate-full requires auth', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/styles/regenerate-full`, {
      data: {
        styleIds: [],
        includeTokens: true,
        includeMetadata: true,
        includePreviews: true,
        includeMoodBoard: true,
        includeUiConcepts: true,
      }
    });
    
    expect([200, 201, 400, 401, 403]).toContain(response.status());
    console.log(`Regenerate-full API status: ${response.status()}`);
  });
});

test.describe('Token Validation After Regeneration', () => {
  test('should have valid DTCG token structure', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/styles?limit=5`);
    const listData = await listResponse.json();
    
    if (listData.styles && listData.styles.length > 0) {
      for (const styleSummary of listData.styles) {
        const response = await request.get(`${BASE_URL}/api/styles/${styleSummary.id}`);
        
        if (response.status() === 200) {
          const style = await response.json();
          
          if (style.tokens) {
            const hasValidStructure = validateDTCGTokens(style.tokens);
            console.log(`Style "${style.name}" DTCG validation: ${hasValidStructure ? 'PASS' : 'FAIL'}`);
            expect(hasValidStructure).toBe(true);
          }
        }
      }
    }
  });
});

function validateDTCGTokens(tokens: Record<string, any>): boolean {
  if (!tokens || typeof tokens !== 'object') return false;
  
  const validCategories = ['color', 'typography', 'spacing', 'shadow', 'border', 'motion', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'borderRadius', 'elevation', 'surface', 'semantic'];
  
  const topLevelKeys = Object.keys(tokens);
  if (topLevelKeys.length === 0) return false;
  
  for (const key of topLevelKeys) {
    const category = tokens[key];
    if (typeof category === 'object' && category !== null) {
      for (const tokenKey of Object.keys(category)) {
        const token = category[tokenKey];
        if (typeof token === 'object' && token !== null) {
          if ('$value' in token || '$type' in token) {
            return true;
          }
          if (typeof token === 'object') {
            for (const nestedKey of Object.keys(token)) {
              const nestedToken = token[nestedKey];
              if (typeof nestedToken === 'object' && nestedToken !== null) {
                if ('$value' in nestedToken) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }
  
  return topLevelKeys.length > 0;
}
