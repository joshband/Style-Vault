/**
 * Figma Tokens Studio Exporter
 * 
 * Exports tokens in the Tokens Studio format (formerly Figma Tokens).
 * This is a popular community format for managing design tokens in Figma.
 * https://tokens.studio/
 */

import type { ExporterDefinition, NormalizedTokenSet, NormalizedToken } from '../token-pipeline';
import { parseColor } from '../token-pipeline';

interface TokensStudioToken {
  value: unknown;
  type: string;
  description?: string;
}

type TokensStudioGroup = {
  [key: string]: TokensStudioGroup | TokensStudioToken;
};

export const exportFigmaTokensStudio: ExporterDefinition = {
  id: 'figma-tokens-studio',
  name: 'Figma Tokens Studio',
  description: 'Popular community format for the Tokens Studio plugin (formerly Figma Tokens).',
  category: 'design-tool',
  extension: 'json',
  mimeType: 'application/json',
  isBinary: false,
  serverSide: false,
  subOptions: [
    {
      id: 'multiFile',
      label: 'Multi-file structure (global + theme)',
      type: 'boolean',
      default: false,
    },
    {
      id: 'includeReferences',
      label: 'Include alias references',
      type: 'boolean',
      default: true,
    },
  ],
  export: (tokens: NormalizedTokenSet, options?: Record<string, unknown>): string => {
    const multiFile = options?.multiFile ?? false;
    const includeReferences = options?.includeReferences ?? true;

    const tokenTree: TokensStudioGroup = {};

    for (const token of tokens.tokens) {
      const converted = convertToTokensStudioToken(token, includeReferences as boolean);
      if (converted) {
        insertTokenInTree(tokenTree, token.path, converted);
      }
    }

    if (multiFile) {
      const output = {
        [tokens.name]: tokenTree,
        $themes: [
          {
            id: `theme_${Date.now()}`,
            name: 'Default',
            selectedTokenSets: {
              [tokens.name]: 'enabled',
            },
          },
        ],
        $metadata: {
          tokenSetOrder: [tokens.name],
        },
      };
      return JSON.stringify(output, null, 2);
    }

    const output = {
      [tokens.name]: tokenTree,
    };

    return JSON.stringify(output, null, 2);
  },
};

function insertTokenInTree(
  tree: TokensStudioGroup, 
  path: string[], 
  token: TokensStudioToken
): void {
  let current = tree;
  
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!current[key] || typeof current[key] !== 'object' || 'value' in current[key]) {
      current[key] = {};
    }
    current = current[key] as TokensStudioGroup;
  }
  
  const finalKey = path[path.length - 1];
  current[finalKey] = token;
}

function convertToTokensStudioToken(
  token: NormalizedToken, 
  includeReferences: boolean
): TokensStudioToken | null {
  let tsType: string;
  let tsValue: unknown;

  switch (token.type) {
    case 'color':
      tsType = 'color';
      tsValue = token.value;
      break;

    case 'dimension':
    case 'spacing':
      tsType = 'dimension';
      tsValue = String(token.value);
      break;

    case 'borderRadius':
      tsType = 'borderRadius';
      tsValue = String(token.value);
      break;

    case 'borderWidth':
      tsType = 'borderWidth';
      tsValue = String(token.value);
      break;

    case 'fontSize':
      tsType = 'fontSizes';
      tsValue = String(token.value);
      break;

    case 'lineHeight':
      tsType = 'lineHeights';
      tsValue = String(token.value);
      break;

    case 'letterSpacing':
      tsType = 'letterSpacing';
      tsValue = String(token.value);
      break;

    case 'fontFamily':
      tsType = 'fontFamilies';
      tsValue = token.value;
      break;

    case 'fontWeight':
      tsType = 'fontWeights';
      tsValue = token.value;
      break;

    case 'shadow':
      tsType = 'boxShadow';
      tsValue = formatShadowForTokensStudio(token.value);
      break;

    case 'opacity':
      tsType = 'opacity';
      tsValue = String(token.value);
      break;

    case 'duration':
      tsType = 'duration';
      tsValue = String(token.value);
      break;

    case 'cubicBezier':
      tsType = 'easing';
      tsValue = token.value;
      break;

    case 'composition':
    case 'typography':
      tsType = 'typography';
      tsValue = formatTypographyForTokensStudio(token.value);
      break;

    default:
      tsType = 'other';
      tsValue = token.value;
  }

  const result: TokensStudioToken = {
    value: tsValue,
    type: tsType,
  };

  if (token.description) {
    result.description = token.description;
  }

  return result;
}

function formatShadowForTokensStudio(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const shadow = value as Record<string, unknown>;
    return {
      x: String(shadow.offsetX || shadow.x || '0'),
      y: String(shadow.offsetY || shadow.y || '0'),
      blur: String(shadow.blur || '0'),
      spread: String(shadow.spread || '0'),
      color: String(shadow.color || '#000000'),
      type: shadow.inset ? 'innerShadow' : 'dropShadow',
    };
  }
  
  if (typeof value === 'string') {
    const parts = value.split(/\s+/);
    const colorMatch = value.match(/(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/);
    return {
      x: parts[0] || '0',
      y: parts[1] || '0',
      blur: parts[2] || '0',
      spread: parts[3] || '0',
      color: colorMatch ? colorMatch[0] : '#000000',
      type: value.includes('inset') ? 'innerShadow' : 'dropShadow',
    };
  }
  
  return value;
}

function formatTypographyForTokensStudio(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const typo = value as Record<string, unknown>;
    return {
      fontFamily: typo.fontFamily || undefined,
      fontWeight: typo.fontWeight || undefined,
      fontSize: typo.fontSize || undefined,
      lineHeight: typo.lineHeight || undefined,
      letterSpacing: typo.letterSpacing || undefined,
      textCase: typo.textCase || typo.textTransform || undefined,
      textDecoration: typo.textDecoration || undefined,
    };
  }
  return value;
}
