import { test, expect } from '@playwright/test';

test.describe('Stage 4B: Advanced Inspect Features (Mood Board, UI Concepts, Materials)', () => {
  const styleId = '1';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/style/${styleId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Mood Board Feature (gated by moodboard.enabled flag)', () => {
    test('should show mood board section when flag is enabled', async ({ page }) => {
      const moodBoardSection = page.locator('[data-testid="section-mood-board"]');
      await expect(moodBoardSection).toBeVisible();
    });
  });

  test.describe('UI Concepts Feature (gated by uiconcepts.enabled flag)', () => {
    test('should show UI concepts in the visual trust strip', async ({ page }) => {
      const uiConceptSection = page.locator('[data-testid="section-ui-concepts"]');
      await expect(uiConceptSection).toBeVisible();
    });
  });

  test.describe('Materials Intelligence Feature (gated by materials.enabled flag)', () => {
    test('should show materials section when Design DNA is expanded', async ({ page }) => {
      const designDnaSection = page.locator('details summary').filter({ hasText: 'Design DNA' });
      await designDnaSection.click();
      await page.waitForTimeout(500);
      
      const materialsSection = page.locator('[data-testid="section-materials"]');
      await expect(materialsSection).toBeVisible();
    });
  });
});
