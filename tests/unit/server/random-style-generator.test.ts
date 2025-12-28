import { describe, it, expect } from 'vitest';
import { generateRandomStyle } from '../../../server/random-style-generator';

describe('Random Style Generator', () => {
  describe('generateRandomStyle', () => {
    it('should generate a complete style object', () => {
      const result = generateRandomStyle();
      
      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });

    it('should generate a valid description', () => {
      const result = generateRandomStyle();
      
      expect(result.description).toBeDefined();
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('should generate valid DTCG tokens with schema', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens).toBeDefined();
      expect(typeof result.tokens).toBe('object');
      expect(result.tokens.$schema).toContain('design-tokens');
    });

    it('should generate color tokens with OKLCH values', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.color).toBeDefined();
      expect(result.tokens.color.primary).toBeDefined();
      expect(result.tokens.color.primary.$type).toBe('color');
      expect(result.tokens.color.primary.$value).toMatch(/oklch\([\d.]+ [\d.]+ [\d.]+\)/);
    });

    it('should generate all core color tokens', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.color.primary).toBeDefined();
      expect(result.tokens.color.secondary).toBeDefined();
      expect(result.tokens.color.tertiary).toBeDefined();
      expect(result.tokens.color.accent).toBeDefined();
      expect(result.tokens.color.background).toBeDefined();
      expect(result.tokens.color.surface).toBeDefined();
    });

    it('should generate valid spacing tokens', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.spacing).toBeDefined();
      expect(result.tokens.spacing['1']).toBeDefined();
      expect(result.tokens.spacing['1'].$type).toBe('dimension');
      expect(result.tokens.spacing['1'].$value).toMatch(/^\d+px$/);
    });

    it('should generate typography tokens', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.typography).toBeDefined();
      expect(result.tokens.typography.fontFamily).toBeDefined();
      expect(result.tokens.typography.fontSize).toBeDefined();
    });

    it('should generate radius tokens', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.radius).toBeDefined();
      expect(result.tokens.radius.sm).toBeDefined();
      expect(result.tokens.radius.md).toBeDefined();
      expect(result.tokens.radius.lg).toBeDefined();
    });

    it('should generate shadow tokens', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.shadow).toBeDefined();
      expect(result.tokens.shadow.sm).toBeDefined();
      expect(result.tokens.shadow.md).toBeDefined();
      expect(result.tokens.shadow.lg).toBeDefined();
    });

    it('should generate motion tokens', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.motion).toBeDefined();
      expect(result.tokens.motion.duration).toBeDefined();
      expect(result.tokens.motion.easing).toBeDefined();
    });

    it('should generate prompt scaffolding', () => {
      const result = generateRandomStyle();
      
      expect(result.promptScaffolding).toBeDefined();
      expect(result.promptScaffolding.base).toBeDefined();
      expect(typeof result.promptScaffolding.base).toBe('string');
      expect(Array.isArray(result.promptScaffolding.modifiers)).toBe(true);
      expect(result.promptScaffolding.modifiers.length).toBeGreaterThan(0);
      expect(result.promptScaffolding.negative).toBeDefined();
    });

    it('should generate metadata tags', () => {
      const result = generateRandomStyle();
      
      expect(result.metadataTags).toBeDefined();
      expect(Array.isArray(result.metadataTags.mood)).toBe(true);
      expect(result.metadataTags.mood.length).toBeGreaterThan(0);
      expect(Array.isArray(result.metadataTags.colorFamily)).toBe(true);
      expect(Array.isArray(result.metadataTags.lighting)).toBe(true);
      expect(Array.isArray(result.metadataTags.texture)).toBe(true);
      expect(Array.isArray(result.metadataTags.era)).toBe(true);
      expect(Array.isArray(result.metadataTags.keywords)).toBe(true);
    });

    it('should generate different styles on each call', () => {
      const style1 = generateRandomStyle();
      const style2 = generateRandomStyle();
      const style3 = generateRandomStyle();
      
      const allSame = 
        style1.name === style2.name && 
        style2.name === style3.name &&
        style1.tokens.color.primary.$value === style2.tokens.color.primary.$value;
      
      expect(allSame).toBe(false);
    });

    it('should generate OKLCH colors with valid ranges', () => {
      for (let i = 0; i < 5; i++) {
        const result = generateRandomStyle();
        const colorValue = result.tokens.color.primary.$value;
        
        const match = colorValue.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/);
        expect(match).not.toBeNull();
        
        if (match) {
          const lightness = parseFloat(match[1]);
          const chroma = parseFloat(match[2]);
          const hue = parseFloat(match[3]);
          
          expect(lightness).toBeGreaterThanOrEqual(0);
          expect(lightness).toBeLessThanOrEqual(1);
          expect(chroma).toBeGreaterThanOrEqual(0);
          expect(chroma).toBeLessThanOrEqual(0.5);
          expect(hue).toBeGreaterThanOrEqual(0);
          expect(hue).toBeLessThanOrEqual(360);
        }
      }
    });

    it('should include visualDNA extension metadata', () => {
      const result = generateRandomStyle();
      
      expect(result.tokens.$extensions).toBeDefined();
      expect(result.tokens.$extensions.visualDNA).toBeDefined();
      expect(result.tokens.$extensions.visualDNA.version).toBe('2.0.0');
      expect(result.tokens.$extensions.visualDNA.source).toBe('random-generator');
    });
  });
});
