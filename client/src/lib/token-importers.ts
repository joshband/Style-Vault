export type ImportFormat = 
  | 'dtcg'
  | 'figma'
  | 'tokens-studio'
  | 'css'
  | 'tailwind'
  | 'ase';

export interface ImportResult {
  success: boolean;
  tokens: any;
  name?: string;
  errors?: string[];
  stats?: TokenStats;
}

export interface TokenStats {
  colorCount: number;
  spacingCount: number;
  typographyCount: number;
  otherCount: number;
}

export function detectFormat(content: string, filename: string): ImportFormat | null {
  const ext = filename.toLowerCase().split('.').pop();
  
  if (ext === 'ase') return 'ase';
  if (ext === 'css') return 'css';
  
  if (ext === 'json' || ext === 'js') {
    try {
      const parsed = JSON.parse(content);
      
      if (parsed.variableCollections || parsed.variables) return 'figma';
      if (parsed.$themes || parsed.$metadata) return 'tokens-studio';
      if (parsed.theme?.extend || parsed.colors) return 'tailwind';
      if (parsed.color || parsed.spacing || parsed.typography) return 'dtcg';
      if (hasTokenStructure(parsed)) return 'dtcg';
      
      return 'dtcg';
    } catch {
      if (content.includes('module.exports') || content.includes('tailwind')) {
        return 'tailwind';
      }
    }
  }
  
  return null;
}

function hasTokenStructure(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const values = Object.values(obj);
  return values.some((v: any) => v && typeof v === 'object' && ('$value' in v || 'value' in v));
}

export function countTokens(tokens: any): TokenStats {
  const stats: TokenStats = { colorCount: 0, spacingCount: 0, typographyCount: 0, otherCount: 0 };
  
  const countInCategory = (obj: any): number => {
    let count = 0;
    const traverse = (o: any) => {
      for (const [key, value] of Object.entries(o)) {
        if (key.startsWith('$')) continue;
        if (value && typeof value === 'object') {
          if ('$value' in value || 'value' in value) {
            count++;
          } else {
            traverse(value);
          }
        }
      }
    };
    traverse(obj);
    return count;
  };
  
  if (tokens.color) stats.colorCount = countInCategory(tokens.color);
  if (tokens.spacing) stats.spacingCount = countInCategory(tokens.spacing);
  if (tokens.typography) stats.typographyCount = countInCategory(tokens.typography);
  
  for (const key of Object.keys(tokens)) {
    if (!['color', 'spacing', 'typography'].includes(key)) {
      stats.otherCount += countInCategory(tokens[key]);
    }
  }
  
  return stats;
}

export function importTokens(content: string, format: ImportFormat, filename?: string): ImportResult {
  try {
    const result = (() => {
      switch (format) {
        case 'dtcg':
          return importDTCG(content, filename);
        case 'figma':
          return importFigma(content, filename);
        case 'tokens-studio':
          return importTokensStudio(content, filename);
        case 'css':
          return importCSS(content, filename);
        case 'tailwind':
          return importTailwind(content, filename);
        case 'ase':
          return { success: false, tokens: {}, errors: ['ASE binary format requires server-side parsing'] };
        default:
          return { success: false, tokens: {}, errors: [`Unsupported format: ${format}`] };
      }
    })();
    
    if (result.success) {
      result.stats = countTokens(result.tokens);
    }
    
    return result;
  } catch (error) {
    return { 
      success: false, 
      tokens: {}, 
      errors: [error instanceof Error ? error.message : 'Unknown parsing error'] 
    };
  }
}

function importDTCG(content: string, filename?: string): ImportResult {
  const parsed = JSON.parse(content);
  
  if (parsed.color || parsed.spacing || parsed.typography || parsed.shadow || parsed.borderRadius) {
    return {
      success: true,
      tokens: parsed,
      name: filename?.replace(/\.(json|tokens)$/i, '').replace(/[-_]/g, ' '),
    };
  }
  
  const tokens: any = {};
  const traverse = (obj: any, path: string[] = []) => {
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('$')) continue;
      if (value && typeof value === 'object') {
        if ('$value' in value) {
          let current = tokens;
          for (const segment of path) {
            current[segment] = current[segment] || {};
            current = current[segment];
          }
          current[key] = value;
        } else {
          traverse(value, [...path, key]);
        }
      }
    }
  };
  traverse(parsed);
  
  return {
    success: Object.keys(tokens).length > 0,
    tokens,
    name: filename?.replace(/\.(json|tokens)$/i, '').replace(/[-_]/g, ' '),
    errors: Object.keys(tokens).length === 0 ? ['No valid tokens found in file'] : undefined,
  };
}

