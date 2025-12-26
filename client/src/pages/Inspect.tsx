import { useRoute, useLocation } from "wouter";
import { type StyleSpec } from "@/lib/store";
import { Layout } from "@/components/layout";
import { TokenViewer } from "@/components/token-viewer";
import { ColorPaletteSwatches } from "@/components/color-palette-swatches";
import { StyleSpecEditor } from "@/components/style-spec-editor";
import { ArrowLeft, ArrowRight, Download, Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Share2, Check, Copy, Bookmark, Star, User, FolderPlus, Folder, Plus, FileCode, FileJson, Paintbrush, History, RotateCcw, Save, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import { AiMoodBoard } from "@/components/ai-mood-board";
import { ExportDialog } from "@/components/export-dialog";
import { useAuth } from "@/hooks/use-auth";

interface StyleSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  tokens: any;
  referenceImages: string[];
  metadataTags: any;
  promptScaffolding: any;
  shareCode: string | null;
  moodBoardStatus: string;
  uiConceptsStatus: string;
  styleSpec: StyleSpec | null;
  updatedAt: string | null;
  imageIds?: Record<string, string>;
  creatorId?: string | null;
  creatorName?: string | null;
  isPublic?: boolean;
  neighbors?: { prevId: string | null; nextId: string | null };
}

interface StyleAssets {
  previews: {
    landscape?: string;
    portrait?: string;
    stillLife?: string;
  };
  moodBoard: any;
  uiConcepts: any;
}

interface StyleVersion {
  id: string;
  styleId: string;
  versionNumber: number;
  changeType: string;
  changeDescription: string | null;
  createdBy: string | null;
  tokens: any;
  promptScaffolding: any;
  metadataTags: any;
  createdAt: string;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-serif font-medium text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

function PreviewSkeleton({ aspect }: { aspect: string }) {
  return (
    <div className={`${aspect} bg-muted rounded-lg overflow-hidden border border-border animate-pulse`}>
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/30" />
      </div>
    </div>
  );
}

export default function Inspect() {
  const [, params] = useRoute("/style/:id");
  const [, navigate] = useLocation();
  const id = params?.id;
  const { user, isAuthenticated } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<StyleSummary | null>(null);
  const [assets, setAssets] = useState<StyleAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [tokensExpanded, setTokensExpanded] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  
  // Rating state
  const [userRating, setUserRating] = useState<number>(0);
  const [userReview, setUserReview] = useState<string>("");
  const [avgRating, setAvgRating] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const [ratingLoading, setRatingLoading] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  
  // Visibility state
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  
  // Collection state
  interface Collection {
    id: string;
    name: string;
    description: string | null;
  }
  const [collections, setCollections] = useState<Collection[]>([]);
  const [styleCollections, setStyleCollections] = useState<Set<string>>(new Set());
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // Version History
  const [versions, setVersions] = useState<StyleVersion[]>([]);
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [revertingVersion, setRevertingVersion] = useState<string | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  
  // Try It Now - Image Generation
  const [tryItOpen, setTryItOpen] = useState(false);
  const [tryItPrompt, setTryItPrompt] = useState("");
  const [tryItGenerating, setTryItGenerating] = useState(false);
  const [tryItImage, setTryItImage] = useState<string | null>(null);
  const [tryItError, setTryItError] = useState<string | null>(null);
  
  // Check if current user is the creator
  const isOwner = isAuthenticated && user?.id === summary?.creatorId;

  // Handle Try It Now image generation
  const handleTryItGenerate = useCallback(async () => {
    if (!id || !tryItPrompt.trim()) return;
    setTryItGenerating(true);
    setTryItError(null);
    setTryItImage(null);
    
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: tryItPrompt, styleId: id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setTryItImage(`data:image/jpeg;base64,${data.imageBase64}`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setTryItError(errorData.error || "Failed to generate image");
      }
    } catch (error) {
      setTryItError("Network error. Please try again.");
    } finally {
      setTryItGenerating(false);
    }
  }, [id, tryItPrompt]);

  const handleShare = useCallback(async () => {
    if (!id) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/styles/${id}/share`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setShareCode(data.shareCode);
      }
    } catch (error) {
      console.error("Failed to generate share code:", error);
    } finally {
      setShareLoading(false);
    }
  }, [id]);

  const handleCopyLink = useCallback(() => {
    if (!shareCode) return;
    const shareUrl = `${window.location.origin}/shared/${shareCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareCode]);

  const handleToggleBookmark = useCallback(async () => {
    if (!id || !isAuthenticated) return;
    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await fetch(`/api/styles/${id}/bookmark`, { method: "DELETE" });
        setIsBookmarked(false);
      } else {
        await fetch(`/api/styles/${id}/bookmark`, { method: "POST" });
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    } finally {
      setBookmarkLoading(false);
    }
  }, [id, isAuthenticated, isBookmarked]);

