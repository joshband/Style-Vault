/**
 * Figma Variables Exporter
 * 
 * Exports tokens in Figma Variables JSON format for plugin import.
 */

import type { ExporterDefinition, NormalizedTokenSet } from '../token-pipeline';
import { parseColor } from '../token-pipeline';

export const exportFigmaVariables: ExporterDefinition = {
  id: 'figma-variables',
  name: 'Figma Variables',
  description: 'JSON format compatible with Figma Variables plugin for direct import.',
  category: 'design-tool',
  extension: 'json',
  mimeType: 'application/json',
  isBinary: false,
  serverSide: false,
  subOptions: [
    {
      id: 'createCollection',
      label: 'Create variable collection',
      type: 'boolean',
      default: true,
    },
  ],
  export: (tokens: NormalizedTokenSet, options?: Record<string, any>): string => {
    const collectionId = `collection_${Date.now()}`;
    const modeId = `mode_${Date.now()}`;
    
    const collections = [{
      id: collectionId,
      name: tokens.name,
      modes: [{ modeId, name: 'Default' }],
      defaultModeId: modeId,
      remote: false,
      hiddenFromPublishing: false,
    }];
    
    const variables: any[] = [];
    
    for (const token of tokens.tokens) {
      const variableId = `var_${token.path.join('_')}_${Date.now()}`;
      const name = token.path.join('/');
      
      let resolvedType = 'STRING';
      let resolvedValue = token.value;
      
      if (token.type === 'color') {
        resolvedType = 'COLOR';
        const parsed = typeof token.value === 'string' ? parseColor(token.value) : null;
        if (parsed) {
          resolvedValue = {
            r: parsed.r / 255,
            g: parsed.g / 255,
            b: parsed.b / 255,
            a: parsed.a,
          };
        }
      } else if (['dimension', 'spacing', 'borderRadius', 'number'].includes(token.type)) {
        resolvedType = 'FLOAT';
        resolvedValue = parseFloat(String(token.value).replace(/[^\d.-]/g, '')) || 0;
      } else if (typeof token.value === 'number') {
        resolvedType = 'FLOAT';
        resolvedValue = token.value;
      } else if (typeof token.value === 'boolean') {
        resolvedType = 'BOOLEAN';
        resolvedValue = token.value;
      } else {
        resolvedType = 'STRING';
        resolvedValue = String(token.value);
      }
      
      variables.push({
        id: variableId,
        name,
        resolvedType,
        valuesByMode: {
          [modeId]: resolvedValue,
        },
        remote: false,
        description: token.description || '',
        hiddenFromPublishing: false,
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
      });
    }
    
    const figmaExport = {
      version: '1.0',
      meta: {
        name: tokens.name,
        generator: 'Visual DNA Studio',
        exportedAt: tokens.metadata.exportedAt,
      },
      variableCollections: collections,
      variables,
    };
    
    return JSON.stringify(figmaExport, null, 2);
  },
};
