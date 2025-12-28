import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DTCGTokenGroup, DesignToken } from "@/lib/store";

interface ColorSwatchProps {
  name: string;
  hex: string;
  usage: string;
}

function ColorSwatch({ name, hex, usage }: ColorSwatchProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isLightColor = (color: string): boolean => {
    const hex = color.replace("#", "");
    if (hex.length !== 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  };

  const textColor = isLightColor(hex) ? "text-gray-800" : "text-white";

  return (
    <button
      onClick={handleCopy}
      className="group relative flex flex-col rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
      data-testid={`swatch-${name}`}
    >
      <div
        className="h-20 w-full flex items-center justify-center"
        style={{ backgroundColor: hex }}
      >
        <span
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity",
            textColor
          )}
        >
          {copied ? (
            <Check size={20} />
          ) : (
            <Copy size={18} />
          )}
        </span>
      </div>
      <div className="p-3 bg-card space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground capitalize">
            {name}
          </span>
          {copied && (
            <span className="text-[10px] text-green-500 font-medium">Copied!</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-muted-foreground uppercase">
            {hex}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {usage}
          </span>
        </div>
      </div>
    </button>
  );
}

interface ColorPaletteSwatchesProps {
  tokens: DTCGTokenGroup | null | undefined;
  className?: string;
}

const COLOR_USAGE_MAP: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  surface: "Surface",
  text: "Text",
  textSecondary: "Text Alt",
  muted: "Muted",
  border: "Border",
  highlight: "Highlight",
  error: "Error",
  warning: "Warning",
  success: "Success",
  info: "Info",
};

function oklchToHex(oklchStr: string): string | null {
  const match = oklchStr.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!match) return null;
  
  const L = parseFloat(match[1]);
  const C = parseFloat(match[2]);
  const H = parseFloat(match[3]);
  
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  
  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  
  const toSRGB = (x: number) => {
    const clamped = Math.max(0, Math.min(1, x));
    const linear = clamped <= 0.0031308 
      ? 12.92 * clamped 
      : 1.055 * Math.pow(clamped, 1/2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(255, linear * 255)));
  };
  
  const rHex = toSRGB(r).toString(16).padStart(2, '0');
  const gHex = toSRGB(g).toString(16).padStart(2, '0');
  const bHex = toSRGB(bl).toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}

function extractColors(tokens: DTCGTokenGroup | null | undefined): { name: string; hex: string; usage: string }[] {
  const colors: { name: string; hex: string; usage: string }[] = [];
  if (!tokens || typeof tokens !== "object") return colors;
  
  const seenKeys = new Set<string>();
  
  const colorGroup = tokens.color;
  if (!colorGroup || typeof colorGroup !== "object") return colors;

  const isToken = (n: any): n is DesignToken => {
    return n && typeof n === "object" && "$value" in n && "$type" in n;
  };

  const processColorEntry = (key: string, value: any, prefix: string = "") => {
    const fullName = prefix ? `${prefix}.${key}` : key;
    
    if (isToken(value) && value.$type === "color") {
      const colorValue = String(value.$value);
      let hexValue: string | null = null;
      
      if (colorValue.startsWith("#")) {
        hexValue = colorValue;
      } else if (colorValue.startsWith("rgb")) {
        hexValue = colorValue;
      } else if (colorValue.startsWith("oklch")) {
        hexValue = oklchToHex(colorValue);
      }
      
      if (hexValue) {
        const uniqueKey = fullName;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          colors.push({
            name: fullName,
            hex: hexValue,
            usage: COLOR_USAGE_MAP[key] || formatUsage(key),
          });
        }
      }
    } else if (typeof value === "object" && !isToken(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        processColorEntry(subKey, subValue, fullName);
      }
    }
  };

  for (const [key, value] of Object.entries(colorGroup)) {
    processColorEntry(key, value);
  }

  return colors;
}

function formatUsage(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function ColorPaletteSwatches({ tokens, className }: ColorPaletteSwatchesProps) {
  const colors = extractColors(tokens);

  if (colors.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No color tokens found
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {colors.map((color) => (
          <ColorSwatch
            key={color.name}
            name={color.name}
            hex={color.hex}
            usage={color.usage}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Click any swatch to copy the hex code
      </p>
    </div>
  );
}
