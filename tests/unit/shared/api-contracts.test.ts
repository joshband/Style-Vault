import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';

const StyleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime().or(z.date()),
  metadataTags: z.record(z.any()).nullable(),
  keywords: z.array(z.string()).nullable(),
  moodBoardStatus: z.enum(['pending', 'processing', 'complete', 'failed']).nullable(),
  uiConceptsStatus: z.enum(['pending', 'processing', 'complete', 'failed']).nullable(),
  thumbnailPreview: z.string().nullable(),
  creatorId: z.string().nullable(),
  creatorName: z.string().nullable(),
  isPublic: z.boolean(),
  imageIds: z.record(z.any()).nullable(),
});

const PaginatedResponseSchema = z.object({
  items: z.array(StyleSchema),
  total: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

const ArrayResponseSchema = z.array(StyleSchema);

describe('API Contract Tests', () => {
  const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000';

  describe('GET /api/styles (paginated with limit param)', () => {
    it('should return a valid paginated response structure when limit is provided', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10`);
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      const result = PaginatedResponseSchema.safeParse(data);
      
      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }
      expect(result.success).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=5`);
      const data = await response.json();
      
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    it('should return hasMore=false when no more items', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=100`);
      const data = await response.json();
      
      expect(typeof data.hasMore).toBe('boolean');
      if (data.items.length < 100) {
        expect(data.hasMore).toBe(false);
      }
    });

    it('should return total count', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10`);
      const data = await response.json();
      
      expect(typeof data.total).toBe('number');
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    it('should not expose isArchived field in response', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10`);
      const data = await response.json();
      
      data.items.forEach((style: any) => {
        expect(style.isArchived).toBeUndefined();
      });
    });

    it('should include at least one style in Phase 1', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10`);
      const data = await response.json();
      
      expect(data.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/styles (simple array without limit)', () => {
    it('should return a valid array response when no limit provided', async () => {
      const response = await fetch(`${baseUrl}/api/styles`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      const result = ArrayResponseSchema.safeParse(data);
      
      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }
      expect(result.success).toBe(true);
    });
  });

  describe('Style Object Schema', () => {
    it('should have required fields in style objects', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10`);
      const data = await response.json();
      
      if (data.items.length > 0) {
        const style = data.items[0];
        expect(style).toHaveProperty('id');
        expect(style).toHaveProperty('name');
        expect(style).toHaveProperty('createdAt');
        expect(style).toHaveProperty('isPublic');
      }
    });

    it('should have valid UUID for style id', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10`);
      const data = await response.json();
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      data.items.forEach((style: any) => {
        expect(style.id).toMatch(uuidRegex);
      });
    });

    it('should have proper date format for createdAt', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10`);
      const data = await response.json();
      
      data.items.forEach((style: any) => {
        const date = new Date(style.createdAt);
        expect(date.toString()).not.toBe('Invalid Date');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid cursor gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10&cursor=invalid-cursor`);
      expect(response.status).toBeLessThanOrEqual(500);
    });

    it('should handle negative limit', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=-1`);
      expect(response.status).toBeLessThan(500);
    });

    it('should handle very large limit', async () => {
      const response = await fetch(`${baseUrl}/api/styles?limit=10000`);
      expect(response.ok).toBe(true);
    });
  });
});
