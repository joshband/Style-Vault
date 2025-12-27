/**
 * Figma Tokens Studio Exporter
 * 
 * Exports tokens in the Tokens Studio format (formerly Figma Tokens).
 * This is a popular community format for managing design tokens in Figma.
 * https://tokens.studio/
 */

import type { ExporterDefinition, NormalizedTokenSet, NormalizedToken } from '../token-pipeline';

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
      label: 'Preserve alias references (e.g., {color.primary})',
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

function isAliasReference(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^\{[^}]+\}$/.test(value);
}

function convertToTokensStudioToken(
  token: NormalizedToken, 
  includeReferences: boolean
): TokensStudioToken | null {
  let tsType: string;
  let tsValue: unknown;

  const rawValue = token.value;
  
  if (includeReferences && isAliasReference(rawValue)) {
    tsValue = rawValue;
    tsType = mapTokenType(token.type);
    
    const result: TokensStudioToken = {
      value: tsValue,
      type: tsType,
    };
    
    if (token.description) {
      result.description = token.description;
    }
    
    return result;
  }

  switch (token.type) {
    case 'color':
      tsType = 'color';
      tsValue = rawValue;
      break;

    case 'dimension':
    case 'spacing':
      tsType = 'dimension';
      tsValue = String(rawValue);
      break;

    case 'borderRadius':
      tsType = 'borderRadius';
      tsValue = String(rawValue);
      break;

    case 'borderWidth':
      tsType = 'borderWidth';
      tsValue = String(rawValue);
      break;

    case 'fontSize':
      tsType = 'fontSizes';
      tsValue = String(rawValue);
      break;

    case 'lineHeight':
      tsType = 'lineHeights';
      tsValue = String(rawValue);
      break;

    case 'letterSpacing':
      tsType = 'letterSpacing';
      tsValue = String(rawValue);
      break;

    case 'fontFamily':
      tsType = 'fontFamilies';
      tsValue = rawValue;
      break;

    case 'fontWeight':
      tsType = 'fontWeights';
      tsValue = rawValue;
      break;

    case 'shadow':
      tsType = 'boxShadow';
      tsValue = formatShadowForTokensStudio(rawValue);
      break;

    case 'opacity':
      tsType = 'opacity';
      tsValue = String(rawValue);
      break;

    case 'duration':
      tsType = 'duration';
      tsValue = String(rawValue);
      break;

    case 'cubicBezier':
      tsType = 'easing';
      tsValue = rawValue;
      break;

    case 'composition':
    case 'typography':
      tsType = 'typography';
      tsValue = formatTypographyForTokensStudio(rawValue, includeReferences);
      break;

    default:
      tsType = 'other';
      tsValue = rawValue;
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

function mapTokenType(type: string): string {
  const typeMap: Record<string, string> = {
    color: 'color',
    dimension: 'dimension',
    spacing: 'dimension',
    borderRadius: 'borderRadius',
    borderWidth: 'borderWidth',
    fontSize: 'fontSizes',
    lineHeight: 'lineHeights',
    letterSpacing: 'letterSpacing',
    fontFamily: 'fontFamilies',
    fontWeight: 'fontWeights',
    shadow: 'boxShadow',
    opacity: 'opacity',
    duration: 'duration',
    cubicBezier: 'easing',
    composition: 'typography',
    typography: 'typography',
  };
  return typeMap[type] || 'other';
}

function formatShadowForTokensStudio(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const shadow = value as Record<string, unknown>;
    return {
      x: String(shadow.offsetX ?? shadow.x ?? '0'),
      y: String(shadow.offsetY ?? shadow.y ?? '0'),
      blur: String(shadow.blur ?? '0'),
      spread: String(shadow.spread ?? '0'),
      color: String(shadow.color ?? '#000000'),
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

function formatTypographyForTokensStudio(value: unknown, includeReferences: boolean): unknown {
  if (typeof value === 'object' && value !== null) {
    const typo = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    
    if (typo.fontFamily !== undefined) {
      result.fontFamily = includeReferences && isAliasReference(typo.fontFamily) 
        ? typo.fontFamily 
        : typo.fontFamily;
    }
    if (typo.fontWeight !== undefined) {
      result.fontWeight = includeReferences && isAliasReference(typo.fontWeight)
        ? typo.fontWeight
        : typo.fontWeight;
    }
    if (typo.fontSize !== undefined) {
      result.fontSize = includeReferences && isAliasReference(typo.fontSize)
        ? typo.fontSize
        : typo.fontSize;
    }
    if (typo.lineHeight !== undefined) {
      result.lineHeight = includeReferences && isAliasReference(typo.lineHeight)
        ? typo.lineHeight
        : typo.lineHeight;
    }
    if (typo.letterSpacing !== undefined) {
      result.letterSpacing = includeReferences && isAliasReference(typo.letterSpacing)
        ? typo.letterSpacing
        : typo.letterSpacing;
    }
    if (typo.textCase ?? typo.textTransform) {
      result.textCase = typo.textCase ?? typo.textTransform;
    }
    if (typo.textDecoration !== undefined) {
      result.textDecoration = typo.textDecoration;
    }
    
    return result;
  }
  return value;
}
