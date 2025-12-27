/**
 * Adobe XD Design Tokens Exporter
 * 
 * Exports tokens in Adobe XD's DSP (Design System Package) format.
 * This format is compatible with XD's design token features and can be 
 * imported directly into Adobe XD projects.
 */

import type { ExporterDefinition, NormalizedTokenSet, NormalizedToken } from '../token-pipeline';
import { parseColor } from '../token-pipeline';

interface XDToken {
  id: string;
  type: string;
  value: unknown;
  name: string;
  description?: string;
  category?: string;
}

interface XDColorValue {
  mode: string;
  value: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

interface XDDimensionValue {
  value: number;
  unit: string;
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
    {
      id: 'flattenGroups',
      label: 'Flatten token groups',
      type: 'boolean',
      default: false,
    },
  ],
  export: (tokens: NormalizedTokenSet, options?: Record<string, unknown>): string => {
    const flattenGroups = options?.flattenGroups ?? false;

    const xdTokens: XDToken[] = [];
    const categories: Record<string, string[]> = {};

    for (const token of tokens.tokens) {
      const xdToken = convertToXDToken(token, flattenGroups as boolean);
      if (xdToken) {
        xdTokens.push(xdToken);
        
        const category = token.path[0] || 'other';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(xdToken.id);
      }
    }

    const dspPackage = {
      dsp_spec_version: '0.8.0',
      last_updated_by: 'Visual DNA Studio',
      last_updated: tokens.metadata.exportedAt,
      settings: {
        name: tokens.name,
        build_status_label: 'Production',
        package_version: '1.0.0',
      },
      entities: xdTokens,
      categories: Object.entries(categories).map(([name, tokenIds]) => ({
        id: `category_${name}`,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        token_ids: tokenIds,
      })),
      fonts: extractFontReferences(tokens),
    };

    return JSON.stringify(dspPackage, null, 2);
  },
};

function convertToXDToken(token: NormalizedToken, flatten: boolean): XDToken | null {
  const id = flatten 
    ? token.path.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-')
    : token.path.join('/');
  
  const name = token.path[token.path.length - 1] || id;

  let xdType: string;
  let xdValue: unknown;

  switch (token.type) {
    case 'color':
      xdType = 'color';
      const parsed = typeof token.value === 'string' ? parseColor(token.value) : null;
      if (parsed) {
        xdValue = {
          mode: 'rgb',
          value: {
            r: parsed.r,
            g: parsed.g,
            b: parsed.b,
            a: parsed.a,
          },
        } as XDColorValue;
      } else {
        xdValue = { mode: 'hex', value: token.value };
      }
      break;

    case 'dimension':
    case 'spacing':
    case 'borderRadius':
    case 'borderWidth':
    case 'fontSize':
    case 'lineHeight':
      xdType = 'size';
      const dimValue = String(token.value);
      const numericValue = parseFloat(dimValue.replace(/[^\d.-]/g, '')) || 0;
      const unit = dimValue.replace(/[\d.-]/g, '') || 'px';
      xdValue = { value: numericValue, unit } as XDDimensionValue;
      break;

    case 'fontFamily':
      xdType = 'font';
      xdValue = { family: String(token.value) };
      break;

    case 'fontWeight':
      xdType = 'fontWeight';
      xdValue = { weight: String(token.value) };
      break;

    case 'shadow':
      xdType = 'shadow';
      xdValue = parseShadowValue(token.value);
      break;

    case 'gradient':
      xdType = 'gradient';
      xdValue = parseGradientValue(token.value);
      break;

    case 'duration':
      xdType = 'duration';
      const durationMs = parseDuration(String(token.value));
      xdValue = { value: durationMs, unit: 'ms' };
      break;

    case 'cubicBezier':
      xdType = 'easing';
      xdValue = { type: 'cubic-bezier', value: token.value };
      break;

    default:
      xdType = 'custom';
      xdValue = token.value;
  }

  return {
    id,
    type: xdType,
    value: xdValue,
    name,
    description: token.description || undefined,
    category: token.path[0],
  };
}

function parseShadowValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const parts = value.split(/\s+/);
    const colorMatch = value.match(/(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/);
    return {
      offsetX: parseFloat(parts[0]) || 0,
      offsetY: parseFloat(parts[1]) || 0,
      blur: parseFloat(parts[2]) || 0,
      spread: parseFloat(parts[3]) || 0,
      color: colorMatch ? colorMatch[0] : '#000000',
    };
  }
  return value;
}

function parseGradientValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const linearMatch = value.match(/linear-gradient\(([^)]+)\)/);
    if (linearMatch) {
      return {
        type: 'linear',
        value: linearMatch[1],
      };
    }
    const radialMatch = value.match(/radial-gradient\(([^)]+)\)/);
    if (radialMatch) {
      return {
        type: 'radial',
        value: radialMatch[1],
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