  const handleSubmitRating = useCallback(async (rating: number) => {
    if (!id || !isAuthenticated) return;
    setRatingLoading(true);
    try {
      const res = await fetch(`/api/styles/${id}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review: userReview }),
      });
      if (res.ok) {
        setUserRating(rating);
        const ratingsRes = await fetch(`/api/styles/${id}/ratings`);
        if (ratingsRes.ok) {
          const data = await ratingsRes.json();
          setAvgRating({ average: data.average, count: data.count });
        }
      }
    } catch (error) {
      console.error("Failed to submit rating:", error);
    } finally {
      setRatingLoading(false);
    }
  }, [id, isAuthenticated, userReview]);

  const handleToggleVisibility = useCallback(async () => {
    if (!id || !isOwner) return;
    setVisibilityLoading(true);
    try {
      const res = await fetch(`/api/styles/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (res.ok) {
        setIsPublic(!isPublic);
      }
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
    } finally {
      setVisibilityLoading(false);
    }
  }, [id, isOwner, isPublic]);

  // Fetch version history
  const fetchVersions = useCallback(async () => {
    if (!id) return;
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/styles/${id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (error) {
      console.error("Failed to fetch versions:", error);
    } finally {
      setVersionsLoading(false);
    }
  }, [id]);

  // Save current state as version
  const handleSaveVersion = useCallback(async () => {
    if (!id || !isAuthenticated) return;
    setSavingVersion(true);
    try {
      const res = await fetch(`/api/styles/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Manual snapshot" }),
      });
      if (res.ok) {
        await fetchVersions();
      }
    } catch (error) {
      console.error("Failed to save version:", error);
    } finally {
      setSavingVersion(false);
    }
  }, [id, isAuthenticated, fetchVersions]);

  // Revert to a previous version
  const handleRevertToVersion = useCallback(async (versionId: string) => {
    if (!id || !isAuthenticated) return;
    if (!confirm("Revert to this version? Current state will be saved first.")) return;
    
    setRevertingVersion(versionId);
    try {
      const res = await fetch(`/api/styles/${id}/versions/${versionId}/revert`, {
        method: "POST",
      });
      if (res.ok) {
        // Refresh the page to show updated data
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to revert version:", error);
    } finally {
      setRevertingVersion(null);
    }
  }, [id, isAuthenticated]);

  // Load versions when expanded
  useEffect(() => {
    if (versionsExpanded && versions.length === 0) {
      fetchVersions();
    }
  }, [versionsExpanded, fetchVersions, versions.length]);

  // Load bookmark, rating, and collection status
  useEffect(() => {
    if (!id || !isAuthenticated) return;
    
    const loadUserData = async () => {
      try {
        const [bookmarkRes, ratingRes, collectionsRes, styleCollectionsRes] = await Promise.all([
          fetch(`/api/styles/${id}/bookmark`),
          fetch(`/api/styles/${id}/my-rating`),
          fetch(`/api/collections`),
          fetch(`/api/styles/${id}/collections`),
        ]);
        
        if (bookmarkRes.ok) {
          const data = await bookmarkRes.json();
          setIsBookmarked(data.isBookmarked);
        }
        
        if (ratingRes.ok) {
          const data = await ratingRes.json();
          if (data) {
            setUserRating(data.rating);
            setUserReview(data.review || "");
          }
        }
        
        if (collectionsRes.ok) {
          const data = await collectionsRes.json();
          setCollections(data);
        }
        
        if (styleCollectionsRes.ok) {
          const data = await styleCollectionsRes.json();
          setStyleCollections(new Set(data.map((c: Collection) => c.id)));
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
      }
    };
    
    loadUserData();
  }, [id, isAuthenticated]);
  
  const handleToggleCollection = useCallback(async (collectionId: string) => {
    if (!id || !isAuthenticated) return;
    setCollectionsLoading(true);
    try {
      const isInCollection = styleCollections.has(collectionId);
      if (isInCollection) {
        await fetch(`/api/collections/${collectionId}/styles/${id}`, { method: "DELETE" });
        setStyleCollections(prev => {
          const next = new Set(prev);
          next.delete(collectionId);
          return next;
        });
      } else {
        await fetch(`/api/collections/${collectionId}/styles/${id}`, { method: "POST" });
        setStyleCollections(prev => new Set(prev).add(collectionId));
      }
    } catch (error) {
      console.error("Failed to toggle collection:", error);
    } finally {
      setCollectionsLoading(false);
    }
  }, [id, isAuthenticated, styleCollections]);

  // Load average rating (public)
  useEffect(() => {
    if (!id) return;
    
    const loadRatings = async () => {
      try {
        const res = await fetch(`/api/styles/${id}/ratings`);
        if (res.ok) {
          const data = await res.json();
          setAvgRating({ average: data.average, count: data.count });
        }
      } catch (error) {
        console.error("Failed to load ratings:", error);
      }
    };
    
    loadRatings();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/styles/${id}/summary`)
      .then(res => res.ok ? res.json() : null)
      .then((data: StyleSummary | null) => {
        setSummary(data);
        if (data?.shareCode) {
          setShareCode(data.shareCode);
        }
        if (data?.isPublic !== undefined) {
          setIsPublic(data.isPublic);
        }
      })
      .finally(() => setLoading(false));
    
    fetch(`/api/styles/${id}/assets`)
      .then(res => res.ok ? res.json() : null)
      .then((data: StyleAssets | null) => {
        setAssets(data);
      })
      .finally(() => setAssetsLoading(false));
  }, [id]);

  const refetchAssets = useCallback(() => {
    if (!id) return;
    fetch(`/api/styles/${id}/assets`)
      .then(res => res.ok ? res.json() : null)
      .then((data: StyleAssets | null) => {
        if (data) setAssets(data);
      });
  }, [id]);

  const moodBoardStatus = assets?.moodBoard?.status || summary?.moodBoardStatus;
  const uiConceptsStatus = assets?.uiConcepts?.status || summary?.uiConceptsStatus;
  
  useEffect(() => {
    if (!id) return;
    
    const isGenerating = 
      moodBoardStatus === "generating" || 
      moodBoardStatus === "pending" ||
      uiConceptsStatus === "generating" ||
      uiConceptsStatus === "pending";
    
    if (isGenerating) {
      const interval = setInterval(refetchAssets, 2000);
      return () => clearInterval(interval);
    }
  }, [id, moodBoardStatus, uiConceptsStatus, refetchAssets]);

  const convertTokensToCSS = (tokens: any): string => {
    const lines: string[] = [
      `/* ${summary?.name || 'Style'} - CSS Custom Properties */`,
      `/* Generated from W3C DTCG Design Tokens */`,
      '',
      ':root {'
    ];
    
    const processTokenTree = (obj: any, prefix: string = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        
        if (value && typeof value === 'object') {
          if ('$value' in value) {
            const rawName = `${prefix}${key}`
              .replace(/\./g, '-')
              .replace(/([A-Z])/g, '-$1')
              .toLowerCase()
              .replace(/-+/g, '-')
              .replace(/^-/, '');
            const cssVarName = `--${rawName}`;
            lines.push(`  ${cssVarName}: ${(value as any).$value};`);
          } else {
            processTokenTree(value, prefix ? `${prefix}${key}-` : `${key}-`);
          }
        }
      }
    };
    
    processTokenTree(tokens);
    
    lines.push('}');
    return lines.join('\n');
  };

  const convertTokensToSCSS = (tokens: any): string => {
    const lines: string[] = [
      `// ${summary?.name || 'Style'} - SCSS Variables`,
      `// Generated from W3C DTCG Design Tokens`,
      ''
    ];
    
    const categoryLabels: Record<string, string> = {
      color: 'Colors',
      spacing: 'Spacing', 
      borderRadius: 'Border Radius',
      typography: 'Typography',
      shadow: 'Shadows',
      elevation: 'Elevation',
      strokeWidth: 'Stroke Width',
      size: 'Sizes',
      lineHeight: 'Line Height',
      fontWeight: 'Font Weight',
      opacity: 'Opacity',
      border: 'Borders',
    };
    
    const processTokenTree = (obj: any, prefix: string = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        
        if (value && typeof value === 'object') {
          if ('$value' in value) {
            const scssVarName = `$${prefix}${key}`
              .replace(/\./g, '-')
              .replace(/([A-Z])/g, '-$1')
              .toLowerCase()
              .replace(/-+/g, '-');
            lines.push(`${scssVarName}: ${(value as any).$value};`);
          } else {
            processTokenTree(value, prefix ? `${prefix}${key}-` : `${key}-`);
          }
        }
      }
    };
    
    for (const [category, group] of Object.entries(tokens)) {
      if (category.startsWith('$') || !group || typeof group !== 'object') continue;
      
      const label = categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`// ${label}`);
      processTokenTree(group, `${category}-`);
      lines.push('');
    }
    
    return lines.join('\n');
  };

