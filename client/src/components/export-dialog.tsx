import { useState, useCallback, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, ChevronDown, ChevronRight, Info, FileCode, Palette, Smartphone, Gamepad2, Code2, Settings2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  type ExporterDefinition,
  type ExporterSubOption,
  getAllExporters,
  exportTokens,
  downloadExportResult,
} from "@/lib/token-pipeline";
import { initializeExporters } from "@/lib/exporters";

initializeExporters();

interface ExportDialogProps {
  tokens: Record<string, any>;
  styleName: string;
  trigger?: React.ReactNode;
}

type CategoryId = ExporterDefinition["category"];

const CATEGORY_INFO: Record<CategoryId, { label: string; icon: React.ReactNode; description: string }> = {
  "design-tool": {
    label: "Design Tools",
    icon: <Palette className="w-4 h-4" />,
    description: "For design software like Figma, Sketch, and Adobe apps",
  },
  "web": {
    label: "Web Development",
    icon: <Code2 className="w-4 h-4" />,
    description: "CSS, SCSS, and JavaScript frameworks",
  },
  "mobile": {
    label: "Mobile Apps",
    icon: <Smartphone className="w-4 h-4" />,
    description: "iOS, Android, React Native, and Flutter",
  },
  "game-engine": {
    label: "Game Engines",
    icon: <Gamepad2 className="w-4 h-4" />,
    description: "Unity, Unreal Engine, and game development",
  },
  "code": {
    label: "Other Formats",
    icon: <FileCode className="w-4 h-4" />,
    description: "Standard formats and specialized exports",
  },
};

const CATEGORY_ORDER: CategoryId[] = ["web", "design-tool", "mobile", "code", "game-engine"];

