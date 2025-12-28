import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { 
  Search, 
  Upload, 
  Code, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Copy,
  FileText,
  Loader2,
  Palette,
  Type,
  Grid3X3,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AuditResult {
  overallScore: number;
  colorScore: number;
  typographyScore: number;
  spacingScore: number;
  consistencyScore: number;
  colorInconsistencies: Array<{
    detected: string;
    expected: string;
    location: string;
    severity: "low" | "medium" | "high";
    suggestion: string;
  }>;
  typographyInconsistencies: Array<{
    detected: string;
    expected: string;
    location: string;
    severity: "low" | "medium" | "high";
    suggestion: string;
  }>;
  spacingInconsistencies: Array<{
    detected: string;
    expected: string;
    location: string;
    severity: "low" | "medium" | "high";
    suggestion: string;
  }>;
  componentInconsistencies: Array<{
    component: string;
    issue: string;
    severity: "low" | "medium" | "high";
    suggestion: string;
  }>;
  suggestions: string[];
  summary: string;
  detectedColors: string[];
  detectedFonts: string[];
  analyzedAt: string;
}

interface CodeAuditResult {
  overallScore: number;
  tokenUsage: {
    used: string[];
    unused: string[];
    undefined: string[];
  };
  hardcodedValues: Array<{
    type: "color" | "spacing" | "typography";
    value: string;
    file: string;
    line: number;
    suggestion: string;
  }>;
  inconsistencies: Array<{
    type: string;
    description: string;
    files: string[];
    suggestion: string;
  }>;
  summary: string;
}

interface StyleAuditProps {
  styleId: string;
  styleName: string;
  tokens: Record<string, any>;
  trigger?: React.ReactNode;
}

function ScoreCircle({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const getColor = (s: number) => {
    if (s >= 90) return "#22c55e";
    if (s >= 80) return "#84cc16";
    if (s >= 70) return "#eab308";
    if (s >= 60) return "#f97316";
    return "#ef4444";
  };

  const getGrade = (s: number) => {
    if (s >= 90) return "A";
    if (s >= 80) return "B";
    if (s >= 70) return "C";
    if (s >= 60) return "D";
    return "F";
  };

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const isLarge = size === "lg";

  return (
    <div className={cn("relative", isLarge ? "w-32 h-32" : "w-16 h-16")}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold", isLarge ? "text-3xl" : "text-lg")} style={{ color: getColor(score) }}>
          {getGrade(score)}
        </span>
        <span className={cn("text-muted-foreground", isLarge ? "text-sm" : "text-xs")}>{score}</span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const config = {
    low: { color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: CheckCircle2 },
    medium: { color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: AlertTriangle },
    high: { color: "bg-red-500/10 text-red-600 border-red-500/30", icon: XCircle },
  };

  const { color, icon: Icon } = config[severity];

  return (
    <Badge variant="outline" className={cn("gap-1", color)}>
      <Icon className="w-3 h-3" />
      {severity}
    </Badge>
  );
}

function IssueCard({ 
  title, 
  detected, 
  expected, 
  location, 
  severity, 
  suggestion,
  type
}: { 
  title?: string;
  detected: string;
  expected: string;
  location: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
  type: "color" | "typography" | "spacing" | "component";
}) {
  return (
    <div className="p-3 border border-border rounded-lg bg-muted/20 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {type === "color" && <Palette className="w-4 h-4 text-muted-foreground" />}
          {type === "typography" && <Type className="w-4 h-4 text-muted-foreground" />}
          {type === "spacing" && <Grid3X3 className="w-4 h-4 text-muted-foreground" />}
          {type === "component" && <Layers className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{title || location}</span>
        </div>
        <SeverityBadge severity={severity} />
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Detected:</span>
          <div className="flex items-center gap-2 mt-1">
            {type === "color" && (
              <div 
                className="w-4 h-4 rounded border border-border" 
                style={{ backgroundColor: detected }}
              />
            )}
            <code className="bg-muted px-1 py-0.5 rounded">{detected}</code>
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Expected:</span>
          <div className="flex items-center gap-2 mt-1">
            {type === "color" && (
              <div 
                className="w-4 h-4 rounded border border-border" 
                style={{ backgroundColor: expected }}
              />
            )}
            <code className="bg-muted px-1 py-0.5 rounded">{expected}</code>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground">{suggestion}</p>
    </div>
  );
}

export function StyleAudit({ styleId, styleName, tokens, trigger }: StyleAuditProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"screenshot" | "code">("screenshot");
  const [isAuditing, setIsAuditing] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [codeAuditResult, setCodeAuditResult] = useState<CodeAuditResult | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeFileType, setCodeFileType] = useState<"css" | "tailwind" | "jsx" | "tsx">("css");
  const [report, setReport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshotPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAuditScreenshot = useCallback(async () => {
    if (!screenshotPreview) {
      toast.error("Please upload a screenshot first");
      return;
    }

    setIsAuditing(true);
    setAuditResult(null);

    try {
      const response = await fetch(`/api/styles/${styleId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: screenshotPreview }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Audit failed");
      }

      const data = await response.json();
      setAuditResult(data.result);
      setReport(data.report);
      toast.success("Audit complete!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audit failed");
    } finally {
      setIsAuditing(false);
    }
  }, [screenshotPreview, styleId]);

  const handleAuditCode = useCallback(async () => {
    if (!codeInput.trim()) {
      toast.error("Please paste some code to audit");
      return;
    }

    setIsAuditing(true);
    setCodeAuditResult(null);

    try {
      const response = await fetch(`/api/styles/${styleId}/audit-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput, fileType: codeFileType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Code audit failed");
      }

      const data = await response.json();
      setCodeAuditResult(data.result);
      toast.success("Code audit complete!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Code audit failed");
    } finally {
      setIsAuditing(false);
    }
  }, [codeInput, codeFileType, styleId]);

  const handleDownloadReport = useCallback(() => {
    if (!report) return;
    
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${styleName.toLowerCase().replace(/\s+/g, "-")}-audit-report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  }, [report, styleName]);

  const handleCopyReport = useCallback(async () => {
    if (!report) return;
    
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Report copied to clipboard");
    } catch {
      toast.error("Failed to copy report");
    }
  }, [report]);

  const totalIssues = auditResult ? (
    auditResult.colorInconsistencies.length +
    auditResult.typographyInconsistencies.length +
    auditResult.spacingInconsistencies.length +
    auditResult.componentInconsistencies.length
  ) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-audit">
            <Search className="w-4 h-4 mr-2" />
            Style Audit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Style Audit: {styleName}
          </DialogTitle>
          <DialogDescription>
            Analyze screenshots or code against your style guide to find inconsistencies
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="screenshot" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Screenshot Audit
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Code Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="screenshot" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 pr-4">
                {!auditResult ? (
                  <>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                        screenshotPreview 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      {screenshotPreview ? (
                        <div className="space-y-3">
                          <img 
                            src={screenshotPreview} 
                            alt="Screenshot" 
                            className="max-h-64 mx-auto rounded-lg shadow-lg"
                          />
                          <p className="text-sm text-muted-foreground">Click to replace</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm font-medium">Upload UI Screenshot</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG, JPG, or WebP - Max 10MB
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      className="hidden"
                    />
                    <Button 
                      onClick={handleAuditScreenshot}
                      disabled={!screenshotPreview || isAuditing}
                      className="w-full"
                    >
                      {isAuditing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Run Audit
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={() => setAuditResult(null)}>
                        ← New Audit
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopyReport}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
                      <ScoreCircle score={auditResult.overallScore} />
                      <div className="flex-1 space-y-3">
                        <p className="text-sm">{auditResult.summary}</p>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center">
                            <div className="text-lg font-bold">{auditResult.colorScore}</div>
                            <div className="text-xs text-muted-foreground">Colors</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold">{auditResult.typographyScore}</div>
                            <div className="text-xs text-muted-foreground">Typography</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold">{auditResult.spacingScore}</div>
                            <div className="text-xs text-muted-foreground">Spacing</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold">{auditResult.consistencyScore}</div>
                            <div className="text-xs text-muted-foreground">Consistency</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {totalIssues > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Issues Found ({totalIssues})
                        </h4>

                        {auditResult.colorInconsistencies.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Palette className="w-4 h-4" />
                              Color Issues ({auditResult.colorInconsistencies.length})
                            </h5>
                            {auditResult.colorInconsistencies.map((issue, i) => (
                              <IssueCard key={i} {...issue} type="color" />
                            ))}
                          </div>
                        )}

                        {auditResult.typographyInconsistencies.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Type className="w-4 h-4" />
                              Typography Issues ({auditResult.typographyInconsistencies.length})
                            </h5>
                            {auditResult.typographyInconsistencies.map((issue, i) => (
                              <IssueCard key={i} {...issue} type="typography" />
                            ))}
                          </div>
                        )}

                        {auditResult.spacingInconsistencies.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Grid3X3 className="w-4 h-4" />
                              Spacing Issues ({auditResult.spacingInconsistencies.length})
                            </h5>
                            {auditResult.spacingInconsistencies.map((issue, i) => (
                              <IssueCard key={i} {...issue} type="spacing" />
                            ))}
                          </div>
                        )}

                        {auditResult.componentInconsistencies.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Layers className="w-4 h-4" />
                              Component Issues ({auditResult.componentInconsistencies.length})
                            </h5>
                            {auditResult.componentInconsistencies.map((issue, i) => (
                              <IssueCard 
                                key={i} 
                                title={issue.component}
                                detected={issue.issue}
                                expected=""
                                location={issue.component}
                                severity={issue.severity}
                                suggestion={issue.suggestion}
                                type="component" 
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {auditResult.suggestions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Recommendations</h4>
                        <ul className="space-y-1">
                          {auditResult.suggestions.map((s, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {auditResult.detectedColors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Detected Colors</h4>
                        <div className="flex flex-wrap gap-2">
                          {auditResult.detectedColors.map((color, i) => (
                            <TooltipProvider key={i}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div 
                                    className="w-8 h-8 rounded-lg border border-border shadow-sm"
                                    style={{ backgroundColor: color }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>{color}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="code" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 pr-4">
                {!codeAuditResult ? (
                  <>
                    <div className="flex gap-2">
                      {(["css", "tailwind", "jsx", "tsx"] as const).map((type) => (
                        <Button
                          key={type}
                          variant={codeFileType === type ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCodeFileType(type)}
                        >
                          {type.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                    <textarea
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder={`Paste your ${codeFileType.toUpperCase()} code here...`}
                      className="w-full h-64 bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <Button 
                      onClick={handleAuditCode}
                      disabled={!codeInput.trim() || isAuditing}
                      className="w-full"
                    >
                      {isAuditing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing Code...
                        </>
                      ) : (
                        <>
                          <Code className="w-4 h-4 mr-2" />
                          Audit Code
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={() => setCodeAuditResult(null)}>
                        ← New Audit
                      </Button>
                      <ScoreCircle score={codeAuditResult.overallScore} size="sm" />
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm">{codeAuditResult.summary}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 border border-border rounded-lg">
                        <div className="text-lg font-bold text-green-500">{codeAuditResult.tokenUsage.used.length}</div>
                        <div className="text-xs text-muted-foreground">Tokens Used</div>
                      </div>
                      <div className="p-3 border border-border rounded-lg">
                        <div className="text-lg font-bold text-amber-500">{codeAuditResult.tokenUsage.unused.length}</div>
                        <div className="text-xs text-muted-foreground">Unused Tokens</div>
                      </div>
                      <div className="p-3 border border-border rounded-lg">
                        <div className="text-lg font-bold text-red-500">{codeAuditResult.hardcodedValues.length}</div>
                        <div className="text-xs text-muted-foreground">Hardcoded Values</div>
                      </div>
                    </div>

                    {codeAuditResult.hardcodedValues.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Hardcoded Values</h4>
                        {codeAuditResult.hardcodedValues.map((item, i) => (
                          <div key={i} className="p-3 border border-border rounded-lg bg-muted/20">
                            <div className="flex items-center justify-between">
                              <code className="text-sm bg-muted px-2 py-1 rounded">{item.value}</code>
                              <Badge variant="outline">{item.type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{item.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {codeAuditResult.inconsistencies.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Inconsistencies</h4>
                        {codeAuditResult.inconsistencies.map((item, i) => (
                          <div key={i} className="p-3 border border-border rounded-lg bg-muted/20">
                            <div className="font-medium text-sm">{item.type}</div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">{item.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
