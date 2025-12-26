/**
 * Token Pipeline Architecture
 * 
 * This module provides a modular, extensible architecture for design token exports.
 * Following W3C DTCG 2025.10 specification.
 * 
 * Pipeline stages:
 * 1. Normalization - Convert any input to DTCG-compliant structure
 * 2. Alias Resolution - Resolve all {} references
 * 3. Transformation - Convert to target format
 */

// =============================================================================
// DTCG Types (W3C Design Tokens Community Group 2025.10)
// =============================================================================

export type DTCGTokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'strokeStyle'
  | 'border'
  | 'transition'
  | 'shadow'
  | 'gradient'
  | 'typography'
  | 'fontStyle';

export interface DTCGToken {
  $value: any;
  $type?: DTCGTokenType;
  $description?: string;
  $extensions?: Record<string, any>;
}

export interface DTCGGroup {
  $type?: DTCGTokenType;
  $description?: string;
  [key: string]: DTCGToken | DTCGGroup | string | undefined;
}

export interface DTCGFile {
  $schema?: string;
  [key: string]: DTCGToken | DTCGGroup | string | undefined;
}

// =============================================================================
// Normalized Token (Internal representation)
// =============================================================================

export interface NormalizedToken {
  path: string[];
  name: string;
  value: any;
  originalValue: any;
  type: DTCGTokenType | string;
  description?: string;
  isAlias: boolean;
  aliasPath?: string[];
  extensions?: Record<string, any>;
}

export interface NormalizedTokenSet {
  name: string;
  version: string;
  tokens: NormalizedToken[];
  groups: {
    color: NormalizedToken[];
    dimension: NormalizedToken[];
    typography: NormalizedToken[];
    spacing: NormalizedToken[];
    other: NormalizedToken[];
  };
  metadata: {
    generator: string;
    exportedAt: string;
    tokenCount: number;
    hasAliases: boolean;
  };
}

// =============================================================================
// Exporter Registry Types
// =============================================================================

export interface ExporterDefinition {
  id: string;
  name: string;
  description: string;
  category: 'design-tool' | 'web' | 'mobile' | 'game-engine' | 'code';
  extension: string;
  mimeType: string;
  isBinary: boolean;
  serverSide: boolean;
  subOptions?: ExporterSubOption[];
  export: (tokens: NormalizedTokenSet, options?: Record<string, any>) => string | Uint8Array;
}

export interface ExporterSubOption {
  id: string;
  label: string;
  type: 'boolean' | 'select' | 'text';
  default: any;
  options?: { value: string; label: string }[];
}

export interface ExportResult {
  content: string | Uint8Array;
  filename: string;
  mimeType: string;
  isBinary: boolean;
}

// =============================================================================
// Token Normalization
// =============================================================================

const ALIAS_PATTERN = /^\{([^}]+)\}$/;

export function isAlias(value: any): boolean {
  return typeof value === 'string' && ALIAS_PATTERN.test(value);
}

export function parseAliasPath(value: string): string[] | null {
  const match = value.match(ALIAS_PATTERN);
  if (!match) return null;
  return match[1].split('.');
}

