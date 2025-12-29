import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defaultFeatureFlags } from '../../../shared/featureFlags';

const StyleDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().nullable().optional(),
  creatorId: z.string().nullable(),
  isPublic: z.boolean(),
  isArchived: z.boolean().optional(),
  shareCode: z.string().nullable().optional(),
  styleSpec: z.any().nullable().optional(),
  referenceImages: z.array(z.any()).optional(),
  previews: z.record(z.any()).optional(),
  tokens: z.record(z.any()).optional(),
  promptScaffolding: z.record(z.any()).nullable().optional(),
  metadataTags: z.record(z.any()).nullable().optional(),
  metadataEnrichmentStatus: z.string().optional(),
  moodBoard: z.object({
    status: z.string(),
    history: z.array(z.any()),
  }).optional(),
  uiConcepts: z.object({
    status: z.string(),
    history: z.array(z.any()),
  }).optional(),
});

describe('API Contract Tests - Style Detail', () => {
  const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000';
  const validStyleId = '22076530-40ae-4ab9-affb-2f5ae80be1a8';

  describe('GET /api/styles/:id', () => {
    it('should return 404 for non-existent style ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${baseUrl}/api/styles/${fakeId}`);
      
      if (!defaultFeatureFlags['api.styles.detail']) {
        expect(response.status).toBe(404);
        return;
      }
      
      expect(response.status).toBe(404);
    });

    it('should return 400 or 404 for invalid UUID format', async () => {
      const response = await fetch(`${baseUrl}/api/styles/not-a-valid-uuid`);
      
      expect([400, 404]).toContain(response.status);
    });

    it('should return valid style object for existing style when feature enabled', async () => {
      if (!defaultFeatureFlags['api.styles.detail']) {
        console.log('Skipping: api.styles.detail flag is disabled');
        return;
      }

      const response = await fetch(`${baseUrl}/api/styles/${validStyleId}`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      const result = StyleDetailSchema.safeParse(data);
      
      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }
      expect(result.success).toBe(true);
    });

    it('should include style name and description in response', async () => {
      if (!defaultFeatureFlags['api.styles.detail']) {
        console.log('Skipping: api.styles.detail flag is disabled');
        return;
      }

      const response = await fetch(`${baseUrl}/api/styles/${validStyleId}`);
      const data = await response.json();
      
      expect(data.name).toBe('Retro Industrial Audio');
      expect(typeof data.description).toBe('string');
    });

    it('should return proper content-type header', async () => {
      const response = await fetch(`${baseUrl}/api/styles/${validStyleId}`);
      const contentType = response.headers.get('content-type');
      
      expect(contentType).toMatch(/application\/json/);
    });
  });

  describe('Feature Flag Behavior (Stage 3)', () => {
    it('api.styles.detail flag should be true', () => {
      expect(defaultFeatureFlags['api.styles.detail']).toBe(true);
    });

    it('inspect.enabled flag should be true', () => {
      expect(defaultFeatureFlags['inspect.enabled']).toBe(true);
    });

    it('inspect.tokens flag should be true', () => {
      expect(defaultFeatureFlags['inspect.tokens']).toBe(true);
    });

    it('inspect.palette flag should be true', () => {
      expect(defaultFeatureFlags['inspect.palette']).toBe(true);
    });

    it('inspect.summary flag should be true', () => {
      expect(defaultFeatureFlags['inspect.summary']).toBe(true);
    });

    it('inspect.previews flag should be true', () => {
      expect(defaultFeatureFlags['inspect.previews']).toBe(true);
    });
  });
});
