import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ExternalLink, AlertCircle, Check, X, Minus } from "lucide-react";
import { motion } from "framer-motion";

interface Style {
  id: string;
  name: string;
  tokens: Record<string, any>;
  previews?: {
    landscape?: string;
    portrait?: string;
  };
  uiConcepts?: {
    dashboard?: string;
  };
  referenceImages?: string[];
}

interface TokenDiff {
  key: string;
  path: string[];
  leftValue: any;
  rightValue: any;
  status: "same" | "different" | "left-only" | "right-only";
}

function getTokenValue(token: any): any {
  if (token && typeof token === "object" && "$value" in token) {
    return token.$value;
  }
  return token;
}

function flattenTokens(tokens: Record<string, any>, prefix: string[] = []): Record<string, { path: string[]; value: any }> {
  const result: Record<string, { path: string[]; value: any }> = {};
  
  for (const [key, value] of Object.entries(tokens)) {
    const currentPath = [...prefix, key];
    const pathKey = currentPath.join(".");
    
    if (value && typeof value === "object" && !("$value" in value) && !("$type" in value)) {
      const nested = flattenTokens(value, currentPath);
      Object.assign(result, nested);
    } else {
      result[pathKey] = { path: currentPath, value: getTokenValue(value) };
    }
  }
  
  return result;
}

function compareTokens(leftTokens: Record<string, any>, rightTokens: Record<string, any>): TokenDiff[] {
  const leftFlat = flattenTokens(leftTokens);
  const rightFlat = flattenTokens(rightTokens);
  const allKeys = Array.from(new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)]));
  
  const diffs: TokenDiff[] = [];
  
  for (const key of allKeys) {
    const left = leftFlat[key];
    const right = rightFlat[key];
    
    if (left && right) {
      const leftVal = JSON.stringify(left.value);
      const rightVal = JSON.stringify(right.value);
      diffs.push({
        key,
        path: left.path,
        leftValue: left.value,
        rightValue: right.value,
        status: leftVal === rightVal ? "same" : "different",
      });
    } else if (left) {
      diffs.push({
        key,
        path: left.path,
        leftValue: left.value,
        rightValue: null,
        status: "left-only",
      });
    } else if (right) {
      diffs.push({
        key,
        path: right.path,
        leftValue: null,
        rightValue: right.value,
        status: "right-only",
      });
    }
  }
  
  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}

function isColorValue(value: any): boolean {
  if (typeof value !== "string") return false;
  return /^#[0-9a-fA-F]{3,8}$/.test(value) || 
         /^rgb/.test(value) || 
         /^hsl/.test(value) ||
         /^oklch/.test(value);
}

