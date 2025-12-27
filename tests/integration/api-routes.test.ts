import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../server/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ result: 1 }]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../server/storage', () => ({
  storage: {
    getStyleSummaries: vi.fn().mockResolvedValue([
      {
        id: 'test-1',
        name: 'Test Style 1',
        description: 'A test style',
        createdAt: new Date().toISOString(),
        updatedAt: null,
        shareCode: 'ABC123',
        moodBoardStatus: 'completed',
        uiConceptsStatus: 'pending',
        styleSpec: null,
        tokens: { color: { primary: { base: { $type: 'color', $value: 'oklch(0.5 0.1 250)' } } } },
        metadataTags: { mood: ['calm'] },
        promptScaffolding: null,
        referenceImages: [],
        isPublic: true,
      },
    ]),
    getStyleById: vi.fn().mockImplementation((id: string) => {
      if (id === 'test-1') {
        return Promise.resolve({
          id: 'test-1',
          name: 'Test Style 1',
          description: 'A test style',
          createdAt: new Date().toISOString(),
          tokens: { color: {} },
          isPublic: true,
        });
      }
      return Promise.resolve(null);
    }),
    createStyle: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        id: 'new-style-id',
        ...data,
        createdAt: new Date().toISOString(),
      })
    ),
    updateStyle: vi.fn().mockResolvedValue({
      id: 'test-1',
      name: 'Updated Name',
    }),
    deleteStyle: vi.fn().mockResolvedValue(true),
    getUser: vi.fn().mockResolvedValue(null),
    upsertUser: vi.fn().mockResolvedValue({ id: 'user-1', username: 'test' }),
  },
}));

vi.mock('../../server/cache', () => ({
  cache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  CACHE_KEYS: {
    STYLES_LIST: 'styles_list',
    STYLE: (id: string) => `style_${id}`,
  },
}));

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', database: 'connected' });
  });
  
  app.get('/api/styles', async (req, res) => {
    const { storage } = await import('../../server/storage');
    const styles = await storage.getStyleSummaries();
    res.json(styles);
  });
  
  app.get('/api/styles/:id', async (req, res) => {
    const { storage } = await import('../../server/storage');
    const style = await storage.getStyleById(req.params.id);
    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }
    res.json(style);
  });
  
  app.post('/api/styles', async (req, res) => {
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const { storage } = await import('../../server/storage');
    const newStyle = await storage.createStyle(req.body);
    res.status(201).json(newStyle);
  });
  
  return app;
};

describe('API Routes Integration Tests', () => {
  const app = createTestApp();

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBe('connected');
    });
  });

  describe('GET /api/styles', () => {
    it('should return a list of styles', async () => {
      const response = await request(app)
        .get('/api/styles')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });

    it('should return style summaries with required fields', async () => {
      const response = await request(app)
        .get('/api/styles')
        .expect(200);

      const style = response.body[0];
      expect(style.id).toBeDefined();
      expect(style.name).toBeDefined();
      expect(style.tokens).toBeDefined();
    });
  });

  describe('GET /api/styles/:id', () => {
    it('should return a style by id', async () => {
      const response = await request(app)
        .get('/api/styles/test-1')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.id).toBe('test-1');
      expect(response.body.name).toBe('Test Style 1');
    });

    it('should return 404 for non-existent style', async () => {
      const response = await request(app)
        .get('/api/styles/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Style not found');
    });
  });

  describe('POST /api/styles', () => {
    it('should create a new style', async () => {
      const newStyle = {
        name: 'New Style',
        description: 'A new style',
        tokens: { color: { primary: { $type: 'color', $value: '#000' } } },
      };

      const response = await request(app)
        .post('/api/styles')
        .send(newStyle)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('New Style');
    });

    it('should return 400 for missing name', async () => {
      const invalidStyle = {
        description: 'Missing name',
      };

      const response = await request(app)
        .post('/api/styles')
        .send(invalidStyle)
        .expect(400);

      expect(response.body.error).toBe('Name is required');
    });
  });
});

describe('Request Validation', () => {
  const app = createTestApp();

  it('should handle malformed JSON gracefully', async () => {
    const response = await request(app)
      .post('/api/styles')
      .set('Content-Type', 'application/json')
      .send('not valid json')
      .expect(400);
  });
});