export function inferTokenType(key: string, value: any, parentType?: string): DTCGTokenType | string {
  if (parentType) return parentType;
  
  const keyLower = key.toLowerCase();
  
  if (typeof value === 'string') {
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return 'color';
    if (/^(rgb|rgba|hsl|hsla|oklch|oklab)\(/.test(value)) return 'color';
    if (/^-?\d+(\.\d+)?(px|rem|em|%|pt|dp|sp)$/.test(value)) return 'dimension';
    if (/^-?\d+(\.\d+)?(ms|s)$/.test(value)) return 'duration';
  }
  
  if (keyLower.includes('color') || keyLower.includes('background') || keyLower.includes('foreground')) {
    return 'color';
  }
  if (keyLower.includes('spacing') || keyLower.includes('padding') || keyLower.includes('margin') || keyLower.includes('gap')) {
    return 'dimension';
  }
  if (keyLower.includes('radius') || keyLower.includes('size') || keyLower.includes('width') || keyLower.includes('height')) {
    return 'dimension';
  }
  if (keyLower.includes('font') && keyLower.includes('family')) {
    return 'fontFamily';
  }
  if (keyLower.includes('font') && keyLower.includes('weight')) {
    return 'fontWeight';
  }
  if (keyLower.includes('duration') || keyLower.includes('delay')) {
    return 'duration';
  }
  if (keyLower.includes('shadow')) {
    return 'shadow';
  }
  
  if (typeof value === 'number') return 'number';
  
  return 'string';
}

export function normalizeTokens(
  tokens: Record<string, any>,
  styleName: string
): NormalizedTokenSet {
  const normalized: NormalizedToken[] = [];
  
  function traverse(obj: any, path: string[] = [], inheritedType?: DTCGTokenType) {
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('$')) continue;
      
      const currentPath = [...path, key];
      const groupType = obj.$type || inheritedType;
      
      if (value && typeof value === 'object') {
        if ('$value' in value) {
          const token = value as DTCGToken;
          const tokenType = token.$type || groupType || inferTokenType(key, token.$value);
          const aliasPath = isAlias(token.$value) ? parseAliasPath(token.$value) : null;
          
          normalized.push({
            path: currentPath,
            name: currentPath.join('.'),
            value: token.$value,
            originalValue: token.$value,
            type: tokenType,
            description: token.$description,
            isAlias: !!aliasPath,
            aliasPath: aliasPath || undefined,
            extensions: token.$extensions,
          });
        } else {
          traverse(value, currentPath, groupType as DTCGTokenType);
        }
      } else if (value !== undefined && value !== null) {
        const tokenType = groupType || inferTokenType(key, value);
        const aliasPath = typeof value === 'string' && isAlias(value) ? parseAliasPath(value) : null;
        
        normalized.push({
          path: currentPath,
          name: currentPath.join('.'),
          value,
          originalValue: value,
          type: tokenType,
          isAlias: !!aliasPath,
          aliasPath: aliasPath || undefined,
        });
      }
    }
  }
  
  traverse(tokens);
  
  const groups = {
    color: normalized.filter(t => t.type === 'color'),
    dimension: normalized.filter(t => t.type === 'dimension'),
    typography: normalized.filter(t => 
      ['fontFamily', 'fontWeight', 'fontStyle', 'typography'].includes(t.type)
    ),
    spacing: normalized.filter(t => 
      t.path.some(p => p.toLowerCase().includes('spacing'))
    ),
    other: normalized.filter(t => 
      !['color', 'dimension', 'fontFamily', 'fontWeight', 'fontStyle', 'typography'].includes(t.type) &&
      !t.path.some(p => p.toLowerCase().includes('spacing'))
    ),
  };
  
  return {
    name: styleName,
    version: '1.0.0',
    tokens: normalized,
    groups,
    metadata: {
      generator: 'Visual DNA Studio',
      exportedAt: new Date().toISOString(),
      tokenCount: normalized.length,
      hasAliases: normalized.some(t => t.isAlias),
    },
  };
}

// =============================================================================
// Alias Resolution
// =============================================================================

export function resolveAliases(tokenSet: NormalizedTokenSet): NormalizedTokenSet {
  const tokenMap = new Map<string, NormalizedToken>();
  
  for (const token of tokenSet.tokens) {
    tokenMap.set(token.name, token);
  }
  
  function resolveValue(token: NormalizedToken, visited: Set<string> = new Set()): any {
    if (!token.isAlias || !token.aliasPath) {
      return token.value;
    }
    
    const aliasName = token.aliasPath.join('.');
    
    if (visited.has(aliasName)) {
      console.warn(`Circular alias detected: ${token.name} -> ${aliasName}`);
      return token.originalValue;
    }
    
    const referenced = tokenMap.get(aliasName);
    if (!referenced) {
      console.warn(`Alias target not found: ${aliasName}`);
      return token.originalValue;
    }
    
    visited.add(token.name);
    return resolveValue(referenced, visited);
  }
  
  const resolved: NormalizedToken[] = tokenSet.tokens.map(token => ({
    ...token,
    value: resolveValue(token),
  }));
  
  return {
    ...tokenSet,
    tokens: resolved,
    groups: {
      color: resolved.filter(t => t.type === 'color'),
      dimension: resolved.filter(t => t.type === 'dimension'),
      typography: resolved.filter(t => 
        ['fontFamily', 'fontWeight', 'fontStyle', 'typography'].includes(t.type)
      ),
      spacing: resolved.filter(t => 
        t.path.some(p => p.toLowerCase().includes('spacing'))
      ),
      other: resolved.filter(t => 
        !['color', 'dimension', 'fontFamily', 'fontWeight', 'fontStyle', 'typography'].includes(t.type) &&
        !t.path.some(p => p.toLowerCase().includes('spacing'))
      ),
    },
  };
}

// =============================================================================
// Shared Utilities
// =============================================================================

export function sanitizeCssName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sanitizeJsName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return /^[0-9]/.test(cleaned) ? '_' + cleaned : cleaned;
}