  const convertTokensToTailwind = (tokens: any): string => {
    const config: any = {
      theme: {
        extend: {
          colors: {},
          spacing: {},
          borderRadius: {},
          boxShadow: {},
          fontSize: {},
          fontWeight: {},
          lineHeight: {},
          opacity: {},
          borderWidth: {},
        }
      }
    };
    
    const flattenTokens = (obj: any, prefix: string = ''): Record<string, string> => {
      const result: Record<string, string> = {};
      if (!obj || typeof obj !== 'object') return result;
      
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        
        if (value && typeof value === 'object') {
          if ('$value' in value) {
            const flatKey = prefix ? `${prefix}-${key}` : key;
            result[flatKey] = (value as any).$value;
          } else {
            const nested = flattenTokens(value, prefix ? `${prefix}-${key}` : key);
            Object.assign(result, nested);
          }
        }
      }
      return result;
    };
    
    if (tokens.color) config.theme.extend.colors = flattenTokens(tokens.color);
    if (tokens.spacing) config.theme.extend.spacing = flattenTokens(tokens.spacing);
    if (tokens.borderRadius) config.theme.extend.borderRadius = flattenTokens(tokens.borderRadius);
    if (tokens.shadow) config.theme.extend.boxShadow = flattenTokens(tokens.shadow);
    if (tokens.typography) config.theme.extend.fontSize = flattenTokens(tokens.typography);
    if (tokens.fontWeight) config.theme.extend.fontWeight = flattenTokens(tokens.fontWeight);
    if (tokens.lineHeight) config.theme.extend.lineHeight = flattenTokens(tokens.lineHeight);
    if (tokens.opacity) config.theme.extend.opacity = flattenTokens(tokens.opacity);
    if (tokens.border) config.theme.extend.borderWidth = flattenTokens(tokens.border);
    
    for (const key of Object.keys(config.theme.extend)) {
      if (Object.keys(config.theme.extend[key]).length === 0) {
        delete config.theme.extend[key];
      }
    }
    
