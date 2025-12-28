import { describe, it, expect } from 'vitest';
import { assembleTokens, type CVExtractionResult, type DTCGToken } from '../../../server/token-assembly';

describe('Token Assembly', () => {
  describe('assembleTokens', () => {
    it('should create valid DTCG token structure', () => {
      const cvResult: CVExtractionResult = {
        color: ['#ff0000', '#00ff00', '#0000ff'],
      };
      
      const result = assembleTokens(cvResult);
      
      expect(result.$schema).toBe('https://design-tokens.github.io/community-group/format/2025.10/schema.json');
      expect(result.color).toBeDefined();
      expect(result.spacing).toBeDefined();
      expect(result.typography).toBeDefined();
      expect(result.radius).toBeDefined();
      expect(result.shadow).toBeDefined();
      expect(result.opacity).toBeDefined();
      expect(result.depth).toBeDefined();
      expect(result.motion).toBeDefined();
    });

    it('should include color tokens from CV result', () => {
      const cvResult: CVExtractionResult = {
        color: ['oklch(0.5 0.2 200)', 'oklch(0.6 0.15 250)'],
      };
      
      const result = assembleTokens(cvResult);
      const primary = result.color.primary as DTCGToken;
      
      expect(primary).toBeDefined();
      expect(primary.$type).toBe('color');
      expect(primary.$extensions?.visualDNA.source).toBe('cv');
    });

    it('should provide fallback tokens when no CV data', () => {
      const cvResult: CVExtractionResult = {};
      
      const result = assembleTokens(cvResult);
      const primary = result.color.primary as DTCGToken;
      
      expect(primary).toBeDefined();
      expect(primary.$extensions?.visualDNA.source).toBe('inferred');
      expect(primary.$extensions?.visualDNA.confidence).toBeLessThan(0.5);
    });

    it('should include confidence metadata for all tokens', () => {
      const cvResult: CVExtractionResult = {
        color: ['#ff0000'],
      };
      
      const result = assembleTokens(cvResult);
      const primary = result.color.primary as DTCGToken;
      
      expect(primary.$extensions?.visualDNA).toBeDefined();
      expect(primary.$extensions?.visualDNA.confidence).toBeGreaterThan(0);
      expect(primary.$extensions?.visualDNA.source).toBeDefined();
    });

    it('should track overall confidence in extensions', () => {
      const cvResult: CVExtractionResult = {
        color: ['#ff0000', '#00ff00'],
        spacing: [8, 16, 24],
      };
      
      const result = assembleTokens(cvResult);
      
      expect(result.$extensions?.visualDNA).toBeDefined();
      expect(result.$extensions?.visualDNA.version).toBeDefined();
      expect(result.$extensions?.visualDNA.overallConfidence).toBeGreaterThan(0);
      expect(result.$extensions?.visualDNA.categoryConfidence).toBeDefined();
    });

    it('should generate spacing tokens from CV result', () => {
      const cvResult: CVExtractionResult = {
        spacing: [4, 8, 16, 24, 32],
      };
      
      const result = assembleTokens(cvResult);
      
      expect(Object.keys(result.spacing).length).toBeGreaterThan(0);
    });

    it('should generate radius tokens from CV result', () => {
      const cvResult: CVExtractionResult = {
        borderRadius: [4, 8, 12],
      };
      
      const result = assembleTokens(cvResult);
      
      expect(Object.keys(result.radius).length).toBeGreaterThan(0);
    });
  });
});