export function toCamelCase(name: string): string {
  return name
    .split(/[-_\s.]+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function toPascalCase(name: string): string {
  return name
    .split(/[-_\s.]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

// =============================================================================
// Color Utilities
// =============================================================================

export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(value: string): RGBAColor | null {
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    let r = 0, g = 0, b = 0, a = 1;
    
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      a = parseInt(hex.slice(6, 8), 16) / 255;
    }
    
    return { r, g, b, a };
  }
  
  if (value.startsWith('rgb')) {
    const match = value.match(/[\d.]+/g);
    if (match) {
      return {
        r: parseInt(match[0]),
        g: parseInt(match[1]),
        b: parseInt(match[2]),
        a: match[3] ? parseFloat(match[3]) : 1,
      };
    }
  }
  
  return null;
}

export function rgbaToHex(color: RGBAColor, includeAlpha = false): string {
  const r = Math.round(color.r).toString(16).padStart(2, '0');
  const g = Math.round(color.g).toString(16).padStart(2, '0');
  const b = Math.round(color.b).toString(16).padStart(2, '0');
  
  if (includeAlpha && color.a < 1) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }
  
  return `#${r}${g}${b}`;
}

export function rgbaToCSS(color: RGBAColor): string {
  if (color.a < 1) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a.toFixed(2)})`;
  }
  return rgbaToHex(color);
}

export function colorToUIColor(color: RGBAColor): string {
  const r = (color.r / 255).toFixed(3);
  const g = (color.g / 255).toFixed(3);
  const b = (color.b / 255).toFixed(3);
  const a = color.a.toFixed(3);
  return `UIColor(red: ${r}, green: ${g}, blue: ${b}, alpha: ${a})`;
}

export function colorToSwiftUI(color: RGBAColor): string {
  const r = (color.r / 255).toFixed(3);
  const g = (color.g / 255).toFixed(3);
  const b = (color.b / 255).toFixed(3);
  const a = color.a.toFixed(3);
  return `Color(red: ${r}, green: ${g}, blue: ${b}, opacity: ${a})`;
}

export function colorToFlutter(color: RGBAColor): string {
  const hex = rgbaToHex(color, true).slice(1).toUpperCase();
  if (hex.length === 6) {
    return `Color(0xFF${hex})`;
  }
  const alpha = hex.slice(6, 8);
  const rgb = hex.slice(0, 6);
  return `Color(0x${alpha}${rgb})`;
}

export function colorToUnity(color: RGBAColor): string {
  const r = (color.r / 255).toFixed(3);
  const g = (color.g / 255).toFixed(3);
  const b = (color.b / 255).toFixed(3);
  const a = color.a.toFixed(3);
  return `new Color(${r}f, ${g}f, ${b}f, ${a}f)`;
}

// =============================================================================
// Dimension Utilities
// =============================================================================

export function parseDimension(value: string | number): { value: number; unit: string } | null {
  if (typeof value === 'number') {
    return { value, unit: 'px' };
  }
  
  const match = value.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|pt|dp|sp|vw|vh)?$/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2] || 'px',
    };
  }
  
  return null;
}

export function dimensionToCSS(value: string | number): string {
  const parsed = parseDimension(value);
  if (!parsed) return String(value);
  return `${parsed.value}${parsed.unit}`;
}

export function dimensionToPx(value: string | number, baseFontSize = 16): number {
  const parsed = parseDimension(value);
  if (!parsed) return 0;
  
  switch (parsed.unit) {
    case 'rem':
    case 'em':
      return parsed.value * baseFontSize;
    case 'pt':
      return parsed.value * (96 / 72);
    default:
      return parsed.value;
  }
}

// =============================================================================
// Exporter Registry
// =============================================================================

const exporterRegistry = new Map<string, ExporterDefinition>();

export function registerExporter(exporter: ExporterDefinition): void {
  exporterRegistry.set(exporter.id, exporter);
}

export function getExporter(id: string): ExporterDefinition | undefined {
  return exporterRegistry.get(id);
}

export function getAllExporters(): ExporterDefinition[] {
  return Array.from(exporterRegistry.values());
}

export function getExportersByCategory(category: ExporterDefinition['category']): ExporterDefinition[] {
  return getAllExporters().filter(e => e.category === category);
}

// =============================================================================
// Export Pipeline
// =============================================================================

export function exportTokens(
  rawTokens: Record<string, any>,
  styleName: string,
  exporterId: string,
  options?: Record<string, any>
): ExportResult {
  const exporter = getExporter(exporterId);
  if (!exporter) {
    throw new Error(`Unknown exporter: ${exporterId}`);
  }
  
  const normalized = normalizeTokens(rawTokens, styleName);
  const resolved = resolveAliases(normalized);
  const content = exporter.export(resolved, options);
  
  const safeStyleName = styleName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return {
    content,
    filename: `${safeStyleName}.${exporter.extension}`,
    mimeType: exporter.mimeType,
    isBinary: exporter.isBinary,
  };
}

export function downloadExportResult(result: ExportResult): void {
  const blob = result.isBinary
    ? new Blob([result.content as Uint8Array], { type: result.mimeType })
    : new Blob([result.content as string], { type: result.mimeType });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