    return `// ${summary?.name || 'Style'} - Tailwind Config Extension
// Add this to your tailwind.config.js theme.extend section

module.exports = ${JSON.stringify(config, null, 2)}`;
  };

  const convertTokensToReact = (tokens: any, styleName: string): string => {
    const toCamelCase = (s: string) => s.split(/[-_\s.]+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    const toPascalCase = (s: string) => s.split(/[-_\s.]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    let safeName = toCamelCase(styleName.replace(/[^a-zA-Z0-9]/g, ' ')) || 'theme';
    if (/^[0-9]/.test(safeName)) safeName = '_' + safeName;
    
    const buildObject = (obj: any): any => {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
        if (value && typeof value === 'object') {
          if ('$value' in value) {
            result[safeKey] = (value as any).$value;
          } else {
            result[safeKey] = buildObject(value);
          }
        } else {
          result[safeKey] = value;
        }
      }
      return result;
    };
    
    const isValidJsIdentifier = (s: string) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
    
    const formatObject = (obj: any, indent: number): string => {
      if (typeof obj !== 'object' || obj === null) {
        return typeof obj === 'string' ? `"${obj}"` : String(obj);
      }
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      const pad = '  '.repeat(indent + 1);
      const closePad = '  '.repeat(indent);
      const lines = entries.map(([k, v]) => {
        const key = isValidJsIdentifier(k) ? k : `"${k}"`;
        return `${pad}${key}: ${formatObject(v, indent + 1)}`;
      });
      return `{\n${lines.join(',\n')}\n${closePad}}`;
    };
    
    const themeObj = buildObject(tokens);
    let typeName = toPascalCase(safeName);
    if (/^[0-9]/.test(typeName)) typeName = '_' + typeName;
    
    return `// Design Tokens: ${styleName}
// Generated by Visual DNA

export const ${safeName} = ${formatObject(themeObj, 0)} as const;

export type ${typeName}Theme = typeof ${safeName};

export default ${safeName};`;
  };

  const convertTokensToFlutter = (tokens: any, styleName: string): string => {
    const toPascalCase = (s: string) => s.split(/[-_\s.]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    const toCamelCase = (s: string) => s.split(/[-_\s.]+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    const sanitizeDartId = (s: string) => {
      let result = toCamelCase(s);
      if (/^[0-9]/.test(result)) result = 'n' + result;
      return result.replace(/[^a-zA-Z0-9_]/g, '_');
    };
    let className = toPascalCase(styleName.replace(/[^a-zA-Z0-9]/g, ' ')) || 'AppTheme';
    if (/^[0-9]/.test(className)) className = 'Theme' + className;
    
    const lines: string[] = [
      `// Design Tokens: ${styleName}`,
      `// Generated by Visual DNA`,
      '',
      "import 'package:flutter/material.dart';",
      '',
      `class ${className} {`,
      `  ${className}._();`,
      '',
    ];
    
    const flattenColors = (obj: any, prefix = ''): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        const name = prefix ? `${prefix}_${key}` : key;
        if (value && typeof value === 'object') {
          if ('$value' in value && typeof (value as any).$value === 'string') {
            result[name] = (value as any).$value;
          } else if (!('$value' in value)) {
            Object.assign(result, flattenColors(value, name));
          }
        }
      }
      return result;
    };
    
    const formatDartColor = (hex: string): string | null => {
      const h = hex.replace('#', '');
      if (/^[0-9a-fA-F]{6}$/.test(h)) return `Color(0xFF${h.toUpperCase()})`;
      if (/^[0-9a-fA-F]{8}$/.test(h)) return `Color(0x${h.toUpperCase()})`;
      if (/^[0-9a-fA-F]{3}$/.test(h)) return `Color(0xFF${h.split('').map(c => c + c).join('').toUpperCase()})`;
      return null;
    };
    
    if (tokens.color) {
      lines.push('  // Colors');
      for (const [key, value] of Object.entries(flattenColors(tokens.color))) {
        const dartName = sanitizeDartId(key);
        const colorValue = formatDartColor(value);
        if (colorValue) {
          lines.push(`  static const Color ${dartName} = ${colorValue};`);
        }
      }
      lines.push('');
    }
    
    const flattenSpacing = (obj: any, prefix = ''): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        const name = prefix ? `${prefix}_${key}` : key;
        if (value && typeof value === 'object') {
          if ('$value' in value) {
            result[name] = String((value as any).$value);
          } else if (!('$value' in value)) {
            Object.assign(result, flattenSpacing(value, name));
          }
        } else if (typeof value === 'string' || typeof value === 'number') {
          result[name] = String(value);
        }
      }
      return result;
    };
    
    if (tokens.spacing) {
      lines.push('  // Spacing');
      for (const [key, value] of Object.entries(flattenSpacing(tokens.spacing))) {
        const dartName = sanitizeDartId(key);
        const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
        if (!isNaN(numValue)) {
          lines.push(`  static const double ${dartName} = ${numValue};`);
        }
      }
      lines.push('');
    }
    
    lines.push('}');
    return lines.join('\n');
  };

  const convertTokensToFigma = (tokens: any, styleName: string): string => {
    const variables: any[] = [];
    const safeStyleName = styleName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const collectionId = `collection_${safeStyleName}`;
    const modeId = `mode_${safeStyleName}_default`;
    
    const hexToFigmaColor = (color: string): { r: number; g: number; b: number; a: number } => {
      let r = 0, g = 0, b = 0, a = 1;
      if (color.startsWith('#')) {
        const hex = color.slice(1);
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16) / 255;
          g = parseInt(hex[1] + hex[1], 16) / 255;
          b = parseInt(hex[2] + hex[2], 16) / 255;
        } else if (hex.length >= 6) {
          r = parseInt(hex.slice(0, 2), 16) / 255;
          g = parseInt(hex.slice(2, 4), 16) / 255;
          b = parseInt(hex.slice(4, 6), 16) / 255;
          if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
        }
      }
      return { r, g, b, a };
    };
    
    const addVariable = (path: string[], value: any, type: string) => {
      const name = path.join('/');
      const varId = `var_${path.join('_').replace(/[^a-z0-9_]/gi, '_')}`;
      let resolvedType = 'STRING';
      let resolvedValue: any = value;
      
      if (type === 'color' || (typeof value === 'string' && /^#|^rgb/.test(value))) {
        resolvedType = 'COLOR';
        resolvedValue = hexToFigmaColor(String(value));
      } else if (type === 'dimension' || type === 'spacing' || type === 'borderRadius') {
        resolvedType = 'FLOAT';
        resolvedValue = parseFloat(String(value).replace(/[^\d.-]/g, '')) || 0;
      } else if (typeof value === 'number') {
        resolvedType = 'FLOAT';
        resolvedValue = value;
      } else if (typeof value === 'boolean') {
        resolvedType = 'BOOLEAN';
        resolvedValue = value;
      } else {
        resolvedType = 'STRING';
        resolvedValue = String(value);
      }
      
      variables.push({ id: varId, name, resolvedType, valuesByMode: { [modeId]: resolvedValue } });
    };
    
    const traverse = (obj: any, path: string[] = []) => {
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') {
          if ('$value' in value) {
            addVariable([...path, key], (value as any).$value, (value as any).$type || '');
          } else {
            traverse(value, [...path, key]);
          }
        }
      }
    };
    traverse(tokens);
    
    return JSON.stringify({
      version: '1.0',
      meta: { name: styleName, generator: 'Visual DNA' },
      variableCollections: [{ id: collectionId, name: styleName, modes: [{ modeId, name: 'Default' }], defaultModeId: modeId }],
      variables,
    }, null, 2);
  };

  const convertTokensToAdobeXD = (tokens: any, styleName: string): string => {
    const assets: any = { version: 1, meta: { name: styleName, generator: 'Visual DNA' }, colors: [], characterStyles: [] };
    
    const parseColorToRGBA = (color: string) => {
      if (!color.startsWith('#')) return null;
      const hex = color.slice(1);
      let r = 0, g = 0, b = 0, a = 255;
      if (hex.length === 6) { r = parseInt(hex.slice(0,2),16); g = parseInt(hex.slice(2,4),16); b = parseInt(hex.slice(4,6),16); }
      else if (hex.length === 8) { r = parseInt(hex.slice(0,2),16); g = parseInt(hex.slice(2,4),16); b = parseInt(hex.slice(4,6),16); a = parseInt(hex.slice(6,8),16); }
      return { r, g, b, a: a/255 };
    };
    
    const extractColors = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const name = prefix ? `${prefix}/${key}` : key;
        if (value && typeof value === 'object') {
          if ('$value' in value && typeof (value as any).$value === 'string') {
            const rgba = parseColorToRGBA((value as any).$value);
            if (rgba) assets.colors.push({ name, value: { mode: 'RGB', value: rgba, alpha: rgba.a } });
          } else { extractColors(value, name); }
        }
      }
    };
    if (tokens.color) extractColors(tokens.color);
    
    const extractTypography = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const name = prefix ? `${prefix}/${key}` : key;
        if (value && typeof value === 'object') {
          if ('$value' in value) {
            const tokenObj = value as { $value: any; $type?: string };
            const type = tokenObj.$type || '';
            const val = tokenObj.$value;
            
            if (type === 'fontFamily' || key.toLowerCase().includes('family')) {
              assets.characterStyles.push({ name, style: { fontFamily: String(val) } });
            } else if (type === 'fontSize' || key.toLowerCase().includes('size')) {
              const sizeVal = parseFloat(String(val).replace(/[^\d.]/g, '')) || 16;
              assets.characterStyles.push({ name, style: { fontSize: sizeVal } });
            } else if (type === 'fontWeight' || key.toLowerCase().includes('weight')) {
              assets.characterStyles.push({ name, style: { fontWeight: val } });
            }
          } else {
            extractTypography(value, name);
          }
        }
      }
    };
    if (tokens.typography) extractTypography(tokens.typography);
    
    return JSON.stringify(assets, null, 2);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: 'json' | 'css' | 'scss' | 'tailwind' | 'react' | 'flutter' | 'figma' | 'adobe-xd') => {
    if (!summary) return;
    const baseName = summary.name.toLowerCase().replace(/\s+/g, "-");
    
    switch (format) {
      case 'json':
        downloadFile(JSON.stringify(summary.tokens, null, 2), `${baseName}-tokens.json`, 'application/json');
        break;
      case 'css':
        downloadFile(convertTokensToCSS(summary.tokens), `${baseName}-tokens.css`, 'text/css');
        break;
      case 'scss':
        downloadFile(convertTokensToSCSS(summary.tokens), `${baseName}-tokens.scss`, 'text/scss');
        break;
      case 'tailwind':
        downloadFile(convertTokensToTailwind(summary.tokens), `${baseName}-tailwind.config.js`, 'text/javascript');
        break;
      case 'react':
        downloadFile(convertTokensToReact(summary.tokens, summary.name), `${baseName}-theme.ts`, 'text/typescript');
        break;
      case 'flutter':
        downloadFile(convertTokensToFlutter(summary.tokens, summary.name), `${baseName}_theme.dart`, 'text/x-dart');
        break;
      case 'figma':
        downloadFile(convertTokensToFigma(summary.tokens, summary.name), `${baseName}-figma-variables.json`, 'application/json');
        break;
      case 'adobe-xd':
        downloadFile(convertTokensToAdobeXD(summary.tokens, summary.name), `${baseName}-adobe-xd.json`, 'application/json');
        break;
    }
  };

  const handleSpecUpdate = useCallback((newSpec: StyleSpec) => {
    if (summary) {
      setSummary({ ...summary, styleSpec: newSpec, updatedAt: new Date().toISOString() });
    }
  }, [summary]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  if (!summary) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <h1 className="text-2xl font-serif text-muted-foreground">Style Not Found</h1>
          <Link href="/" className="mt-4 text-sm underline">Return to Explorer</Link>
        </div>
      </Layout>
    );
  }

  const previews = assets?.previews || {};

  // Extract primary colors for Quick Read (first 6) - visual only
  const getPrimaryColors = () => {
    if (!summary?.tokens?.color) return [];
    const colors: string[] = [];
    const colorTokens = summary.tokens.color;
    
    const extractColors = (obj: any) => {
      for (const key in obj) {
        if (colors.length >= 6) break;
        const val = obj[key];
        if (val?.$value && typeof val.$value === 'string') {
          colors.push(val.$value);
        } else if (typeof val === 'object' && !val.$value) {
          extractColors(val);
        }
      }
    };
    extractColors(colorTokens);
    return colors;
  };
  
  const primaryColors = getPrimaryColors();
  
  // Derive human-readable traits from tokens
  const getHumanTraits = () => {
    const traits: { contrast: string; density: string; vibe: string } = {
      contrast: 'Medium',
      density: 'Balanced',
      vibe: ''
    };
    
    // Derive Contrast from color luminance range
    if (primaryColors.length >= 2) {
      const getLuminance = (color: string): number => {
        // Simple luminance estimation from hex/rgb
        let r = 0, g = 0, b = 0;
        if (color.startsWith('#')) {
          const hex = color.slice(1);
          r = parseInt(hex.slice(0, 2), 16) / 255;
          g = parseInt(hex.slice(2, 4), 16) / 255;
          b = parseInt(hex.slice(4, 6), 16) / 255;
        } else if (color.startsWith('rgb')) {
          const match = color.match(/\d+/g);
          if (match) {
            r = parseInt(match[0]) / 255;
            g = parseInt(match[1]) / 255;
            b = parseInt(match[2]) / 255;
          }
        } else if (color.startsWith('oklch')) {
          // Extract lightness from oklch
          const match = color.match(/oklch\(\s*([\d.]+)/);
          if (match) return parseFloat(match[1]);
        }
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      
      const luminances = primaryColors.map(getLuminance);
      const range = Math.max(...luminances) - Math.min(...luminances);
      
      if (range < 0.3) traits.contrast = 'Low';
      else if (range > 0.6) traits.contrast = 'High';
      else traits.contrast = 'Medium';
    }
    
    // Derive Density from spacing tokens
    if (summary?.tokens?.spacing) {
      const spacingTokens = summary.tokens.spacing;
      const spacingValues: number[] = [];
      
      const extractSpacing = (obj: any) => {
        for (const key in obj) {
          const val = obj[key];
          if (val?.$value) {
            const numMatch = String(val.$value).match(/[\d.]+/);
            if (numMatch) spacingValues.push(parseFloat(numMatch[0]));
          } else if (typeof val === 'object') {
            extractSpacing(val);
          }
        }
      };
      extractSpacing(spacingTokens);
      
      if (spacingValues.length > 0) {
        const avgSpacing = spacingValues.reduce((a, b) => a + b, 0) / spacingValues.length;
        if (avgSpacing < 8) traits.density = 'Tight';
        else if (avgSpacing > 20) traits.density = 'Airy';
        else traits.density = 'Balanced';
      }
    }
    
    // Derive Vibe from metadata
    const vibeTags = summary?.metadataTags?.subjective?.emotionalImpact || 
                     summary?.metadataTags?.objective?.visualMood || 
                     [];
    if (vibeTags.length > 0) {
      traits.vibe = vibeTags[0];
    } else if (summary?.description) {
      // Fallback: use first few words of description
      traits.vibe = summary.description.split(/[,.]/).at(0)?.trim() || '';
    }
    
    return traits;
  };
  
  const humanTraits = getHumanTraits();

  return (
    <Layout>
      <div ref={containerRef} className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* === SECTION 1: HERO === */}
        <header className="space-y-3">
          {/* Nav bar */}
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={12} /> Back
            </Link>
            <div className="flex items-center gap-2">
              {summary?.neighbors && (summary.neighbors.prevId || summary.neighbors.nextId) && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => summary.neighbors?.prevId && navigate(`/style/${summary.neighbors.prevId}`)}
                    disabled={!summary.neighbors.prevId}
                    className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    data-testid="button-prev-style"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => summary.neighbors?.nextId && navigate(`/style/${summary.neighbors.nextId}`)}
                    disabled={!summary.neighbors.nextId}
                    className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    data-testid="button-next-style"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
              {isOwner && (
                <button
                  onClick={handleToggleVisibility}
                  disabled={visibilityLoading}
                  className="p-1.5 rounded border border-border hover:bg-muted transition-colors"
                  data-testid="button-toggle-visibility"
                  title={isPublic ? "Public" : "Private"}
                >
                  {visibilityLoading ? <Loader2 size={14} className="animate-spin" /> : isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              )}
            </div>
          </div>
          
          {/* Title + Vibe */}
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground leading-tight">{summary.name}</h1>
            <p className="text-muted-foreground text-base font-light leading-relaxed">{summary.description}</p>
          </div>
          
          {/* Subtle metadata row: creator + rating */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              {summary.creatorName && summary.creatorId && (
                <Link 
                  href={`/creator/${summary.creatorId}`}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`link-creator-${summary.creatorId}`}
                >
                  <User size={12} />
                  <span className="text-xs">{summary.creatorName}</span>
                </Link>
              )}
              {avgRating.count > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Star size={12} className="fill-yellow-400 text-yellow-400" />
                  <span className="text-xs">{avgRating.average.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* === SECTION 2: VISUAL TRUST STRIP === */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Source Image - Trust Signal */}
          <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
            {(summary.imageIds?.reference || (summary.referenceImages && summary.referenceImages.length > 0)) ? (
              <>
                <img 
                  src={summary.imageIds?.reference 
                    ? `/api/images/${summary.imageIds.reference}?size=medium`
                    : summary.referenceImages[0]
                  } 
                  alt="Source reference"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="eager"
                  data-testid="img-source-reference"
                />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[10px] font-mono rounded">
                  Source
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                No source image
              </div>
            )}
          </div>
          
          {/* Software App UI - Style Output */}
          <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
            {summary.imageIds?.ui_software_app ? (
              <>
                <img 
                  src={`/api/images/${summary.imageIds.ui_software_app}?size=medium`}
                  alt="Applied UI"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="eager"
                  data-testid="img-applied-ui"
                />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[10px] font-mono rounded">
                  Applied
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                Generating...
              </div>
            )}
          </div>
        </section>

        {/* === SECTION 3: QUICK READ === */}
        <section className="space-y-4">
          {/* Palette Strip - Visual only */}
          {primaryColors.length > 0 && (
            <div className="flex items-center gap-1.5">
              {primaryColors.map((color, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-10 h-10 rounded-lg shadow-sm"
                  style={{ backgroundColor: color }}
                  data-testid={`color-swatch-${i}`}
                />
              ))}
            </div>
          )}
          
          {/* Human Traits - No technical language, no numbers */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span><span className="text-foreground font-medium">Contrast</span> {humanTraits.contrast}</span>
            <span className="text-border">•</span>
            <span><span className="text-foreground font-medium">Density</span> {humanTraits.density}</span>
            {humanTraits.vibe && (
              <>
                <span className="text-border">•</span>
                <span><span className="text-foreground font-medium">Vibe</span> {humanTraits.vibe}</span>
              </>
            )}
          </div>
        </section>

        {/* === SECTION 4: PRIMARY ACTIONS CTA === */}
        <section className="flex flex-col sm:flex-row gap-2">
          {/* Save */}
          <button
            onClick={isAuthenticated ? handleToggleBookmark : undefined}
            disabled={bookmarkLoading || !isAuthenticated}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${
              isBookmarked 
                ? "border-yellow-500 bg-yellow-500/10 text-yellow-600" 
                : "border-border bg-muted/50 hover:bg-muted"
            }`}
            data-testid="button-save-style"
            title={!isAuthenticated ? "Sign in to save" : undefined}
          >
            {bookmarkLoading ? <Loader2 size={16} className="animate-spin" /> : <Bookmark size={16} className={isBookmarked ? "fill-current" : ""} />}
            {isBookmarked ? "Saved" : "Save"}
          </button>
          
          {/* Export */}
          <ExportDialog 
            tokens={summary.tokens} 
            styleName={summary.name}
            trigger={
              <button 
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                data-testid="button-export-primary"
              >
                <Download size={16} />
                Export
                <ChevronDown size={14} />
              </button>
            }
          />
          
          {/* Remix / Apply */}
          <Button
            onClick={() => {
              setTryItOpen(true);
              setTryItImage(null);
              setTryItError(null);
              setTryItPrompt("");
            }}
            variant="outline"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3"
            data-testid="button-remix-style"
          >
            <Sparkles size={16} />
            Remix
          </Button>
        </section>

        {/* === COLLAPSED SECTIONS === */}
        <div className="border border-border rounded-lg divide-y divide-border">
          
          {/* Canonical Previews */}
          <details className="group">
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
              <span className="text-sm font-medium text-foreground">Canonical Previews</span>
              <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-0">
              <div className="grid grid-cols-3 gap-2">
                {['landscape', 'portrait', 'stillLife'].map((type) => {
                  const key = type === 'stillLife' ? 'preview_still_life' : `preview_${type}`;
                  const imgSrc = summary.imageIds?.[key] 
                    ? `/api/images/${summary.imageIds[key]}?size=medium`
                    : (previews as any)[type];
                  return (
                    <div key={type} className="aspect-square bg-muted rounded-lg overflow-hidden border border-border relative">
                      {imgSrc ? (
                        <img src={imgSrc} alt={type} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-xs capitalize">{type}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </details>


          {/* Create / Prompt Details */}
          <details className="group">
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
              <span className="text-sm font-medium text-foreground">Style Guide</span>
              <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-0 space-y-4">
              {summary.promptScaffolding?.base && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm text-foreground">{summary.promptScaffolding.base}</p>
                </div>
              )}
              {summary.promptScaffolding?.modifiers?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Characteristics</h4>
                  <div className="flex flex-wrap gap-1">
                    {summary.promptScaffolding.modifiers.map((mod: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-muted text-xs rounded">{mod}</span>
                    ))}
                  </div>
                </div>
              )}
              {summary.promptScaffolding?.negative && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Avoid</h4>
                  <p className="text-sm text-muted-foreground">{summary.promptScaffolding.negative}</p>
                </div>
              )}
            </div>
          </details>

          {/* Usage Notes */}
          <details className="group">
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
              <span className="text-sm font-medium text-foreground">Usage Notes</span>
              <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-0">
              <StyleSpecEditor 
                styleId={summary.id} 
                styleSpec={summary.styleSpec}
                createdAt={summary.createdAt}
                updatedAt={summary.updatedAt}
                onUpdate={handleSpecUpdate}
              />
            </div>
          </details>

          {/* Explorations - generated assets showing style possibilities */}
          <details className="group">
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
              <span className="text-sm font-medium text-foreground">Explorations</span>
              <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-0">
              {assetsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <AiMoodBoard
                  styleId={summary.id}
                  styleName={summary.name}
                  moodBoard={assets?.moodBoard}
                  uiConcepts={assets?.uiConcepts}
                />
              )}
            </div>
          </details>

          {/* Revisions */}
          <details 
            className="group"
            onToggle={(e) => {
              if ((e.target as HTMLDetailsElement).open && !versionsExpanded) {
                setVersionsExpanded(true);
              }
            }}
          >
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
              <span className="text-sm font-medium text-foreground">Revisions</span>
              <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-0 space-y-3">
              {isOwner && (
                <Button variant="outline" size="sm" onClick={handleSaveVersion} disabled={savingVersion}>
                  {savingVersion ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                  Save Snapshot
                </Button>
              )}
              {versionsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No revisions yet</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                      <span>v{version.versionNumber} — {version.changeType}</span>
                      {isOwner && (
                        <button
                          onClick={() => handleRevertToVersion(version.id)}
                          disabled={revertingVersion === version.id}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {revertingVersion === version.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          {/* Share & Rate */}
          <details className="group">
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
              <span className="text-sm font-medium text-foreground">Share & Rate</span>
              <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-0 space-y-4">
              {/* Share */}
              <div className="flex items-center gap-2">
                {shareCode ? (
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    <span className="font-mono">{shareCode}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleShare}
                    disabled={shareLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                    Generate Share Link
                  </button>
                )}
              </div>
              
              {/* Rating */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Your rating:</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => isAuthenticated && handleSubmitRating(star)}
                      onMouseEnter={() => isAuthenticated && setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      disabled={ratingLoading || !isAuthenticated}
                      className="p-0.5 disabled:cursor-default"
                      title={isAuthenticated ? `Rate ${star}` : "Sign in to rate"}
                    >
                      <Star size={16} className={star <= (hoveredStar || userRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"} />
                    </button>
                  ))}
                </div>
                {ratingLoading && <Loader2 size={14} className="animate-spin" />}
              </div>

              {/* Collections */}
              {isAuthenticated && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Collections:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted">
                        <FolderPlus size={14} />
                        {styleCollections.size > 0 ? `In ${styleCollections.size}` : "Add"}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {collections.length === 0 ? (
                        <div className="px-2 py-2 text-center text-xs text-muted-foreground">
                          <Link href="/saved" className="text-blue-500 hover:underline">Create collection</Link>
                        </div>
                      ) : (
                        collections.map((c) => (
                          <DropdownMenuItem key={c.id} onClick={() => handleToggleCollection(c.id)} className="cursor-pointer">
                            {styleCollections.has(c.id) ? <Check size={14} className="mr-2 text-green-500" /> : <Folder size={14} className="mr-2" />}
                            {c.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </details>

          {/* Design DNA - Tokens section, collapsed by default */}
          <details className="group" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setTokensExpanded(true); }}>
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
              <span className="text-sm font-medium text-foreground">Design DNA</span>
              <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-4 pt-0 space-y-6">
              {tokensExpanded && (
                <>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Color Palette</h4>
                    <ColorPaletteSwatches tokens={summary.tokens} />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">All Tokens</h4>
                    <TokenViewer tokens={summary.tokens} />
                  </div>
                </>
              )}
            </div>
          </details>
        </div>

        {/* Try It Now Dialog */}
        {tryItOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles size={20} className="text-primary" />
                  <h3 className="text-lg font-medium">Create with {summary.name}</h3>
                </div>
                <button
                  onClick={() => setTryItOpen(false)}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                  data-testid="button-close-try-it"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">What would you like to create?</label>
                  <textarea
                    value={tryItPrompt}
                    onChange={(e) => setTryItPrompt(e.target.value)}
                    placeholder="Describe the image you want to generate... (e.g., 'a cozy coffee shop interior', 'a futuristic cityscape at sunset')"
                    className="w-full h-24 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={tryItGenerating}
                    data-testid="input-try-it-prompt"
                  />
                </div>
                
                <Button
                  onClick={handleTryItGenerate}
                  disabled={tryItGenerating || !tryItPrompt.trim()}
                  className="w-full"
                  data-testid="button-generate-image"
                >
                  {tryItGenerating ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="mr-2" />
                      Generate Image
                    </>
                  )}
                </Button>
                
                {tryItError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
                    {tryItError}
                  </div>
                )}
                
                {tryItImage && (
                  <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img 
                        src={tryItImage} 
                        alt="Created image"
                        className="w-full h-auto"
                        data-testid="img-generated-result"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Created using {summary.name}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