function importFigma(content: string, filename?: string): ImportResult {
  const parsed = JSON.parse(content);
  const tokens: any = { color: {}, spacing: {}, typography: {} };
  
  const variables = parsed.variables || [];
  const meta = parsed.meta || {};
  
  for (const variable of variables) {
    const { name, resolvedType, valuesByMode } = variable;
    if (!name || !valuesByMode) continue;
    
    const modeId = Object.keys(valuesByMode)[0];
    const value = valuesByMode[modeId];
    
    const pathParts = name.split('/');
    const tokenName = pathParts.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
    const category = pathParts[0]?.toLowerCase() || 'misc';
    
    if (resolvedType === 'COLOR') {
      const hex = figmaColorToHex(value);
      tokens.color[tokenName] = { $type: 'color', $value: hex };
    } else if (resolvedType === 'FLOAT') {
      if (category.includes('spacing') || category.includes('size') || category.includes('gap') || category.includes('padding') || category.includes('margin')) {
        tokens.spacing[tokenName] = { $type: 'dimension', $value: `${value}px` };
      }
    }
  }
  
  const hasTokens = Object.keys(tokens.color).length > 0 || 
                    Object.keys(tokens.spacing).length > 0;
  
  return {
    success: hasTokens,
    tokens: cleanEmptyObjects(tokens),
    name: meta.name || filename?.replace(/\.(json)$/i, '').replace(/[-_]/g, ' '),
    errors: hasTokens ? undefined : ['No compatible variables found in Figma export'],
  };
}

