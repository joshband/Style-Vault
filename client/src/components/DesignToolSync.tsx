import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Check,
  ExternalLink,
  Palette,
  Layers,
  FileJson,
  FileCode,
  Sparkles,
} from "lucide-react";

import { normalizeTokens, getExporter, getAllExporters, type ExporterDefinition } from "@/lib/token-pipeline";

interface DesignToolSyncProps {
  styleName: string;
  tokens: Record<string, unknown>;
  onClose?: () => void;
}

interface ToolConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  exporterId: string;
  pluginUrl?: string;
  docsUrl: string;
  color: string;
  features: string[];
  setupInstructions: string[];
}

const DESIGN_TOOLS: ToolConfig[] = [
  {
    id: "figma-variables",
    name: "Figma Variables",
    icon: <Palette className="w-5 h-5" />,
    description: "Native Figma Variables format for direct plugin import",
    exporterId: "figma-variables",
    pluginUrl: "https://www.figma.com/community/plugin/1253186856442769660",
    docsUrl: "https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma",
    color: "bg-purple-500",
    features: ["Color variables", "Number variables", "String variables", "Mode support"],
    setupInstructions: [
      "Install the 'Variables Import/Export' plugin in Figma",
      "Download the JSON file below",
      "Open your Figma file and run the plugin",
      "Click 'Import' and select the downloaded JSON file",
      "Your variables will appear in the Variables panel",
    ],
  },
  {
    id: "figma-tokens-studio",
    name: "Figma Tokens Studio",
    icon: <Layers className="w-5 h-5" />,
    description: "Popular community format for the Tokens Studio plugin",
    exporterId: "figma-tokens-studio",
    pluginUrl: "https://www.figma.com/community/plugin/843461159747178978",
    docsUrl: "https://tokens.studio/",
    color: "bg-indigo-500",
    features: ["Theme support", "Token aliases", "Typography tokens", "Shadow tokens"],
    setupInstructions: [
      "Install Tokens Studio plugin in Figma",
      "Copy the JSON or download the file",
      "In Tokens Studio, go to Settings > Token Storage",
      "Choose 'Local Document' and paste/import the JSON",
      "Apply tokens to your designs using the plugin",
    ],
  },
  {
    id: "adobe-xd",
    name: "Adobe XD",
    icon: <FileJson className="w-5 h-5" />,
    description: "Design System Package format for Adobe XD",
    exporterId: "adobe-xd",
    docsUrl: "https://helpx.adobe.com/xd/help/design-systems.html",
    color: "bg-pink-500",
    features: ["Color tokens", "Size tokens", "Font references", "Component styles"],
    setupInstructions: [
      "Download the DSP JSON file",
      "Open Adobe XD and go to File > Open DSP Package",
      "Select the downloaded JSON file",
      "Your design tokens will be available in the Assets panel",
      "Link tokens to your design elements",
    ],
  },
  {
    id: "adobe-ase",
    name: "Adobe Creative Suite",
    icon: <Palette className="w-5 h-5" />,
    description: "ASE swatch file for Photoshop, Illustrator, and InDesign",
    exporterId: "adobe-ase",
    docsUrl: "https://helpx.adobe.com/photoshop/using/customizing-color-pickers-swatches.html",
    color: "bg-red-500",
    features: ["Color swatches", "RGB/LAB colors", "Grouped swatches", "Cross-app support"],
    setupInstructions: [
      "Download the ASE swatch file",
      "Open Photoshop, Illustrator, or InDesign",
      "Go to Swatches panel menu > Load Swatches",
      "Select the downloaded .ase file",
      "Your color tokens are now available as swatches",
    ],
  },
  {
    id: "sketch",
    name: "Sketch",
    icon: <FileCode className="w-5 h-5" />,
    description: "Sketch palette format for color and layer styles",
    exporterId: "sketch",
    docsUrl: "https://www.sketch.com/docs/styling/",
    color: "bg-yellow-500",
    features: ["Color palette", "Layer styles", "Text styles", "Shared styles"],
    setupInstructions: [
      "Download the Sketch palette file",
      "Open Sketch and go to your document",
      "In the color picker, click the gear icon",
      "Choose 'Load Colors from File' and select the palette",
      "Colors are now available in your document",
    ],
  },
];

