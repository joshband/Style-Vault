import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Download, Check, Code, Palette } from "lucide-react";

interface FrameworkExportProps {
  colors?: { name: string; hex: string }[];
  gradientCSS?: string;
  styleName?: string;
}

interface Framework {
  id: string;
  name: string;
  icon: string;
  description: string;
  extension: string;
}

const FRAMEWORKS: Framework[] = [
  { id: "react", name: "React/TypeScript", icon: "⚛️", description: "TypeScript theme object", extension: "ts" },
  { id: "vue", name: "Vue 3", icon: "💚", description: "Composable theme", extension: "ts" },
  { id: "tailwind", name: "Tailwind CSS", icon: "🌊", description: "Config extension", extension: "js" },
  { id: "css", name: "CSS Variables", icon: "🎨", description: "Custom properties", extension: "css" },
  { id: "scss", name: "SCSS", icon: "💅", description: "Sass variables", extension: "scss" },
  { id: "svelte", name: "Svelte", icon: "🔥", description: "Svelte store", extension: "ts" },
  { id: "nextjs", name: "Next.js", icon: "▲", description: "Theme provider", extension: "tsx" },
  { id: "chakra", name: "Chakra UI", icon: "⚡", description: "Theme extension", extension: "ts" },
];

function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function toCamelCase(str: string): string {
  return str.split(/[-_\s]+/).map((w, i) => 
    i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');
}

function toPascalCase(str: string): string {
  return str.split(/[-_\s]+/).map(w => 
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');
}

export function FrameworkExport({ colors = [], gradientCSS, styleName = "MyTheme" }: FrameworkExportProps) {
  const [selectedFramework, setSelectedFramework] = useState("react");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const defaultColors = useMemo(() => {
    if (colors.length > 0) return colors;
    return [
      { name: "Primary", hex: "#6366f1" },
      { name: "Secondary", hex: "#8b5cf6" },
      { name: "Background", hex: "#ffffff" },
      { name: "Foreground", hex: "#1f2937" },
      { name: "Muted", hex: "#f3f4f6" },
      { name: "Accent", hex: "#ec4899" },
    ];
  }, [colors]);

  const generateCode = useCallback((frameworkId: string): string => {
    const safeStyleName = toPascalCase(styleName) || "Theme";
    const camelName = toCamelCase(styleName) || "theme";

    switch (frameworkId) {
      case "react":
        return `// ${safeStyleName} Theme - React/TypeScript
export const ${camelName} = {
  colors: {
${defaultColors.map(c => `    ${toCamelCase(c.name)}: "${c.hex}",`).join('\n')}
  },${gradientCSS ? `
  gradients: {
    primary: "${gradientCSS}",
  },` : ''}
} as const;

export type ${safeStyleName}Theme = typeof ${camelName};

// Usage: import { ${camelName} } from './theme';
// <div style={{ color: ${camelName}.colors.primary }}>`;

      case "vue":
        return `// ${safeStyleName} Theme - Vue 3 Composable
import { reactive, readonly } from 'vue';

const state = reactive({
  colors: {
${defaultColors.map(c => `    ${toCamelCase(c.name)}: "${c.hex}",`).join('\n')}
  },${gradientCSS ? `
  gradients: {
    primary: "${gradientCSS}",
  },` : ''}
});

export function use${safeStyleName}Theme() {
  return readonly(state);
}

// Usage: const theme = use${safeStyleName}Theme();`;

      case "tailwind":
        return `// ${safeStyleName} - Tailwind CSS Config
// Add to tailwind.config.js theme.extend

module.exports = {
  theme: {
    extend: {
      colors: {
${defaultColors.map(c => `        '${toKebabCase(c.name)}': '${c.hex}',`).join('\n')}
      },${gradientCSS ? `
      backgroundImage: {
        'gradient-${toKebabCase(styleName)}': '${gradientCSS}',
      },` : ''}
    },
  },
};

// Usage: <div class="bg-primary text-foreground">`;

      case "css":
        return `/* ${safeStyleName} Theme - CSS Variables */
:root {
${defaultColors.map(c => `  --${toKebabCase(c.name)}: ${c.hex};`).join('\n')}${gradientCSS ? `
  --gradient-primary: ${gradientCSS};` : ''}
}

/* Usage:
.element {
  color: var(--primary);
  background: var(--background);${gradientCSS ? `
  background: var(--gradient-primary);` : ''}
}
*/`;

      case "scss":
        return `// ${safeStyleName} Theme - SCSS Variables

${defaultColors.map(c => `$${toKebabCase(c.name)}: ${c.hex};`).join('\n')}${gradientCSS ? `
$gradient-primary: ${gradientCSS};` : ''}

// Color map for iteration
$colors: (
${defaultColors.map(c => `  "${toKebabCase(c.name)}": $${toKebabCase(c.name)},`).join('\n')}
);

// Generate utility classes
@each $name, $color in $colors {
  .text-#{$name} { color: $color; }
  .bg-#{$name} { background-color: $color; }
}`;

      case "svelte":
        return `// ${safeStyleName} Theme - Svelte Store
import { writable, derived } from 'svelte/store';

export const ${camelName} = writable({
  colors: {
${defaultColors.map(c => `    ${toCamelCase(c.name)}: "${c.hex}",`).join('\n')}
  },${gradientCSS ? `
  gradients: {
    primary: "${gradientCSS}",
  },` : ''}
});

export const cssVars = derived(${camelName}, ($theme) => {
  return Object.entries($theme.colors)
    .map(([key, value]) => \`--\${key}: \${value}\`)
    .join('; ');
});

// Usage: <div style={$cssVars}>`;

      case "nextjs":
        return `// ${safeStyleName} Theme - Next.js Theme Provider
'use client';

import { createContext, useContext, ReactNode } from 'react';

const ${camelName} = {
  colors: {
${defaultColors.map(c => `    ${toCamelCase(c.name)}: "${c.hex}",`).join('\n')}
  },${gradientCSS ? `
  gradients: {
    primary: "${gradientCSS}",
  },` : ''}
} as const;

type ${safeStyleName}Theme = typeof ${camelName};

const ThemeContext = createContext<${safeStyleName}Theme>(${camelName});

export function ${safeStyleName}Provider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={${camelName}}>
      <style jsx global>{\`
        :root {
${defaultColors.map(c => `          --${toKebabCase(c.name)}: ${c.hex};`).join('\n')}
        }
      \`}</style>
      {children}
    </ThemeContext.Provider>
  );
}

export function use${safeStyleName}() {
  return useContext(ThemeContext);
}`;

      case "chakra":
        return `// ${safeStyleName} Theme - Chakra UI Extension
import { extendTheme } from '@chakra-ui/react';

export const ${camelName} = extendTheme({
  colors: {
${defaultColors.map(c => `    ${toCamelCase(c.name)}: {
      500: "${c.hex}",
    },`).join('\n')}
  },
  styles: {
    global: {
      body: {
        bg: 'background.500',
        color: 'foreground.500',
      },
    },
  },${gradientCSS ? `
  gradients: {
    primary: "${gradientCSS}",
  },` : ''}
});

// Usage: <ChakraProvider theme={${camelName}}>`;

      default:
        return "// Select a framework to generate code";
    }
  }, [defaultColors, gradientCSS, styleName]);

  const handleCopy = useCallback(async (frameworkId: string) => {
    const code = generateCode(frameworkId);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(frameworkId);
      toast.success(`${FRAMEWORKS.find(f => f.id === frameworkId)?.name} code copied`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [generateCode]);

  const handleDownload = useCallback((frameworkId: string) => {
    const framework = FRAMEWORKS.find(f => f.id === frameworkId);
    if (!framework) return;
    
    const code = generateCode(frameworkId);
    const filename = `${toKebabCase(styleName)}-theme.${framework.extension}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  }, [generateCode, styleName]);

  const selectedFramework_ = FRAMEWORKS.find(f => f.id === selectedFramework);

  return (
    <Card className="w-full" data-testid="framework-export">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5" />
          Framework Export
        </CardTitle>
        <CardDescription>One-click export to popular UI frameworks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={selectedFramework} onValueChange={setSelectedFramework}>
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
            {FRAMEWORKS.map(f => (
              <TabsTrigger 
                key={f.id} 
                value={f.id} 
                className="text-xs"
                data-testid={`tab-${f.id}`}
              >
                <span className="mr-1">{f.icon}</span>
                <span className="hidden sm:inline">{f.name.split('/')[0].split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {FRAMEWORKS.map(f => (
            <TabsContent key={f.id} value={f.id} className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <span>{f.icon}</span>
                    {f.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </div>
                <Badge variant="outline">.{f.extension}</Badge>
              </div>

              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono max-h-80">
                  <code data-testid={`code-${f.id}`}>{generateCode(f.id)}</code>
                </pre>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => handleCopy(f.id)} 
                  className="flex-1"
                  data-testid={`button-copy-${f.id}`}
                >
                  {copiedId === f.id ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleDownload(f.id)}
                  data-testid={`button-download-${f.id}`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {defaultColors.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground">Using colors:</span>
            {defaultColors.slice(0, 6).map((c, i) => (
              <div 
                key={i}
                className="w-6 h-6 rounded border"
                style={{ backgroundColor: c.hex }}
                title={`${c.name}: ${c.hex}`}
              />
            ))}
            {defaultColors.length > 6 && (
              <span className="text-sm text-muted-foreground">+{defaultColors.length - 6}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