function ColorSwatch({ color, size = "md" }: { color: string; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  return (
    <div
      className={`${sizeClass} rounded border border-border shadow-sm`}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

function TokenValueDisplay({ value, showLabel = true }: { value: any; showLabel?: boolean }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">—</span>;
  }
  
  if (isColorValue(value)) {
    return (
      <div className="flex items-center gap-2">
        <ColorSwatch color={value} size="sm" />
        {showLabel && <code className="text-xs">{value}</code>}
      </div>
    );
  }
  
  if (typeof value === "number") {
    return <code className="text-sm font-mono">{value}</code>;
  }
  
  if (typeof value === "string") {
    return <code className="text-sm font-mono truncate max-w-[200px]">{value}</code>;
  }
  
  return <code className="text-xs font-mono">{JSON.stringify(value)}</code>;
}

function DiffStatusBadge({ status }: { status: TokenDiff["status"] }) {
  switch (status) {
    case "same":
      return <Badge variant="outline" className="text-green-600 border-green-300"><Check className="w-3 h-3 mr-1" />Same</Badge>;
    case "different":
      return <Badge variant="outline" className="text-amber-600 border-amber-300"><AlertCircle className="w-3 h-3 mr-1" />Different</Badge>;
    case "left-only":
      return <Badge variant="outline" className="text-blue-600 border-blue-300"><Minus className="w-3 h-3 mr-1" />Left only</Badge>;
    case "right-only":
      return <Badge variant="outline" className="text-purple-600 border-purple-300"><Minus className="w-3 h-3 mr-1" />Right only</Badge>;
  }
}

function StyleHeader({ style, side }: { style: Style; side: "left" | "right" }) {
  const thumbnail = style.uiConcepts?.dashboard || style.previews?.landscape || style.previews?.portrait || style.referenceImages?.[0];
  
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      {thumbnail && (
        <img 
          src={thumbnail} 
          alt={style.name} 
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{style.name}</h3>
        <Link href={`/style/${style.id}`}>
          <span className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer">
            View style <ExternalLink className="w-3 h-3" />
          </span>
        </Link>
      </div>
      <Badge variant={side === "left" ? "default" : "secondary"}>
        {side === "left" ? "Style A" : "Style B"}
      </Badge>
    </div>
  );
}

function ComparisonTable({ diffs, showOnlyDifferences }: { diffs: TokenDiff[]; showOnlyDifferences: boolean }) {
  const filteredDiffs = showOnlyDifferences 
    ? diffs.filter(d => d.status !== "same")
    : diffs;
  
  const groupedDiffs = useMemo(() => {
    const groups = new Map<string, TokenDiff[]>();
    for (const diff of filteredDiffs) {
      const category = diff.path[0] || "other";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(diff);
    }
    return groups;
  }, [filteredDiffs]);

  if (filteredDiffs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {showOnlyDifferences ? "No differences found - these styles are identical!" : "No tokens to compare"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedDiffs.entries()).map(([category, categoryDiffs]) => (
        <div key={category}>
          <h4 className="font-medium text-lg mb-3 capitalize">{category}</h4>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium w-1/4">Token</th>
                  <th className="text-left p-3 font-medium w-1/4">Style A</th>
                  <th className="text-left p-3 font-medium w-1/4">Style B</th>
                  <th className="text-left p-3 font-medium w-1/4">Status</th>
                </tr>
              </thead>
              <tbody>
                {categoryDiffs.map((diff, idx) => (
                  <tr 
                    key={diff.key} 
                    className={`border-t ${
                      diff.status === "different" ? "bg-amber-50/50 dark:bg-amber-950/20" :
                      diff.status === "left-only" ? "bg-blue-50/50 dark:bg-blue-950/20" :
                      diff.status === "right-only" ? "bg-purple-50/50 dark:bg-purple-950/20" :
                      idx % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    <td className="p-3">
                      <code className="text-xs break-all">{diff.path.slice(1).join(".") || diff.path[0]}</code>
                    </td>
                    <td className="p-3">
                      <TokenValueDisplay value={diff.leftValue} />
                    </td>
                    <td className="p-3">
                      <TokenValueDisplay value={diff.rightValue} />
                    </td>
                    <td className="p-3">
                      <DiffStatusBadge status={diff.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorPaletteComparison({ leftTokens, rightTokens }: { leftTokens: Record<string, any>; rightTokens: Record<string, any> }) {
  const extractColors = (tokens: Record<string, any>): { name: string; color: string }[] => {
    const colors: { name: string; color: string }[] = [];
    const colorSection = tokens.color || {};
    
    const traverse = (obj: any, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${key}` : key;
        const val = getTokenValue(value);
        if (isColorValue(val)) {
          colors.push({ name, color: val });
        } else if (value && typeof value === "object" && !("$value" in value)) {
          traverse(value, name);
        }
      }
    };
    
    traverse(colorSection);
    return colors;
  };

  const leftColors = extractColors(leftTokens);
  const rightColors = extractColors(rightTokens);

  if (leftColors.length === 0 && rightColors.length === 0) {
    return null;
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="p-4">
        <h4 className="font-medium mb-3">Style A Palette</h4>
        <div className="flex flex-wrap gap-2">
          {leftColors.map(({ name, color }) => (
            <div key={name} className="flex items-center gap-2 p-2 bg-muted/50 rounded" title={name}>
              <ColorSwatch color={color} />
              <span className="text-xs font-mono">{color}</span>
            </div>
          ))}
          {leftColors.length === 0 && (
            <span className="text-muted-foreground text-sm">No color tokens</span>
          )}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="font-medium mb-3">Style B Palette</h4>
        <div className="flex flex-wrap gap-2">
          {rightColors.map(({ name, color }) => (
            <div key={name} className="flex items-center gap-2 p-2 bg-muted/50 rounded" title={name}>
              <ColorSwatch color={color} />
              <span className="text-xs font-mono">{color}</span>
            </div>
          ))}
          {rightColors.length === 0 && (
            <span className="text-muted-foreground text-sm">No color tokens</span>
          )}
        </div>
      </Card>
    </div>
  );
}

function TypographyComparison({ leftTokens, rightTokens }: { leftTokens: Record<string, any>; rightTokens: Record<string, any> }) {
  interface TypographyToken {
    name: string;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string | number;
    lineHeight?: string | number;
  }

  const extractTypography = (tokens: Record<string, any>): TypographyToken[] => {
    const result: TypographyToken[] = [];
    const typography = tokens.typography || {};
    
    const traverse = (obj: any, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === "object") {
          const hasType = "$type" in value;
          const hasValue = "$value" in value;
          
          if (hasType && hasValue) {
            const tokenType = (value as any).$type;
            const tokenValue = (value as any).$value;
            
            if (tokenType === "fontFamily" || key.toLowerCase().includes("family")) {
              result.push({ name, fontFamily: String(tokenValue) });
            } else if (tokenType === "fontSize" || tokenType === "dimension" || key.toLowerCase().includes("size")) {
              result.push({ name, fontSize: String(tokenValue) });
            } else if (tokenType === "fontWeight" || key.toLowerCase().includes("weight")) {
              result.push({ name, fontWeight: tokenValue });
            } else if (tokenType === "lineHeight" || key.toLowerCase().includes("height")) {
              result.push({ name, lineHeight: tokenValue });
            } else if (tokenType === "typography") {
              if (typeof tokenValue === "object" && tokenValue !== null) {
                result.push({
                  name,
                  fontFamily: tokenValue.fontFamily,
                  fontSize: tokenValue.fontSize,
                  fontWeight: tokenValue.fontWeight,
                  lineHeight: tokenValue.lineHeight,
                });
              } else if (typeof tokenValue === "string") {
                result.push({ name, fontFamily: tokenValue });
              }
            }
          } else if (!hasValue) {
            traverse(value, name);
          }
        } else if (typeof value === "string" || typeof value === "number") {
          if (key.toLowerCase().includes("family") || key === "fontFamily") {
            result.push({ name, fontFamily: String(value) });
          } else if (key.toLowerCase().includes("size") || key === "fontSize") {
            result.push({ name, fontSize: String(value) });
          } else if (key.toLowerCase().includes("weight") || key === "fontWeight") {
            result.push({ name, fontWeight: value });
          }
        }
      }
    };
    
    traverse(typography);
    
    if (result.length === 0 && tokens.fontFamily) {
      const val = getTokenValue(tokens.fontFamily);
      if (typeof val === "string") {
        result.push({ name: "fontFamily", fontFamily: val });
      }
    }
    
    return result;
  };

  const leftTypo = extractTypography(leftTokens);
  const rightTypo = extractTypography(rightTokens);

  if (leftTypo.length === 0 && rightTypo.length === 0) {
    return null;
  }

  const TypoCard = ({ tokens, title }: { tokens: TypographyToken[]; title: string }) => (
    <Card className="p-4">
      <h4 className="font-medium mb-3">{title}</h4>
      <div className="space-y-3">
        {tokens.length === 0 ? (
          <span className="text-muted-foreground text-sm">No typography tokens</span>
        ) : (
          tokens.slice(0, 6).map((t) => {
            const isAlias = (v: any) => typeof v === "string" && v.startsWith("{") && v.endsWith("}");
            const safeFont = t.fontFamily && !isAlias(t.fontFamily) ? t.fontFamily : "inherit";
            const safeSize = t.fontSize && !isAlias(t.fontSize) ? t.fontSize : "inherit";
            const safeWeight = t.fontWeight && !isAlias(t.fontWeight) ? t.fontWeight : "inherit";
            
            return (
              <div key={t.name} className="p-3 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground mb-1">{t.name}</div>
                <div 
                  className="text-lg truncate"
                  style={{ 
                    fontFamily: safeFont,
                    fontSize: safeSize,
                    fontWeight: safeWeight,
                  }}
                >
                  The quick brown fox
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {[t.fontFamily, t.fontSize, t.fontWeight].filter(Boolean).join(" • ")}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <TypoCard tokens={leftTypo} title="Style A Typography" />
      <TypoCard tokens={rightTypo} title="Style B Typography" />
    </div>
  );
}

function SpacingComparison({ leftTokens, rightTokens }: { leftTokens: Record<string, any>; rightTokens: Record<string, any> }) {
  const extractSpacing = (tokens: Record<string, any>): { name: string; value: string }[] => {
    const result: { name: string; value: string }[] = [];
    const spacing = tokens.spacing || {};
    
    const traverse = (obj: any, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${key}` : key;
        const val = getTokenValue(value);
        
        if (typeof val === "string" || typeof val === "number") {
          result.push({ name, value: String(val) });
        } else if (value && typeof value === "object" && !("$value" in value)) {
          traverse(value, name);
        }
      }
    };
    
    traverse(spacing);
    return result.sort((a, b) => {
      const aNum = parseFloat(a.value);
      const bNum = parseFloat(b.value);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.name.localeCompare(b.name);
    });
  };

  const leftSpacing = extractSpacing(leftTokens);
  const rightSpacing = extractSpacing(rightTokens);

  if (leftSpacing.length === 0 && rightSpacing.length === 0) {
    return null;
  }

  const SpacingCard = ({ tokens, title }: { tokens: { name: string; value: string }[]; title: string }) => (
    <Card className="p-4">
      <h4 className="font-medium mb-3">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {tokens.length === 0 ? (
          <span className="text-muted-foreground text-sm">No spacing tokens</span>
        ) : (
          tokens.map((t) => {
            const numVal = parseFloat(t.value);
            const width = !isNaN(numVal) ? Math.min(Math.max(numVal, 4), 80) : 16;
            return (
              <div key={t.name} className="flex items-center gap-2 p-2 bg-muted/50 rounded" title={t.name}>
                <div 
                  className="h-4 bg-primary/60 rounded"
                  style={{ width: `${width}px` }}
                />
                <span className="text-xs font-mono">{t.value}</span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <SpacingCard tokens={leftSpacing} title="Style A Spacing" />
      <SpacingCard tokens={rightSpacing} title="Style B Spacing" />
    </div>
  );
}

function ComparisonSummary({ diffs }: { diffs: TokenDiff[] }) {
  const stats = useMemo(() => {
    let same = 0, different = 0, leftOnly = 0, rightOnly = 0;
    for (const diff of diffs) {
      switch (diff.status) {
        case "same": same++; break;
        case "different": different++; break;
        case "left-only": leftOnly++; break;
        case "right-only": rightOnly++; break;
      }
    }
    const total = diffs.length;
    const similarity = total > 0 ? Math.round((same / total) * 100) : 0;
    return { same, different, leftOnly, rightOnly, total, similarity };
  }, [diffs]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold text-primary">{stats.similarity}%</div>
        <div className="text-xs text-muted-foreground">Similarity</div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.same}</div>
        <div className="text-xs text-muted-foreground">Identical</div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold text-amber-600">{stats.different}</div>
        <div className="text-xs text-muted-foreground">Different</div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold text-blue-600">{stats.leftOnly}</div>
        <div className="text-xs text-muted-foreground">Only in A</div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold text-purple-600">{stats.rightOnly}</div>
        <div className="text-xs text-muted-foreground">Only in B</div>
      </Card>
    </div>
  );
}

export default function Compare() {
  const [location] = useLocation();
  const [leftStyle, setLeftStyle] = useState<Style | null>(null);
  const [rightStyle, setRightStyle] = useState<Style | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const style1Id = searchParams.get("style1");
  const style2Id = searchParams.get("style2");

  useEffect(() => {
    if (!style1Id || !style2Id) {
      setError("Please provide two styles to compare using ?style1=ID&style2=ID");
      setLoading(false);
      return;
    }

    const fetchStyles = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [res1, res2] = await Promise.all([
          fetch(`/api/styles/${style1Id}`),
          fetch(`/api/styles/${style2Id}`),
        ]);

        if (!res1.ok || !res2.ok) {
          throw new Error("Failed to fetch one or both styles");
        }

        const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
        setLeftStyle(data1);
        setRightStyle(data2);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load styles");
      } finally {
        setLoading(false);
      }
    };

    fetchStyles();
  }, [style1Id, style2Id]);

  const diffs = useMemo(() => {
    if (!leftStyle || !rightStyle) return [];
    return compareTokens(leftStyle.tokens, rightStyle.tokens);
  }, [leftStyle, rightStyle]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner className="size-8" />
        </div>
      </Layout>
    );
  }

  if (error || !leftStyle || !rightStyle) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-medium mb-2">Cannot Compare Styles</h1>
          <p className="text-muted-foreground mb-6">{error || "Please select two styles to compare"}</p>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Gallery
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-4 py-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Gallery
              </Button>
            </Link>
            <h1 className="text-2xl font-serif font-medium">Compare Styles</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
            data-testid="button-toggle-differences"
          >
            {showOnlyDifferences ? "Show All Tokens" : "Show Only Differences"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <StyleHeader style={leftStyle} side="left" />
          <StyleHeader style={rightStyle} side="right" />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Comparison Summary</h2>
          <ComparisonSummary diffs={diffs} />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Color Palettes</h2>
          <ColorPaletteComparison leftTokens={leftStyle.tokens} rightTokens={rightStyle.tokens} />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Typography</h2>
          <TypographyComparison leftTokens={leftStyle.tokens} rightTokens={rightStyle.tokens} />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Spacing</h2>
          <SpacingComparison leftTokens={leftStyle.tokens} rightTokens={rightStyle.tokens} />
        </div>

        <div>
          <h2 className="text-lg font-medium mb-4">All Tokens</h2>
          <ComparisonTable diffs={diffs} showOnlyDifferences={showOnlyDifferences} />
        </div>
      </motion.div>
    </Layout>
  );
}
