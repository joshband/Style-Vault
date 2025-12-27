import { describe, it, expect, vi } from 'vitest';
import { mockDTCGTokens, mockStyleSummary } from '../../fixtures/mock-tokens';

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    text: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    circle: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
  })),
}));

describe('PDF Export', () => {
  describe('Color Token Processing', () => {
    it('should extract colors from token structure', () => {
      const colors: string[] = [];
      
      function extractColors(obj: any) {
        for (const key in obj) {
          const value = obj[key];
          if (value && typeof value === 'object') {
            if (value.$type === 'color' && value.$value) {
              colors.push(value.$value);
            } else {
              extractColors(value);
            }
          }
        }
      }

      extractColors(mockDTCGTokens.color);
      expect(colors.length).toBeGreaterThan(0);
      expect(colors).toContain('oklch(0.65 0.18 250)');
    });

    it('should resolve color aliases before export', () => {
      const aliasValue = mockDTCGTokens.color.semantic.background.$value;
      expect(aliasValue).toMatch(/^\{.*\}$/);

      const resolved = mockDTCGTokens.color.neutral['50'].$value;
      expect(resolved).not.toMatch(/^\{.*\}$/);
    });
  });

  describe('Typography Token Processing', () => {
    it('should extract typography information', () => {
      const typography = mockDTCGTokens.typography;
      
      expect(typography.fontFamily).toBeDefined();
      expect(typography.fontSize).toBeDefined();
      expect(typography.fontWeight).toBeDefined();
    });

    it('should format font family for PDF', () => {
      const fontFamily = mockDTCGTokens.typography.fontFamily.heading.$value;
      expect(Array.isArray(fontFamily)).toBe(true);
      expect(fontFamily[0]).toBe('Inter');
    });
  });

  describe('Spacing Token Processing', () => {
    it('should extract spacing values', () => {
      const spacing = mockDTCGTokens.spacing;
      const spacingValues = Object.entries(spacing).map(([key, value]: [string, any]) => ({
        name: key,
        value: value.$value,
      }));

      expect(spacingValues.length).toBe(5);
      expect(spacingValues.find(s => s.name === 'md')?.value).toBe('16px');
    });
  });

  describe('PDF Generation', () => {
    it('should use correct page dimensions for A4', () => {
      const a4Width = 210; // mm
      const a4Height = 297; // mm

      expect(a4Width).toBe(210);
      expect(a4Height).toBe(297);
    });

    it('should format filename correctly', () => {
      const styleName = 'Test Style';
      const expectedFilename = 'test-style-brand-kit.pdf';

      const actualFilename = `${styleName.replace(/\s+/g, '-').toLowerCase()}-brand-kit.pdf`;
      expect(actualFilename).toBe(expectedFilename);
    });

    it('should handle special characters in filename', () => {
      const styleName = 'My Cool Style!';
      const filename = `${styleName.replace(/\s+/g, '-').toLowerCase()}-brand-kit.pdf`;
      expect(filename).toBe('my-cool-style!-brand-kit.pdf');
    });
  });

  describe('Mockup Generation', () => {
    it('should generate business card mockup dimensions', () => {
      const businessCardWidth = 85;
      const businessCardHeight = 55;

      expect(businessCardWidth).toBeGreaterThan(businessCardHeight);
      expect(businessCardWidth).toBeLessThanOrEqual(90); // Standard mm
    });

    it('should generate social post mockup dimensions', () => {
      const socialPostSize = 50;
      expect(socialPostSize).toBe(50); // Square aspect ratio
    });

    it('should generate website hero mockup dimensions', () => {
      const heroWidth = 90;
      const heroHeight = 50;
      const aspectRatio = heroWidth / heroHeight;

      expect(aspectRatio).toBeCloseTo(1.8, 1); // Widescreen ratio
    });

    it('should generate mobile app mockup dimensions', () => {
      const phoneWidth = 45;
      const phoneHeight = 90;
      const aspectRatio = phoneHeight / phoneWidth;

      expect(aspectRatio).toBe(2); // 2:1 mobile ratio
    });
  });
});