export function ExportDialog({ tokens, styleName, trigger }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<Record<string, Record<string, any>>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  const [downloading, setDownloading] = useState(false);

  const exporters = useMemo(() => getAllExporters(), []);
  
  const exportersByCategory = useMemo(() => {
    const grouped: Record<CategoryId, ExporterDefinition[]> = {
      "design-tool": [],
      "web": [],
      "mobile": [],
      "game-engine": [],
      "code": [],
    };
    
    for (const exporter of exporters) {
      grouped[exporter.category].push(exporter);
    }
    
    return grouped;
  }, [exporters]);

  const toggleSelection = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((category: CategoryId) => {
    const categoryExporters = exportersByCategory[category];
    setSelected(prev => {
      const next = new Set(prev);
      categoryExporters.forEach(e => next.add(e.id));
      return next;
    });
  }, [exportersByCategory]);

  const deselectAll = useCallback((category: CategoryId) => {
    const categoryExporters = exportersByCategory[category];
    setSelected(prev => {
      const next = new Set(prev);
      categoryExporters.forEach(e => next.delete(e.id));
      return next;
    });
  }, [exportersByCategory]);

  const updateOption = useCallback((exporterId: string, optionId: string, value: any) => {
    setOptions(prev => ({
      ...prev,
      [exporterId]: {
        ...prev[exporterId],
        [optionId]: value,
      },
    }));
  }, []);

  const handleExport = useCallback(async () => {
    if (selected.size === 0) return;
    
    setDownloading(true);
    let successCount = 0;
    let failedExports: string[] = [];
    
    try {
      const selectedExporters = Array.from(selected)
        .map(id => exporters.find(e => e.id === id))
        .filter((e): e is ExporterDefinition => !!e);
      
      for (const exporter of selectedExporters) {
        try {
          const exporterOptions = options[exporter.id] || {};
          
          if (exporter.subOptions) {
            for (const subOption of exporter.subOptions) {
              if (!(subOption.id in exporterOptions)) {
                exporterOptions[subOption.id] = subOption.default;
              }
            }
          }
          
          const result = exportTokens(tokens, styleName, exporter.id, exporterOptions);
          downloadExportResult(result);
          successCount++;
          
          if (selectedExporters.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (error) {
          console.error(`Export failed for ${exporter.name}:`, error);
          failedExports.push(exporter.name);
        }
      }
      
      if (failedExports.length === 0) {
        toast.success(
          successCount === 1 
            ? "Export downloaded successfully" 
            : `${successCount} exports downloaded successfully`
        );
        setOpen(false);
        setSelected(new Set());
      } else if (successCount > 0) {
        toast.warning(
          `${successCount} exported, ${failedExports.length} failed: ${failedExports.join(", ")}`
        );
      } else {
        toast.error("All exports failed. Please try again.");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [selected, exporters, options, tokens, styleName]);

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-export-tokens">
            <Download className="w-4 h-4 mr-2" />
            Export Tokens
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Design Tokens
          </DialogTitle>
          <DialogDescription>
            Select one or more formats to download. All exports follow W3C DTCG 2025.10 specification.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4 pb-4">
            {CATEGORY_ORDER.map(category => {
              const info = CATEGORY_INFO[category];
              const categoryExporters = exportersByCategory[category];
              if (categoryExporters.length === 0) return null;
              
              const selectedInCategory = categoryExporters.filter(e => selected.has(e.id)).length;
              const isExpanded = expandedCategories.has(category);
              
              return (
                <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                        data-testid={`category-toggle-${category}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{info.icon}</span>
                          <div className="text-left">
                            <div className="font-medium text-sm">{info.label}</div>
                            <div className="text-xs text-muted-foreground">{info.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedInCategory > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {selectedInCategory} selected
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="border-t border-border">
                        <div className="flex items-center justify-end gap-2 px-4 py-2 bg-muted/10 border-b border-border/50">
                          <button
                            onClick={() => selectAll(category)}
                            className="text-xs text-primary hover:underline"
                            data-testid={`select-all-${category}`}
                          >
                            Select all
                          </button>
                          <span className="text-muted-foreground text-xs">|</span>
                          <button
                            onClick={() => deselectAll(category)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            data-testid={`deselect-all-${category}`}
                          >
                            Clear
                          </button>
                        </div>
                        
                        <div className="divide-y divide-border/50">
                          {categoryExporters.map(exporter => (
                            <ExporterRow
                              key={exporter.id}
                              exporter={exporter}
                              selected={selected.has(exporter.id)}
                              onToggle={() => toggleSelection(exporter.id)}
                              options={options[exporter.id] || {}}
                              onOptionChange={(optionId, value) => updateOption(exporter.id, optionId, value)}
                            />
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <div className="text-sm text-muted-foreground">
            {selectedCount === 0 ? (
              "Select at least one format"
            ) : (
              `${selectedCount} format${selectedCount > 1 ? "s" : ""} selected`
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              data-testid="button-cancel-export"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={selectedCount === 0 || downloading}
              data-testid="button-confirm-export"
            >
              {downloading ? (
                "Downloading..."
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download {selectedCount > 0 ? `(${selectedCount})` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ExporterRowProps {
  exporter: ExporterDefinition;
  selected: boolean;
  onToggle: () => void;
  options: Record<string, any>;
  onOptionChange: (optionId: string, value: any) => void;
}

function ExporterRow({ exporter, selected, onToggle, options, onOptionChange }: ExporterRowProps) {
  const [showOptions, setShowOptions] = useState(false);
  const hasOptions = exporter.subOptions && exporter.subOptions.length > 0;
  
  useEffect(() => {
    if (selected && hasOptions) {
      setShowOptions(true);
    }
  }, [selected, hasOptions]);
  
  return (
    <div className={`transition-colors ${selected ? "bg-primary/5" : ""}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Checkbox
          id={`exporter-${exporter.id}`}
          checked={selected}
          onCheckedChange={onToggle}
          className="mt-0.5"
          data-testid={`checkbox-exporter-${exporter.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <label
              htmlFor={`exporter-${exporter.id}`}
              className="font-medium text-sm cursor-pointer"
            >
              {exporter.name}
            </label>
            <Badge variant="outline" className="text-[10px] font-mono">
              .{exporter.extension}
            </Badge>
            {exporter.serverSide && (
              <Badge variant="secondary" className="text-[10px]">
                Server
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {exporter.description}
          </p>
        </div>
        
        {hasOptions && selected && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className={`p-1.5 rounded-md transition-colors ${
                    showOptions ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-options-${exporter.id}`}
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Export options</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {hasOptions && selected && showOptions && (
        <div className="px-4 pb-3 pt-1 pl-10 space-y-3 bg-muted/20 border-t border-border/30">
          {exporter.subOptions!.map(option => (
            <SubOptionControl
              key={option.id}
              option={option}
              value={options[option.id] ?? option.default}
              onChange={(value) => onOptionChange(option.id, value)}
              exporterId={exporter.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SubOptionControlProps {
  option: ExporterSubOption;
  value: any;
  onChange: (value: any) => void;
  exporterId: string;
}

function SubOptionControl({ option, value, onChange, exporterId }: SubOptionControlProps) {
  if (option.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label
          htmlFor={`${exporterId}-${option.id}`}
          className="text-xs font-normal text-muted-foreground cursor-pointer"
        >
          {option.label}
        </Label>
        <Switch
          id={`${exporterId}-${option.id}`}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          data-testid={`switch-${exporterId}-${option.id}`}
        />
      </div>
    );
  }
  
  if (option.type === "select" && option.options) {
    return (
      <div className="flex items-center justify-between gap-4">
        <Label
          htmlFor={`${exporterId}-${option.id}`}
          className="text-xs font-normal text-muted-foreground"
        >
          {option.label}
        </Label>
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger
            id={`${exporterId}-${option.id}`}
            className="h-7 w-[160px] text-xs"
            data-testid={`select-${exporterId}-${option.id}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {option.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  
  return null;
}