function figmaColorToHex(color: any): string {
  if (typeof color === 'string') return color;
  if (!color || typeof color !== 'object') return '#000000';
  
  const r = Math.round((color.r || 0) * 255);
  const g = Math.round((color.g || 0) * 255);
  const b = Math.round((color.b || 0) * 255);
  const a = color.a !== undefined ? color.a : 1;
  
  if (a < 1) {
    const alpha = Math.round(a * 255).toString(16).padStart(2, '0');
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${alpha}`;
  }
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function importTokensStudio(content: string, filename?: string): ImportResult {
  const parsed = JSON.parse(content);
  const tokens: any = { color: {}, spacing: {}, typography: {}, borderRadius: {} };
  
  const tokenSets = parsed.$themes ? 
    Object.keys(parsed).filter(k => !k.startsWith('$')) :
    Object.keys(parsed).filter(k => !k.startsWith('$'));
  
  if (tokenSets.length === 0) {
    processTokensStudioSet(parsed, tokens, '');
  } else {
    for (const setName of tokenSets) {
      const set = parsed[setName];
      if (!set || typeof set !== 'object') continue;
      processTokensStudioSet(set, tokens, '');
    }
  }
  
  const hasTokens = Object.keys(tokens.color).length > 0 || 
                    Object.keys(tokens.spacing).length > 0;
  
  return {
    success: hasTokens,
    tokens: cleanEmptyObjects(tokens),
    name: parsed.$metadata?.tokenSetOrder?.[0] || filename?.replace(/\.(json)$/i, '').replace(/[-_]/g, ' '),
    errors: hasTokens ? undefined : ['No compatible tokens found in Tokens Studio export'],
  };
}

function processTokensStudioSet(set: any, tokens: any, path: string) {
  for (const [key, value] of Object.entries(set)) {
    if (key.startsWith('$')) continue;
    
    const currentPath = path ? `${path}_${key}` : key;
    
    if (value && typeof value === 'object') {
      const hasValue = 'value' in value || '$value' in value;
      
      if (hasValue) {
        const tokenValue = (value as any).value ?? (value as any).$value;
        const tokenType = ((value as any).type || (value as any).$type || '').toLowerCase();
        
        const isColor = tokenType === 'color' || isColorValue(tokenValue);
        const isSpacing = tokenType === 'spacing' || tokenType === 'dimension' || tokenType === 'sizing' ||
          key.toLowerCase().includes('spacing') || key.toLowerCase().includes('size') ||
          key.toLowerCase().includes('gap') || key.toLowerCase().includes('padding') ||
          key.toLowerCase().includes('margin') || isNumericDimension(tokenValue);
        const isBorderRadius = tokenType === 'borderradius' || tokenType === 'border-radius' ||
          key.toLowerCase().includes('radius');
        const isTypography = tokenType === 'typography' || tokenType === 'fontfamily' || 
          tokenType === 'fontsize' || tokenType === 'fontweight' ||
          key.toLowerCase().includes('font') || key.toLowerCase().includes('text');
        
        if (isColor) {
          tokens.color[currentPath] = { $type: 'color', $value: tokenValue };
        } else if (isBorderRadius) {
          tokens.borderRadius[currentPath] = { $type: 'dimension', $value: normalizeValue(tokenValue) };
        } else if (isSpacing) {
          tokens.spacing[currentPath] = { $type: 'dimension', $value: normalizeValue(tokenValue) };
        } else if (isTypography) {
          tokens.typography[currentPath] = { $type: tokenType || 'string', $value: tokenValue };
        }
      } else {
        processTokensStudioSet(value, tokens, currentPath);
      }
    }
  }
}

function isNumericDimension(value: any): boolean {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  return /^\d+(\.\d+)?(px|rem|em|%)?$/.test(value.trim());
}

function normalizeValue(value: any): string {
  if (typeof value === 'number') return `${value}px`;
  return String(value);
}

function isColorValue(value: any): boolean {
  if (typeof value !== 'string') return false;
  return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgb/.test(value) || /^hsl/.test(value);
}

function importCSS(content: string, filename?: string): ImportResult {
  const tokens: any = { color: {}, spacing: {} };
  
  const varRegex = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let match;
  
  while ((match = varRegex.exec(content)) !== null) {
    const [, name, value] = match;
    const cleanValue = value.trim();
    const tokenName = name.replace(/-/g, '_');
    
    if (isColorValue(cleanValue)) {
      tokens.color[tokenName] = { $type: 'color', $value: cleanValue };
    } else if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(cleanValue)) {
      tokens.spacing[tokenName] = { $type: 'dimension', $value: cleanValue };
    }
  }
  
  const hasTokens = Object.keys(tokens.color).length > 0 || 
                    Object.keys(tokens.spacing).length > 0;
  
  return {
    success: hasTokens,
    tokens: cleanEmptyObjects(tokens),
    name: filename?.replace(/\.css$/i, '').replace(/[-_]/g, ' '),
    errors: hasTokens ? undefined : ['No CSS custom properties found'],
  };
}

function importTailwind(content: string, filename?: string): ImportResult {
  const tokens: any = { color: {}, spacing: {} };
  
  let configObj: any = null;
  
  try {
    configObj = JSON.parse(content);
  } catch {
    const exportMatch = content.match(/(?:module\.exports|export default)\s*=\s*(\{[\s\S]*\})/);
    if (exportMatch) {
      try {
        const cleanedConfig = exportMatch[1]
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*/g, '')
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/require\([^)]+\)/g, '{}')
          .replace(/\.\.\.[^,}]+/g, '');
        configObj = Function(`return ${cleanedConfig}`)();
      } catch {}
    }
  }
  
  if (!configObj) {
    return { success: false, tokens: {}, errors: ['Could not parse Tailwind config'] };
  }
  
  const colors = configObj.theme?.colors || configObj.theme?.extend?.colors || configObj.colors;
  if (colors) {
    extractTailwindColors(colors, tokens.color);
  }
  
  const spacing = configObj.theme?.spacing || configObj.theme?.extend?.spacing || configObj.spacing;
  if (spacing) {
    extractTailwindSpacing(spacing, tokens.spacing);
  }
  
  const hasTokens = Object.keys(tokens.color).length > 0 || 
                    Object.keys(tokens.spacing).length > 0;
  
  return {
    success: hasTokens,
    tokens: cleanEmptyObjects(tokens),
    name: filename?.replace(/\.(js|json|ts)$/i, '').replace(/[-_]/g, ' '),
    errors: hasTokens ? undefined : ['No colors or spacing found in Tailwind config'],
  };
}

function extractTailwindColors(colors: any, target: any, prefix = '') {
  for (const [key, value] of Object.entries(colors)) {
    if (key === 'DEFAULT') {
      if (typeof value === 'string' && isColorValue(value)) {
        target[prefix || 'default'] = { $type: 'color', $value: value };
      }
      continue;
    }
    
    const name = prefix ? `${prefix}_${key}` : key;
    
    if (typeof value === 'string') {
      if (isColorValue(value)) {
        target[name] = { $type: 'color', $value: value };
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      extractTailwindColors(value, target, name);
    }
  }
}

function extractTailwindSpacing(spacing: any, target: any, prefix = '') {
  for (const [key, value] of Object.entries(spacing)) {
    const name = prefix ? `${prefix}_${key}` : key;
    
    if (typeof value === 'string') {
      target[name] = { $type: 'dimension', $value: value };
    } else if (typeof value === 'number') {
      target[name] = { $type: 'dimension', $value: `${value}px` };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      extractTailwindSpacing(value, target, name);
    }
  }
}

function cleanEmptyObjects(obj: any): any {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && Object.keys(value).length > 0) {
      result[key] = value;
    }
  }
  return result;
}

export const SUPPORTED_FORMATS: { id: ImportFormat; name: string; extensions: string[]; description: string }[] = [
  { id: 'dtcg', name: 'W3C DTCG', extensions: ['.json', '.tokens'], description: 'Design Tokens Community Group standard format' },
  { id: 'figma', name: 'Figma Variables', extensions: ['.json'], description: 'Exported from Figma Variables panel' },
  { id: 'tokens-studio', name: 'Tokens Studio', extensions: ['.json'], description: 'Exported from Tokens Studio for Figma' },
  { id: 'css', name: 'CSS Variables', extensions: ['.css'], description: 'CSS custom properties (--variable-name)' },
  { id: 'tailwind', name: 'Tailwind Config', extensions: ['.js', '.json'], description: 'Tailwind CSS configuration file' },
  { id: 'ase', name: 'Adobe Swatch', extensions: ['.ase'], description: 'Adobe Swatch Exchange format' },
];
