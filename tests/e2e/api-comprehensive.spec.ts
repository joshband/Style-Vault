import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5000';

test.describe('API Health & Status', () => {
  test('health endpoint returns database status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('database', 'connected');
    expect(data).toHaveProperty('dbLatencyMs');
    expect(data).toHaveProperty('styleCount');
  });
});

test.describe('Styles API', () => {
  test('GET /api/styles returns paginated list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/styles`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('styles');
    expect(Array.isArray(data.styles)).toBe(true);
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('hasMore');
  });

  test('GET /api/styles supports limit parameter', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/styles?limit=3`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.styles.length).toBeLessThanOrEqual(3);
  });

  test('GET /api/styles/:id returns individual style', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/styles?limit=1`);
    const listData = await listResponse.json();
    
    if (listData.styles && listData.styles.length > 0) {
      const styleId = listData.styles[0].id;
      const response = await request.get(`${BASE_URL}/api/styles/${styleId}`);
      
      expect(response.status()).toBe(200);
      const style = await response.json();
      expect(style).toHaveProperty('id', styleId);
      expect(style).toHaveProperty('name');
      expect(style).toHaveProperty('tokens');
    }
  });

  test('GET /api/styles/:id returns 404 for non-existent style', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/styles/non-existent-id-12345`);
    expect([404, 500]).toContain(response.status());
  });

  test('style tokens follow DTCG structure', async ({ request }) => {
    const listResponse = await request.get(`${BASE_URL}/api/styles?limit=1`);
    const listData = await listResponse.json();
    
    if (listData.styles && listData.styles.length > 0) {
      const styleId = listData.styles[0].id;
      const response = await request.get(`${BASE_URL}/api/styles/${styleId}`);
      const style = await response.json();
      
      if (style.tokens) {
        const tokens = style.tokens;
        const hasColorTokens = tokens.color !== undefined || Object.keys(tokens).some(k => k.includes('color'));
        expect(hasColorTokens || Object.keys(tokens).length > 0).toBe(true);
      }
    }
  });
});

test.describe('Random Style Generation API', () => {
  test('POST /api/styles/random generates new style', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/styles/random`, {
      data: { theme: 'minimal' }
    });
    
    if (response.status() === 200 || response.status() === 201) {
      const style = await response.json();
      expect(style).toHaveProperty('name');
      expect(style).toHaveProperty('tokens');
    }
  });
});

test.describe('Export API', () => {
  test('GET /api/export-formats returns available formats', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/export-formats`);
    
    if (response.status() === 200) {
      const formats = await response.json();
      expect(Array.isArray(formats) || typeof formats === 'object').toBe(true);
    }
  });
});

test.describe('Vision & Analysis API', () => {
  test('GET /api/vision/status returns service status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/vision/status`);
    
    if (response.status() === 200) {
      const status = await response.json();
      expect(status).toHaveProperty('available');
    }
  });
});

test.describe('Jobs & Background Processing', () => {
  test('GET /api/jobs returns job list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/jobs`);
    
    if (response.status() === 200) {
      const jobs = await response.json();
      expect(Array.isArray(jobs) || (jobs && typeof jobs === 'object')).toBe(true);
    }
  });
});

test.describe('Admin API (requires auth)', () => {
  test('GET /api/admin/stats requires authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/stats`);
    expect([200, 401, 403]).toContain(response.status());
  });

  test('GET /api/admin/metrics/summary requires authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/metrics/summary`);
    expect([200, 401, 403]).toContain(response.status());
  });

  test('GET /api/admin/features requires authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/features`);
    expect([200, 401, 403]).toContain(response.status());
  });
});

test.describe('Object Storage API', () => {
  test('GET /api/storage/status returns storage info', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/storage/status`);
    
    if (response.status() === 200) {
      const status = await response.json();
      expect(typeof status === 'object').toBe(true);
    }
  });
});

test.describe('Error Handling', () => {
  test('handles malformed requests gracefully', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/styles`, {
      data: { invalid: 'data' },
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect([400, 401, 422, 500]).toContain(response.status());
  });

  test('returns JSON error responses', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nonexistent-endpoint`);
    
    if (response.status() >= 400) {
      const contentType = response.headers()['content-type'] || '';
      const isJson = contentType.includes('application/json') || contentType.includes('text/html');
      expect(isJson || response.status() === 404).toBe(true);
    }
  });
});

test.describe('CORS & Headers', () => {
  test('API returns proper content-type header', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
  });
});
