/**
 * Adobe XD Design Tokens Exporter
 * 
 * Exports tokens in Adobe XD's DSP (Design System Package) format.
 * This format is compatible with XD's design token features and can be 
 * imported directly into Adobe XD projects.
 */

import type { ExporterDefinition, NormalizedTokenSet, NormalizedToken } from '../token-pipeline';
import { parseColor } from '../token-pipeline';

interface XDEntity {
  class: string;
  type: string;
  id: string;
  name: string;
  value: unknown;
  tags?: string[];
  description?: string;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const exportAdobeXD: ExporterDefinition = {
  id: 'adobe-xd',
  name: 'Adobe XD',
  description: 'Design System Package format for Adobe XD projects.',
  category: 'design-tool',
  extension: 'json',
  mimeType: 'application/json',
  isBinary: false,
  serverSide: false,
  subOptions: [
    {
      id: 'includeComponents',
      label: 'Include component styles',
      type: 'boolean',
      default: true,
    },
  ],
  export: (tokens: NormalizedTokenSet, _options?: Record<string, unknown>): string => {
    const entities: XDEntity[] = [];
    const collections: Record<string, string[]> = {};

    for (const token of tokens.tokens) {
      const entity = convertToXDEntity(token);
      if (entity) {
        entities.push(entity);
        
        const collection = token.path[0] || 'general';
        if (!collections[collection]) {
          collections[collection] = [];
        }
        collections[collection].push(entity.id);
      }
    }

    const dspPackage = {
      dsp_spec_version: '0.9.0',
      last_updated_by: 'Visual DNA Studio',
      last_updated: tokens.metadata.exportedAt,
      settings: {
        name: tokens.name,
        build_status_label: 'Production',
        package_version: '1.0.0',
      },
      entities,
      collections: Object.entries(collections).map(([name, entityIds]) => ({
        class: 'collection',
        type: 'token-collection',
        id: generateUUID(),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        entity_ids: entityIds,
      })),
      fonts: extractFontReferences(tokens),
    };

    return JSON.stringify(dspPackage, null, 2);
  },
};

function convertToXDEntity(token: NormalizedToken): XDEntity | null {
  const id = generateUUID();
  const name = token.path.join(' / ');
  const tags = [token.path[0]].filter(Boolean);

  let entityType: string;
  let entityValue: unknown;

  switch (token.type) {
    case 'color':
      entityType = 'color';
      const parsed = typeof token.value === 'string' ? parseColor(token.value) : null;
      if (parsed) {
        entityValue = {
          a: parsed.a,
          r: parsed.r,
          g: parsed.g,
          b: parsed.b,
        };
      } else {
        entityValue = { hex: token.value };
      }
      break;

    case 'dimension':
    case 'spacing':
    case 'borderRadius':
    case 'borderWidth':
    case 'fontSize':
    case 'lineHeight':
      entityType = 'size';
      const dimValue = String(token.value);
      const numericValue = parseFloat(dimValue.replace(/[^\d.-]/g, '')) || 0;
      const unit = dimValue.replace(/[\d.-]/g, '') || 'px';
      entityValue = {
        measure: numericValue,
        unit: unit,
      };
      break;

    case 'fontFamily':
      entityType = 'font-family';
      entityValue = {
        family: String(token.value).split(',')[0].trim().replace(/["']/g, ''),
      };
      break;

    case 'fontWeight':
      entityType = 'font-weight';
      const weightValue = String(token.value);
      const numericWeight = parseInt(weightValue, 10);
      entityValue = {
        weight: isNaN(numericWeight) ? weightValue : numericWeight,
      };
      break;

    case 'shadow':
      entityType = 'shadow';
      entityValue = parseShadowValue(token.value);
      break;

    case 'gradient':
      entityType = 'gradient';
      entityValue = parseGradientValue(token.value);
      break;

    case 'duration':
      entityType = 'duration';
      const durationMs = parseDuration(String(token.value));
      entityValue = {
        measure: durationMs,
        unit: 'ms',
      };
      break;

    case 'cubicBezier':
      entityType = 'easing';
      if (Array.isArray(token.value) && token.value.length === 4) {
        entityValue = {
          x1: token.value[0],
          y1: token.value[1],
          x2: token.value[2],
          y2: token.value[3],
        };
      } else {
        entityValue = token.value;
      }
      break;

    case 'opacity':
      entityType = 'opacity';
      const opacityVal = typeof token.value === 'number' ? token.value : parseFloat(String(token.value));
      entityValue = {
        value: isNaN(opacityVal) ? 1 : opacityVal,
      };
      break;

    default:
      entityType = 'custom';
      entityValue = { raw: token.value };
  }

  return {
    class: 'token',
    type: entityType,
    id,
    name,
    value: entityValue,
    tags,
    description: token.description || undefined,
  };
}

function parseShadowValue(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const shadow = value as Record<string, unknown>;
    const parsed = shadow.color && typeof shadow.color === 'string' ? parseColor(shadow.color) : null;
    return {
      offsetX: { measure: shadow.offsetX || shadow.x || 0, unit: 'px' },
      offsetY: { measure: shadow.offsetY || shadow.y || 0, unit: 'px' },
      blur: { measure: shadow.blur || 0, unit: 'px' },
      spread: { measure: shadow.spread || 0, unit: 'px' },
      color: parsed ? { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a } : { hex: shadow.color || '#000000' },
    };
  }
  
  if (typeof value === 'string') {
    const parts = value.split(/\s+/);
    const colorMatch = value.match(/(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/);
    const colorStr = colorMatch ? colorMatch[0] : '#000000';
    const parsed = parseColor(colorStr);
    return {
      offsetX: { measure: parseFloat(parts[0]) || 0, unit: 'px' },
      offsetY: { measure: parseFloat(parts[1]) || 0, unit: 'px' },
      blur: { measure: parseFloat(parts[2]) || 0, unit: 'px' },
      spread: { measure: parseFloat(parts[3]) || 0, unit: 'px' },
      color: parsed ? { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a } : { hex: colorStr },
    };
  }
  
  return value;
}

function parseGradientValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const linearMatch = value.match(/linear-gradient\(([^,]+),\s*(.+)\)/);
    if (linearMatch) {
      return {
        type: 'linear',
        angle: linearMatch[1].trim(),
        stops: linearMatch[2].split(',').map((stop, i, arr) => ({
          color: { hex: stop.trim().split(/\s+/)[0] },
          position: i / Math.max(1, arr.length - 1),
        })),
      };
    }
    const radialMatch = value.match(/radial-gradient\(([^)]+)\)/);
    if (radialMatch) {
      return {
        type: 'radial',
        definition: radialMatch[1],
      };
    }
  }
  return value;
}

function parseDuration(value: string): number {
  if (value.endsWith('ms')) {
    return parseFloat(value) || 0;
  }
  if (value.endsWith('s')) {
    return (parseFloat(value) || 0) * 1000;
  }
  return parseFloat(value) || 0;
}

function extractFontReferences(tokens: NormalizedTokenSet): string[] {
  const fonts = new Set<string>();
  
  for (const token of tokens.tokens) {
    if (token.type === 'fontFamily' && typeof token.value === 'string') {
      const family = token.value.split(',')[0].trim().replace(/["']/g, '');
      if (family) {
        fonts.add(family);
      }
    }
  }
  
  return Array.from(fonts);
}
