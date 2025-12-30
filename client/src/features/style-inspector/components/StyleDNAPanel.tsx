import { useMemo } from "react";
import { Palette, Space, Type, Sparkles, Maximize2, Layers, Droplets } from "lucide-react";

interface Token {
  $type: string;
  $value: string | number;
  $description?: string;
  $extensions?: {
    visualDNA?: {
      method: string;
      source: string;
      confidence: number;
    };
  };
}

interface TokenGroup {
  [key: string]: Token | TokenGroup;
}

interface StyleDNAPanelProps {
  tokens: Record<string, TokenGroup | Token>;
}

function oklchToHex(oklch: string): string {
  const match = oklch.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) return oklch.startsWith('#') ? oklch : '#888888';
  
  const [, L, C, H] = match.map(Number);
  const l = L;
  const c = C;
  const h = (H * Math.PI) / 180;
  
  const a_ = c * Math.cos(h);
  const b_ = c * Math.sin(h);
  
  const L_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
  const M_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
  const S_ = l - 0.0894841775 * a_ - 1.2914855480 * b_;
  
  const L3 = L_ * L_ * L_;
  const M3 = M_ * M_ * M_;
  const S3 = S_ * S_ * S_;
  
  let r = +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
  let g = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
  let b = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.7076147010 * S3;
  
  const toSrgb = (x: number) => {
    if (x <= 0.0031308) return x * 12.92;
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  
  r = Math.round(Math.max(0, Math.min(1, toSrgb(r))) * 255);
  g = Math.round(Math.max(0, Math.min(1, toSrgb(g))) * 255);
  b = Math.round(Math.max(0, Math.min(1, toSrgb(b))) * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function isToken(value: unknown): value is Token {
  return value !== null && typeof value === 'object' && '$type' in value && '$value' in value;
}

function extractColorTokens(tokens: Record<string, TokenGroup | Token>): Array<{ name: string; hex: string; confidence?: number }> {
  const colors: Array<{ name: string; hex: string; confidence?: number }> = [];
  const colorGroup = tokens.color;
  
  if (!colorGroup || typeof colorGroup !== 'object') return colors;
  
  const roleOrder = ['primary', 'secondary', 'tertiary', 'accent', 'background', 'surface', 'neutral', 'muted'];
  
  for (const role of roleOrder) {
    if (role in colorGroup) {
      const token = (colorGroup as TokenGroup)[role];
      if (isToken(token) && token.$type === 'color') {
        const value = String(token.$value);
        const hex = value.startsWith('oklch') ? oklchToHex(value) : value;
        colors.push({
          name: role,
          hex,
          confidence: token.$extensions?.visualDNA?.confidence,
        });
      }
    }
  }
  
  return colors.slice(0, 8);
}

function extractSpacingTokens(tokens: Record<string, TokenGroup | Token>): Array<{ name: string; value: string }> {
  const spacing: Array<{ name: string; value: string }> = [];
  const spacingGroup = tokens.spacing;
  
  if (!spacingGroup || typeof spacingGroup !== 'object') return spacing;
  
  const sizeOrder = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
  
  for (const size of sizeOrder) {
    if (size in spacingGroup) {
      const token = (spacingGroup as TokenGroup)[size];
      if (isToken(token)) {
        spacing.push({
          name: size,
          value: String(token.$value),
        });
      }
    }
  }
  
  return spacing;
}

function extractTypographyTokens(tokens: Record<string, TokenGroup | Token>): { fontFamily?: string; sizes: Array<{ name: string; value: string }> } {
  const typography = tokens.typography as TokenGroup | undefined;
  if (!typography) return { sizes: [] };
  
  let fontFamily: string | undefined;
  const sizes: Array<{ name: string; value: string }> = [];
  
  const fontFamilyToken = typography.fontFamily;
  if (isToken(fontFamilyToken)) {
    const value = fontFamilyToken.$value;
    if (Array.isArray(value)) {
      fontFamily = value[0];
    } else {
      fontFamily = String(value);
    }
  }
  
  const fontSizeGroup = typography.fontSize as TokenGroup | undefined;
  if (fontSizeGroup) {
    for (const [name, token] of Object.entries(fontSizeGroup)) {
      if (isToken(token)) {
        sizes.push({ name, value: String(token.$value) });
      }
    }
  }
  
  return { fontFamily, sizes };
}

function extractRadiusTokens(tokens: Record<string, TokenGroup | Token>): Array<{ name: string; value: string }> {
  const radius: Array<{ name: string; value: string }> = [];
  const radiusGroup = tokens.borderRadius || tokens.radius;
  
  if (!radiusGroup || typeof radiusGroup !== 'object') return radius;
  
  const sizeOrder = ['sm', 'md', 'lg', 'xl', 'full'];
  
  for (const size of sizeOrder) {
    if (size in (radiusGroup as TokenGroup)) {
      const token = (radiusGroup as TokenGroup)[size];
      if (isToken(token)) {
        radius.push({
          name: size,
          value: String(token.$value),
        });
      }
    }
  }
  
  return radius;
}

interface ShadowValue {
  offsetX?: string | number;
  offsetY?: string | number;
  blur?: string | number;
  spread?: string | number;
  color?: string;
  opacity?: number;
}

function shadowValueToCss(value: unknown): string | null {
  if (typeof value === 'string') {
    if (value.startsWith('{') && value.endsWith('}')) return null;
    if (value.includes('px') || value.includes('rgba') || value.includes('rgb')) {
      return value;
    }
    return null;
  }
  
  if (typeof value === 'object' && value !== null) {
    const sv = value as ShadowValue;
    const offsetX = typeof sv.offsetX === 'number' ? `${sv.offsetX}px` : (sv.offsetX || '0px');
    const offsetY = typeof sv.offsetY === 'number' ? `${sv.offsetY}px` : (sv.offsetY || '4px');
    const blur = typeof sv.blur === 'number' ? `${sv.blur}px` : (sv.blur || '8px');
    const spread = typeof sv.spread === 'number' ? `${sv.spread}px` : (sv.spread || '0px');
    
    let color = sv.color || 'rgba(0,0,0,0.15)';
    if (color.startsWith('oklch')) {
      color = oklchToHex(color);
      const opacity = sv.opacity ?? 0.15;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      color = `rgba(${r},${g},${b},${opacity})`;
    }
    
    return `${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
  }
  
  return null;
}

function extractShadowTokens(tokens: Record<string, TokenGroup | Token>): Array<{ name: string; value: string }> {
  const shadows: Array<{ name: string; value: string }> = [];
  const shadowGroup = tokens.shadow;
  const elevationGroup = tokens.elevation;
  
  const processGroup = (group: TokenGroup) => {
    const elevationOrder = ['none', 'sm', 'md', 'lg', 'xl', 'overlay', 'card', 'button'];
    
    for (const name of elevationOrder) {
      if (name in group && shadows.length < 6) {
        const token = group[name];
        if (isToken(token)) {
          const cssValue = shadowValueToCss(token.$value);
          if (cssValue) {
            shadows.push({ name, value: cssValue });
          }
        }
      }
    }
    
    if (shadows.length === 0) {
      for (const [name, token] of Object.entries(group)) {
        if (isToken(token) && shadows.length < 6) {
          const cssValue = shadowValueToCss(token.$value);
          if (cssValue) {
            shadows.push({ name, value: cssValue });
          }
        }
      }
    }
  };
  
  if (shadowGroup && typeof shadowGroup === 'object') {
    processGroup(shadowGroup as TokenGroup);
  }
  
  if (shadows.length === 0 && elevationGroup && typeof elevationGroup === 'object') {
    processGroup(elevationGroup as TokenGroup);
  }
  
  return shadows;
}

function extractEffectsTokens(tokens: Record<string, TokenGroup | Token>): Array<{ name: string; hex: string }> {
  const effects: Array<{ name: string; hex: string }> = [];
  const effectsGroup = tokens.effects;
  
  if (!effectsGroup || typeof effectsGroup !== 'object') return effects;
  
  for (const [name, token] of Object.entries(effectsGroup as TokenGroup)) {
    if (isToken(token) && token.$type === 'color') {
      const value = String(token.$value);
      const hex = value.startsWith('oklch') ? oklchToHex(value) : value;
      effects.push({ name, hex });
    }
  }
  
  return effects.slice(0, 6);
}

export default function StyleDNAPanel({ tokens }: StyleDNAPanelProps) {
  const colors = useMemo(() => extractColorTokens(tokens), [tokens]);
  const spacing = useMemo(() => extractSpacingTokens(tokens), [tokens]);
  const typography = useMemo(() => extractTypographyTokens(tokens), [tokens]);
  const radius = useMemo(() => extractRadiusTokens(tokens), [tokens]);
  const shadows = useMemo(() => extractShadowTokens(tokens), [tokens]);
  const effects = useMemo(() => extractEffectsTokens(tokens), [tokens]);
  
  const avgConfidence = useMemo(() => {
    const confidences = colors.filter(c => c.confidence).map(c => c.confidence!);
    if (confidences.length === 0) return null;
    return Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length * 100);
  }, [colors]);

  return (
    <div className="space-y-4" data-testid="style-dna-panel">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles size={12} />
          <span>CV + AI Vision</span>
        </div>
        {avgConfidence && (
          <span className="px-1.5 py-0.5 bg-green-500/10 text-green-600 text-[10px] rounded font-medium">
            {avgConfidence}% confidence
          </span>
        )}
      </div>

      {colors.length > 0 && (
        <div data-testid="dna-colors">
          <div className="flex items-center gap-1.5 mb-2">
            <Palette size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Color Palette</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {colors.map((color, i) => (
              <div 
                key={color.name}
                className="group relative"
                data-testid={`dna-color-${i}`}
              >
                <div 
                  className="w-8 h-8 rounded-md border border-border shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                  style={{ backgroundColor: color.hex }}
                  title={`${color.name}: ${color.hex}`}
                />
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap capitalize">{color.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {spacing.length > 0 && (
        <div data-testid="dna-spacing" className="pt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Space size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Spacing Scale</span>
          </div>
          <div className="flex items-end gap-1">
            {spacing.map((space, i) => {
              const px = parseInt(space.value) || 8;
              const height = Math.min(32, Math.max(4, px));
              return (
                <div key={space.name} className="flex flex-col items-center gap-1" data-testid={`dna-spacing-${i}`}>
                  <div 
                    className="bg-primary/60 rounded-sm"
                    style={{ width: 12, height }}
                    title={`${space.name}: ${space.value}`}
                  />
                  <span className="text-[9px] text-muted-foreground">{space.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(typography.fontFamily || typography.sizes.length > 0) && (
        <div data-testid="dna-typography" className="pt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Type size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Typography</span>
          </div>
          <div className="space-y-1">
            {typography.fontFamily && (
              <div className="text-sm text-foreground font-medium" style={{ fontFamily: typography.fontFamily }}>
                {typography.fontFamily}
              </div>
            )}
            {typography.sizes.length > 0 && (
              <div className="flex gap-2 text-muted-foreground">
                {typography.sizes.map((size, i) => (
                  <span key={size.name} className="text-[10px]" data-testid={`dna-font-size-${i}`}>
                    {size.name}: {size.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {radius.length > 0 && (
        <div data-testid="dna-radius" className="pt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Maximize2 size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Border Radius</span>
          </div>
          <div className="flex gap-2">
            {radius.map((r, i) => {
              const value = r.value === '50%' || r.value === '9999px' ? '50%' : r.value;
              const borderRadius = value === '50%' ? '50%' : parseInt(r.value) || 4;
              return (
                <div key={r.name} className="flex flex-col items-center gap-1" data-testid={`dna-radius-${i}`}>
                  <div 
                    className="w-6 h-6 border-2 border-primary/60 bg-primary/10"
                    style={{ borderRadius }}
                    title={`${r.name}: ${r.value}`}
                  />
                  <span className="text-[9px] text-muted-foreground">{r.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shadows.length > 0 && (
        <div data-testid="dna-shadows" className="pt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Elevation / Shadows</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {shadows.map((shadow, i) => (
              <div 
                key={shadow.name} 
                className="flex flex-col items-center gap-1"
                data-testid={`dna-shadow-${i}`}
              >
                <div 
                  className="w-8 h-8 rounded-md bg-card"
                  style={{ boxShadow: shadow.value }}
                  title={`${shadow.name}: ${shadow.value}`}
                />
                <span className="text-[9px] text-muted-foreground capitalize">{shadow.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {effects.length > 0 && (
        <div data-testid="dna-effects" className="pt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Droplets size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Material Effects</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {effects.map((effect, i) => (
              <div 
                key={effect.name}
                className="group relative"
                data-testid={`dna-effect-${i}`}
              >
                <div 
                  className="w-8 h-8 rounded-md border border-border shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                  style={{ backgroundColor: effect.hex }}
                  title={`${effect.name}: ${effect.hex}`}
                />
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap capitalize">{effect.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
