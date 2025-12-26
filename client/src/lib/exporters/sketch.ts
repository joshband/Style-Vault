/**
 * Sketch Palette Exporter
 * 
 * Exports color tokens as Sketch-compatible palette JSON.
 */

import type { ExporterDefinition, NormalizedTokenSet } from '../token-pipeline';
import { parseColor } from '../token-pipeline';

export const exportSketch: ExporterDefinition = {
  id: 'sketch',
  name: 'Sketch Palette',
  description: 'Color palette for Sketch app document colors.',
  category: 'design-tool',
  extension: 'json',
  mimeType: 'application/json',
  isBinary: false,
  serverSide: false,
  subOptions: [],
  export: (tokens: NormalizedTokenSet): string => {
    const colorTokens = tokens.groups.color;
    
    const colors: any[] = [];
    
    for (const token of colorTokens) {
      if (typeof token.value === 'string') {
        const parsed = parseColor(token.value);
        if (parsed) {
          colors.push({
            name: token.path.join(' / '),
            red: parsed.r / 255,
            green: parsed.g / 255,
            blue: parsed.b / 255,
            alpha: parsed.a,
          });
        }
      }
    }
    
    const palette = {
      compatibleVersion: '2.0',
      pluginVersion: '2.29',
      name: tokens.name,
      colors,
    };
    
    return JSON.stringify(palette, null, 2);
  },
};
