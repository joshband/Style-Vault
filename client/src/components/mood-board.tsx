import { useMoodBoard, MoodBoardData } from "@/hooks/useMoodBoard";
import { StyleTheme } from "@/hooks/useStyleTheme";
import { Palette, Type, Layers, Sun, Sparkles, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoodBoardProps {
  theme: StyleTheme;
  className?: string;
}

function ColorPaletteCard({ data }: { data: MoodBoardData }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="mood-color-palette">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Palette size={14} />
        Color Palette
      </div>
      <div className="grid grid-cols-4 gap-2">
        {data.colorPalette.map((swatch, index) => (
          <button
            key={swatch.name}
            data-testid={`swatch-${swatch.role}-${index}`}
            className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(swatch.hex);
              }
            }}
            title={`Click to copy ${swatch.hex}`}
          >
            <div
              className="w-full aspect-square rounded-md border border-border/50 shadow-sm"
              style={{ backgroundColor: swatch.hex }}
            />
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{swatch.name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/70">{swatch.hex}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TypographyCard({ data }: { data: MoodBoardData }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="mood-typography">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Type size={14} />
        Typography
      </div>
      <div className="space-y-3">
        {data.typography.map((specimen) => (
          <div key={specimen.name} className="flex items-baseline justify-between gap-2">
            <div
              className="truncate"
              style={{
                fontFamily: specimen.fontFamily,
                fontSize: specimen.size,
                fontWeight: specimen.weight,
                lineHeight: 1.2,
              }}
            >
              {specimen.sampleText}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{specimen.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShadowCard({ data }: { data: MoodBoardData }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="mood-shadows">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Layers size={14} />
        Shadows & Depth
      </div>
      <div className="flex gap-3">
        {data.shadows.map((shadow) => (
          <div key={shadow.name} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full aspect-square rounded-md bg-white"
              style={{ boxShadow: shadow.value }}
            />
            <span className="text-[10px] text-muted-foreground">{shadow.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialCard({ data }: { data: MoodBoardData }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="mood-material">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Circle size={14} />
        Material & Texture
      </div>
      <div
        className="w-full aspect-[2/1] rounded-md border border-border/50"
        style={{ background: data.material.cssGradient }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data.material.name}</span>
        <span>Roughness: {Math.round(data.material.roughness * 100)}%</span>
      </div>
    </div>
  );
}

function LightingCard({ data }: { data: MoodBoardData }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="mood-lighting">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Sun size={14} />
        Lighting
      </div>
      <div
        className="w-full aspect-[2/1] rounded-md border border-border/50 bg-gray-800"
        style={{ background: `${data.lighting.cssGradient}, #374151` }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="capitalize">{data.lighting.type.replace("-", " ")}</span>
        <span className="capitalize">From {data.lighting.direction.replace("-", " ")}</span>
      </div>
    </div>
  );
}

function MoodDescriptorCard({ data }: { data: MoodBoardData }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="mood-descriptor">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Sparkles size={14} />
        Mood & Atmosphere
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tone</span>
          <span className="font-medium capitalize">{data.moodDescriptor.tone}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Saturation</span>
          <span className="font-medium">{data.moodDescriptor.saturation}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Contrast</span>
          <span className="font-medium">{data.moodDescriptor.contrast}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
        {data.moodDescriptor.keywords.map((keyword) => (
          <span
            key={keyword}
            className="px-2 py-0.5 text-[10px] bg-muted rounded-full text-muted-foreground"
          >
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MoodBoard({ theme, className }: MoodBoardProps) {
  const moodData = useMoodBoard(theme);

  if (!moodData) {
    return (
      <div className={cn("p-8 text-center text-muted-foreground", className)}>
        No mood board data available
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      <ColorPaletteCard data={moodData} />
      <TypographyCard data={moodData} />
      <ShadowCard data={moodData} />
      <MaterialCard data={moodData} />
      <LightingCard data={moodData} />
      <MoodDescriptorCard data={moodData} />
    </div>
  );
}

export default MoodBoard;
