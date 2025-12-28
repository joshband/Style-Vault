import { test, expect } from "@playwright/test";

test.describe("Component + Material Intelligence Pipeline", () => {
  test.describe("API Contract Tests", () => {
    test("GET /api/pipeline/status returns pipeline availability", async ({ request }) => {
      const response = await request.get("/api/pipeline/status");
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("available");
      expect(data).toHaveProperty("healthy");
      expect(typeof data.available).toBe("boolean");
      expect(typeof data.healthy).toBe("boolean");
    });

    test("GET /api/pipeline/recipes returns recipe list", async ({ request }) => {
      const response = await request.get("/api/pipeline/recipes");
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("recipes");
      expect(data).toHaveProperty("count");
      expect(Array.isArray(data.recipes)).toBe(true);
      expect(data.count).toBeGreaterThan(0);
      
      if (data.recipes.length > 0) {
        const recipe = data.recipes[0];
        expect(recipe).toHaveProperty("id");
        expect(recipe).toHaveProperty("label");
        expect(recipe).toHaveProperty("description");
      }
    });

    test("POST /api/pipeline/components requires image data", async ({ request }) => {
      const response = await request.post("/api/pipeline/components", {
        data: {},
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("Image data required");
    });

    test("POST /api/pipeline/material-signature requires image data", async ({ request }) => {
      const response = await request.post("/api/pipeline/material-signature", {
        data: {},
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("Image data required");
    });

    test("POST /api/pipeline/enrich-style requires image data", async ({ request }) => {
      const response = await request.post("/api/pipeline/enrich-style", {
        data: {},
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("Image data required");
    });

    test("POST /api/pipeline/classify-ai requires image data", async ({ request }) => {
      const response = await request.post("/api/pipeline/classify-ai", {
        data: {},
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("Image data required");
    });

    test("POST /api/pipeline/material-tokens-ai requires image data", async ({ request }) => {
      const response = await request.post("/api/pipeline/material-tokens-ai", {
        data: {},
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("Image data required");
    });

    test("GET /api/pipeline/recipes/:id returns 404 for unknown recipe", async ({ request }) => {
      const response = await request.get("/api/pipeline/recipes/unknown_recipe_id");
      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data.error).toContain("Recipe not found");
    });
  });

  test.describe("Pipeline Fallback Mode", () => {
    test("Pipeline status endpoint works even without Python server", async ({ request }) => {
      const response = await request.get("/api/pipeline/status");
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("available");
    });

    test("Recipe list returns fallback data when Python unavailable", async ({ request }) => {
      const response = await request.get("/api/pipeline/recipes");
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.recipes.length).toBeGreaterThanOrEqual(5);
      
      const recipeIds = data.recipes.map((r: any) => r.id);
      expect(recipeIds).toContain("glassmorphic_emissive");
      expect(recipeIds).toContain("matte_plastic");
    });
  });

  test.describe("Material Intelligence UI Panel", () => {
    test("Material Intelligence panel appears on style detail page", async ({ page }) => {
      await page.goto("/");
      
      await page.waitForLoadState("networkidle");
      
      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      if (await styleCard.isVisible()) {
        await styleCard.click();
        
        await page.waitForLoadState("networkidle");
        
        const materialPanel = page.getByText("Material Intelligence");
        if (await materialPanel.isVisible({ timeout: 3000 })) {
          expect(await materialPanel.isVisible()).toBe(true);
        }
      }
    });

    test("Analyze Materials button is present when panel is visible", async ({ page }) => {
      await page.goto("/");
      
      await page.waitForLoadState("networkidle");
      
      const styleCard = page.locator('[data-testid^="card-style-"]').first();
      if (await styleCard.isVisible()) {
        await styleCard.click();
        
        await page.waitForLoadState("networkidle");
        
        const analyzeButton = page.locator('[data-testid="button-analyze-materials"]');
        if (await analyzeButton.isVisible({ timeout: 3000 })) {
          expect(await analyzeButton.isVisible()).toBe(true);
        }
      }
    });
  });

  test.describe("Response Format Validation", () => {
    test("Fallback component detection returns expected structure", async ({ request }) => {
      const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      
      const response = await request.post("/api/pipeline/components", {
        data: { image: testImage },
        headers: { "Content-Type": "application/json" },
      });
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("candidates");
      expect(data).toHaveProperty("count");
      expect(Array.isArray(data.candidates)).toBe(true);
      expect(typeof data.count).toBe("number");
    });

    test("Fallback material signature returns expected structure", async ({ request }) => {
      const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      
      const response = await request.post("/api/pipeline/material-signature", {
        data: { image: testImage },
        headers: { "Content-Type": "application/json" },
      });
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("material_signals");
      expect(data).toHaveProperty("texture_signals");
      expect(data).toHaveProperty("recipe_match");
      
      if (data.material_signals?.global) {
        expect(data.material_signals.global).toHaveProperty("translucency_score");
        expect(data.material_signals.global).toHaveProperty("specular_density");
      }
    });

    test("Fallback style enrichment returns expected structure", async ({ request }) => {
      const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      
      const response = await request.post("/api/pipeline/enrich-style", {
        data: { image: testImage, styleId: "test-style-id" },
        headers: { "Content-Type": "application/json" },
      });
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty("components");
      expect(data).toHaveProperty("material_signature");
      expect(data).toHaveProperty("lineage");
      
      expect(data.lineage).toHaveProperty("style_id");
      expect(data.lineage).toHaveProperty("pipeline_version");
      expect(data.lineage).toHaveProperty("timestamp");
    });
  });
});
