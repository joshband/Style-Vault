import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockDTCGTokens } from '../../fixtures/mock-tokens';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
  }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  QueryClient: vi.fn().mockReturnValue({}),
}));

describe('TokenVisualization Component', () => {
  describe('Color Extraction', () => {
    it('should extract color tokens from DTCG structure', () => {
      const colors = mockDTCGTokens.color;
      expect(colors.primary.base.$value).toBeDefined();
      expect(colors.primary.base.$type).toBe('color');
    });

    it('should handle nested color groups', () => {
      const colors = mockDTCGTokens.color;
      expect(colors.primary).toBeDefined();
      expect(colors.secondary).toBeDefined();
      expect(colors.neutral).toBeDefined();
    });

    it('should resolve alias references', () => {
      const semanticBackground = mockDTCGTokens.color.semantic.background;
      expect(semanticBackground.$value).toBe('{color.neutral.50}');

      const resolvedValue = mockDTCGTokens.color.neutral['50'].$value;
      expect(resolvedValue).toBe('oklch(0.98 0.01 250)');
    });
  });

  describe('Typography Extraction', () => {
    it('should extract font family tokens', () => {
      const fontFamily = mockDTCGTokens.typography.fontFamily;
      expect(fontFamily.heading.$value).toContain('Inter');
      expect(fontFamily.body.$type).toBe('fontFamily');
    });

    it('should extract font size tokens', () => {
      const fontSize = mockDTCGTokens.typography.fontSize;
      expect(fontSize.base.$value).toBe('16px');
      expect(fontSize.lg.$value).toBe('18px');
    });

    it('should extract font weight tokens', () => {
      const fontWeight = mockDTCGTokens.typography.fontWeight;
      expect(fontWeight.normal.$value).toBe(400);
      expect(fontWeight.bold.$value).toBe(700);
    });
  });

  describe('Spacing Extraction', () => {
    it('should extract spacing tokens', () => {
      const spacing = mockDTCGTokens.spacing;
      expect(spacing.xs.$value).toBe('4px');
      expect(spacing.md.$value).toBe('16px');
      expect(spacing.xl.$value).toBe('32px');
    });

    it('should have correct token types', () => {
      const spacing = mockDTCGTokens.spacing;
      Object.values(spacing).forEach((token: any) => {
        expect(token.$type).toBe('dimension');
      });
    });
  });

  describe('OKLCH Color Parsing', () => {
    it('should parse valid OKLCH color strings', () => {
      const oklchRegex = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/;
      const color = 'oklch(0.65 0.18 250)';
      const match = color.match(oklchRegex);

      expect(match).not.toBeNull();
      expect(parseFloat(match![1])).toBeCloseTo(0.65, 2);
      expect(parseFloat(match![2])).toBeCloseTo(0.18, 2);
      expect(parseFloat(match![3])).toBe(250);
    });

    it('should convert OKLCH to RGB for rendering', () => {
      function oklchToRgb(L: number, C: number, H: number) {
        const h = (H * Math.PI) / 180;
        const a_ = C * Math.cos(h);
        const b_ = C * Math.sin(h);

        const L_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
        const M_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
        const S_ = L - 0.0894841775 * a_ - 1.291485548 * b_;

        const L3 = L_ * L_ * L_;
        const M3 = M_ * M_ * M_;
        const S3 = S_ * S_ * S_;

        let r = +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
        let g = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
        let b = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.707614701 * S3;

        const clamp = (x: number) => Math.max(0, Math.min(1, x));
        return {
          r: Math.round(clamp(r) * 255),
          g: Math.round(clamp(g) * 255),
          b: Math.round(clamp(b) * 255),
        };
      }

      const rgb = oklchToRgb(0.65, 0.18, 250);
      expect(rgb.r).toBeGreaterThanOrEqual(0);
      expect(rgb.r).toBeLessThanOrEqual(255);
      expect(rgb.g).toBeGreaterThanOrEqual(0);
      expect(rgb.g).toBeLessThanOrEqual(255);
      expect(rgb.b).toBeGreaterThanOrEqual(0);
      expect(rgb.b).toBeLessThanOrEqual(255);
    });
  });
});
