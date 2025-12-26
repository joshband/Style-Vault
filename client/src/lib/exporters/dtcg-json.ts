/**
 * W3C DTCG JSON Exporter
 * 
 * Exports tokens in W3C Design Tokens Community Group 2025.10 format.
 * This is the canonical, vendor-neutral format.
 */

import type { ExporterDefinition, NormalizedTokenSet } from '../token-pipeline';

export const exportDTCGJson: ExporterDefinition = {
  id: 'dtcg-json',
  name: 'W3C DTCG JSON',
  description: 'Standard design token format (W3C 2025.10). Works with Style Dictionary, Figma Tokens, and other tools.',
  category: 'code',
  extension: 'tokens.json',
  mimeType: 'application/json',
  isBinary: false,
  serverSide: false,
  subOptions: [
    {
      id: 'includeDescriptions',
      label: 'Include descriptions',
      type: 'boolean',
      default: true,
    },
    {
      id: 'flatStructure',
      label: 'Flat structure (no nesting)',
      type: 'boolean',
      default: false,
    },
  ],
  export: (tokens: NormalizedTokenSet, options?: Record<string, any>): string => {
    const includeDescriptions = options?.includeDescriptions ?? true;
    const flatStructure = options?.flatStructure ?? false;
    
    if (flatStructure) {
      const flat: Record<string, any> = {};
      
      for (const token of tokens.tokens) {
        const tokenObj: any = {
          $value: token.value,
          $type: token.type,
        };
        
        if (includeDescriptions && token.description) {
          tokenObj.$description = token.description;
        }
        
        flat[token.name] = tokenObj;
      }
      
      return JSON.stringify({
        $schema: 'https://design-tokens.github.io/community-group/format/2025.10/schema.json',
        ...flat,
      }, null, 2);
    }
    
    const nested: Record<string, any> = {
      $schema: 'https://design-tokens.github.io/community-group/format/2025.10/schema.json',
    };
    
    for (const token of tokens.tokens) {
      let current = nested;
      
      for (let i = 0; i < token.path.length - 1; i++) {
        const key = token.path[i];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      
      const finalKey = token.path[token.path.length - 1];
      const tokenObj: any = {
        $value: token.value,
        $type: token.type,
      };
      
      if (includeDescriptions && token.description) {
        tokenObj.$description = token.description;
      }
      
      current[finalKey] = tokenObj;
    }
    
    return JSON.stringify(nested, null, 2);
  },
};
