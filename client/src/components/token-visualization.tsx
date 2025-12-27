import { cn } from "@/lib/utils";
import type { DTCGTokenGroup, DesignToken } from "@/lib/store";

interface TokenVisualizationProps {
  tokens: DTCGTokenGroup;
  className?: string;
  compact?: boolean;
}

function isToken(n: unknown): n is DesignToken {
  return n !== null && typeof n === "object" && "$value" in n && "$type" in n;
}

function oklchToHex(oklch: string): string {
  const match = oklch.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) return oklch;
  
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
  
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function resolveAlias(aliasValue: string, tokens: DTCGTokenGroup, maxDepth = 10): string | null {
  if (maxDepth <= 0) return null;
  
  const match = aliasValue.match(/^\{(.+)\}$/);
  if (!match) return null;
  
  const path = match[1].split(".");
  let current: unknown = tokens;
  
  for (const segment of path) {
    if (current && typeof current === "object" && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }
  
  if (isToken(current)) {
    const value = String(current.$value);
    if (value.startsWith("{")) {
      return resolveAlias(value, tokens, maxDepth - 1);
    }
    return value;
  }
  return null;
}

function extractColors(tokens: DTCGTokenGroup): { name: string; value: string }[] {
  const colors: { name: string; value: string }[] = [];
  const colorGroup = tokens.color;
  if (!colorGroup || typeof colorGroup !== "object") return colors;
  
  const processEntry = (key: string, value: unknown, prefix = "") => {
    const fullName = prefix ? `${prefix}.${key}` : key;
    if (isToken(value) && value.$type === "color") {
      let colorValue = String(value.$value);
      
      if (colorValue.startsWith("{")) {
        const resolved = resolveAlias(colorValue, tokens);
        if (resolved) colorValue = resolved;
      }
      
      if (colorValue.startsWith("oklch")) {
        colorValue = oklchToHex(colorValue);
      }
      
      if (colorValue.startsWith("#") || colorValue.startsWith("rgb")) {
        colors.push({ name: fullName, value: colorValue });
      }
    } else if (typeof value === "object" && value !== null && !isToken(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        processEntry(subKey, subValue, fullName);
      }
    }
  };
  
  for (const [key, value] of Object.entries(colorGroup)) {
    processEntry(key, value);
  }
  
  return colors.slice(0, 6);
}

function extractTypography(tokens: DTCGTokenGroup): { fontFamily: string; sizes: string[] } | null {
  const typography = tokens.typography;
  if (!typography || typeof typography !== "object") return null;
  
  let fontFamily = "system-ui";
  const sizes: string[] = [];
  
  const fontFamilyGroup = (typography as Record<string, unknown>).fontFamily;
  if (fontFamilyGroup && typeof fontFamilyGroup === "object") {
    const sans = (fontFamilyGroup as Record<string, unknown>).sans;
    if (isToken(sans) && sans.$type === "fontFamily") {
      fontFamily = String(sans.$value).split(",")[0].trim();
    }
  }
  
  const fontSizeGroup = (typography as Record<string, unknown>).fontSize;
  if (fontSizeGroup && typeof fontSizeGroup === "object") {
    for (const [, value] of Object.entries(fontSizeGroup)) {
      if (isToken(value) && value.$type === "dimension") {
        sizes.push(String(value.$value));
      }
    }
  }
  
  return { fontFamily, sizes: sizes.slice(0, 4) };
}

function extractSpacing(tokens: DTCGTokenGroup): string[] {
  const spacing = tokens.spacing;
  if (!spacing || typeof spacing !== "object") return [];
  
  const values: { key: number; value: string }[] = [];
  
  for (const [key, value] of Object.entries(spacing)) {
    if (isToken(value) && value.$type === "dimension") {
      const numKey = parseInt(key, 10);
      if (!isNaN(numKey) && numKey > 0) {
        values.push({ key: numKey, value: String(value.$value) });
      }
    }
  }
  
  return values
    .sort((a, b) => a.key - b.key)
    .slice(0, 5)
    .map(v => v.value);
}

export function TokenVisualization({ tokens, className, compact = false }: TokenVisualizationProps) {
  const colors = extractColors(tokens);
  const typography = extractTypography(tokens);
  const spacing = extractSpacing(tokens);
  
  if (colors.length === 0 && !typography && spacing.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground text-xs", className)}>
        No tokens available
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("w-full h-full flex flex-col p-3 bg-gradient-to-br from-muted/50 to-muted", className)}>
        {colors.length > 0 && (
          <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-1.5">
            {colors.map((color, i) => (
              <div
                key={i}
                className="rounded-md shadow-sm"
                style={{ backgroundColor: color.value }}
                title={`${color.name}: ${color.value}`}
              />
            ))}
          </div>
        )}
        
        {typography && (
          <div 
            className="mt-2 text-center truncate text-foreground/80"
            style={{ fontFamily: typography.fontFamily, fontSize: "0.75rem" }}
          >
            {typography.fontFamily}
          </div>
        )}
        
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[10px] font-mono rounded">
          Tokens
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col p-4 bg-gradient-to-br from-muted/30 to-muted", className)}>
      {colors.length > 0 && (
        <div className="flex-1 min-h-0">
          <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full">
            {colors.map((color, i) => (
              <div
                key={i}
                className="rounded-lg shadow-sm flex items-end justify-start p-2"
                style={{ backgroundColor: color.value }}
                title={`${color.name}: ${color.value}`}
              >
                <span className="text-[9px] font-mono text-white/80 drop-shadow-sm truncate">
                  {color.name.split(".").pop()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {typography && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div 
            className="text-sm text-foreground/80 truncate"
            style={{ fontFamily: typography.fontFamily }}
          >
            <span className="font-medium">Aa</span> {typography.fontFamily}
          </div>
        </div>
      )}
      
      {spacing.length > 0 && (
        <div className="mt-2 flex items-end gap-1">
          {spacing.map((size, i) => (
            <div
              key={i}
              className="bg-primary/20 rounded-sm"
              style={{ 
                width: `${Math.min(parseInt(size) || 8, 32)}px`,
                height: `${Math.min(parseInt(size) || 8, 32)}px`
              }}
              title={size}
            />
          ))}
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[10px] font-mono rounded">
        Tokens
      </div>
    </div>
  );
}
