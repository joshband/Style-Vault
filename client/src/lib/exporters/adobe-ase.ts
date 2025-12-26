/**
 * Adobe ASE (Adobe Swatch Exchange) Exporter
 * 
 * Exports color tokens as Adobe ASE binary format for Photoshop, Illustrator, InDesign.
 * ASE is the native swatch exchange format supported by all Adobe Creative Cloud apps.
 */

import type { ExporterDefinition, NormalizedTokenSet } from '../token-pipeline';
import { parseColor } from '../token-pipeline';

export const exportAdobeASE: ExporterDefinition = {
  id: 'adobe-ase',
  name: 'Adobe ASE Swatches',
  description: 'Native swatch format for Photoshop, Illustrator, and InDesign.',
  category: 'design-tool',
  extension: 'ase',
  mimeType: 'application/octet-stream',
  isBinary: true,
  serverSide: false,
  subOptions: [
    {
      id: 'colorSpace',
      label: 'Color space',
      type: 'select',
      default: 'rgb',
      options: [
        { value: 'rgb', label: 'RGB' },
        { value: 'lab', label: 'LAB (more accurate)' },
      ],
    },
  ],
  export: (tokens: NormalizedTokenSet, options?: Record<string, any>): Uint8Array => {
    const colorTokens = tokens.groups.color;
    
    const chunks: Uint8Array[] = [];
    
    chunks.push(new TextEncoder().encode('ASEF'));
    
    const version = new Uint8Array(4);
    version[0] = 0; version[1] = 1; version[2] = 0; version[3] = 0;
    chunks.push(version);
    
    const blockCountBytes = new Uint8Array(4);
    const blockCount = colorTokens.length + 2;
    blockCountBytes[0] = (blockCount >> 24) & 0xFF;
    blockCountBytes[1] = (blockCount >> 16) & 0xFF;
    blockCountBytes[2] = (blockCount >> 8) & 0xFF;
    blockCountBytes[3] = blockCount & 0xFF;
    chunks.push(blockCountBytes);
    
    chunks.push(createGroupStart(tokens.name));
    
    for (const token of colorTokens) {
      if (typeof token.value === 'string') {
        const parsed = parseColor(token.value);
        if (parsed) {
          const colorName = token.path.join(' / ');
          chunks.push(createColorEntry(colorName, parsed.r / 255, parsed.g / 255, parsed.b / 255));
        }
      }
    }
    
    chunks.push(createGroupEnd());
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  },
};

function createGroupStart(name: string): Uint8Array {
  const nameUtf16 = encodeUTF16BE(name + '\0');
  const nameLength = nameUtf16.length / 2;
  
  const blockLength = 2 + nameUtf16.length;
  
  const result = new Uint8Array(2 + 4 + blockLength);
  let offset = 0;
  
  result[offset++] = 0xC0;
  result[offset++] = 0x01;
  
  result[offset++] = (blockLength >> 24) & 0xFF;
  result[offset++] = (blockLength >> 16) & 0xFF;
  result[offset++] = (blockLength >> 8) & 0xFF;
  result[offset++] = blockLength & 0xFF;
  
  result[offset++] = (nameLength >> 8) & 0xFF;
  result[offset++] = nameLength & 0xFF;
  
  result.set(nameUtf16, offset);
  
  return result;
}

function createGroupEnd(): Uint8Array {
  return new Uint8Array([0xC0, 0x02, 0x00, 0x00, 0x00, 0x00]);
}

function createColorEntry(name: string, r: number, g: number, b: number): Uint8Array {
  const nameUtf16 = encodeUTF16BE(name + '\0');
  const nameLength = nameUtf16.length / 2;
  
  const colorModel = new TextEncoder().encode('RGB ');
  
  const blockLength = 2 + nameUtf16.length + 4 + 12 + 2;
  
  const result = new Uint8Array(2 + 4 + blockLength);
  let offset = 0;
  
  result[offset++] = 0x00;
  result[offset++] = 0x01;
  
  result[offset++] = (blockLength >> 24) & 0xFF;
  result[offset++] = (blockLength >> 16) & 0xFF;
  result[offset++] = (blockLength >> 8) & 0xFF;
  result[offset++] = blockLength & 0xFF;
  
  result[offset++] = (nameLength >> 8) & 0xFF;
  result[offset++] = nameLength & 0xFF;
  
  result.set(nameUtf16, offset);
  offset += nameUtf16.length;
  
  result.set(colorModel, offset);
  offset += 4;
  
  const rBytes = floatToBytes(r);
  const gBytes = floatToBytes(g);
  const bBytes = floatToBytes(b);
  result.set(rBytes, offset); offset += 4;
  result.set(gBytes, offset); offset += 4;
  result.set(bBytes, offset); offset += 4;
  
  result[offset++] = 0x00;
  result[offset++] = 0x02;
  
  return result;
}

function encodeUTF16BE(str: string): Uint8Array {
  const result = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    result[i * 2] = (code >> 8) & 0xFF;
    result[i * 2 + 1] = code & 0xFF;
  }
  return result;
}

function floatToBytes(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, false);
  return new Uint8Array(buffer);
}