export function DesignToolSync({ styleName, tokens, onClose }: DesignToolSyncProps) {
  const [selectedTool, setSelectedTool] = useState<string>(DESIGN_TOOLS[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<string, Record<string, boolean>>>({});

  const getExportedContent = useCallback(
    (exporterId: string, toolOptions?: Record<string, unknown>): string | Uint8Array | null => {
      const exporter = getExporter(exporterId);
      if (!exporter) {
        console.error(`Exporter ${exporterId} not found`);
        return null;
      }

      const normalized = normalizeTokens(tokens, styleName);
      return exporter.export(normalized, toolOptions);
    },
    [tokens, styleName]
  );

  const handleCopy = useCallback(
    async (tool: ToolConfig) => {
      const content = getExportedContent(tool.exporterId, options[tool.id]);
      if (!content) {
        toast.error("Failed to export tokens");
        return;
      }

      if (content instanceof Uint8Array) {
        toast.error("Binary files cannot be copied - please download instead");
        return;
      }

      try {
        await navigator.clipboard.writeText(content);
        setCopiedId(tool.id);
        toast.success(`${tool.name} tokens copied to clipboard`);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
        toast.error("Failed to copy to clipboard");
      }
    },
    [getExportedContent, options]
  );

  const handleDownload = useCallback(
    (tool: ToolConfig) => {
      const exporter = getExporter(tool.exporterId);
      if (!exporter) {
        toast.error("Exporter not found");
        return;
      }

      const content = getExportedContent(tool.exporterId, options[tool.id]);
      if (!content) {
        toast.error("Failed to export tokens");
        return;
      }

      const filename = `${styleName.toLowerCase().replace(/\s+/g, "-")}.${exporter.extension}`;

      if (content instanceof Uint8Array) {
        const blob = new Blob([content], { type: exporter.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([content], { type: exporter.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`Downloaded ${filename}`);
    },
    [getExportedContent, styleName, options]
  );

  const toggleOption = (toolId: string, optionId: string, value: boolean) => {
    setOptions((prev) => ({
      ...prev,
      [toolId]: {
        ...prev[toolId],
        [optionId]: value,
      },
    }));
  };

  const selectedToolConfig = DESIGN_TOOLS.find((t) => t.id === selectedTool);
  const selectedExporter = selectedToolConfig
    ? getExporter(selectedToolConfig.exporterId)
    : null;

  return (
    <Card className="w-full max-w-4xl" data-testid="design-tool-sync-panel">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle>Design Tool Integration</CardTitle>
            <CardDescription>
              Export tokens to your favorite design tools for seamless style application
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={selectedTool} onValueChange={setSelectedTool}>
          <TabsList className="grid grid-cols-5 w-full mb-6">
            {DESIGN_TOOLS.map((tool) => (
              <TabsTrigger
                key={tool.id}
                value={tool.id}
                className="flex items-center gap-2 text-xs"
                data-testid={`tab-${tool.id}`}
              >
                <span className={`p-1 rounded ${tool.color} text-white`}>{tool.icon}</span>
                <span className="hidden sm:inline">{tool.name.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            {DESIGN_TOOLS.map((tool) => (
              <TabsContent key={tool.id} value={tool.id}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg ${tool.color} text-white`}>
                          {tool.icon}
                        </span>
                        {tool.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                    </div>

                    <div className="flex gap-2">
                      {tool.pluginUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid={`link-plugin-${tool.id}`}
                        >
                          <a href={tool.pluginUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Plugin
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        data-testid={`link-docs-${tool.id}`}
                      >
                        <a href={tool.docsUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Docs
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {tool.features.map((feature) => (
                      <Badge key={feature} variant="secondary">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  {selectedExporter?.subOptions && selectedExporter.subOptions.length > 0 && (
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <h4 className="text-sm font-medium">Export Options</h4>
                      {selectedExporter.subOptions.map((opt) => (
                        <div key={opt.id} className="flex items-center justify-between">
                          <Label htmlFor={`${tool.id}-${opt.id}`} className="text-sm">
                            {opt.label}
                          </Label>
                          {opt.type === "boolean" && (
                            <Switch
                              id={`${tool.id}-${opt.id}`}
                              checked={options[tool.id]?.[opt.id] ?? (opt.default as boolean)}
                              onCheckedChange={(val) => toggleOption(tool.id, opt.id, val)}
                              data-testid={`option-${tool.id}-${opt.id}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {!selectedExporter?.isBinary && (
                      <Button
                        onClick={() => handleCopy(tool)}
                        className="flex-1"
                        data-testid={`button-copy-${tool.id}`}
                      >
                        {copiedId === tool.id ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy to Clipboard
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant={selectedExporter?.isBinary ? "default" : "outline"}
                      onClick={() => handleDownload(tool)}
                      className={selectedExporter?.isBinary ? "flex-1" : ""}
                      data-testid={`button-download-${tool.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download .{selectedExporter?.extension || "json"}
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <span className="text-muted-foreground">Setup Instructions</span>
                    </h4>
                    <ol className="space-y-2">
                      {tool.setupInstructions.map((instruction, idx) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </span>
                          <span className="text-muted-foreground">{instruction}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </motion.div>
              </TabsContent>
            ))}
          </AnimatePresence>
        </Tabs>
      </CardContent>
    </Card>
  );
}
