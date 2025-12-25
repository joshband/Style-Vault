import { useRoute } from "wouter";
import { type StyleSpec } from "@/lib/store";
import { Layout } from "@/components/layout";
import { TokenViewer } from "@/components/token-viewer";
import { ColorPaletteSwatches } from "@/components/color-palette-swatches";
import { StyleSpecEditor } from "@/components/style-spec-editor";
import { ArrowLeft, Download, Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Palette, MessageSquare, Share2, Check, Copy, Droplets, FileEdit, Bookmark, Star, User, FolderPlus, Folder, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AiMoodBoard } from "@/components/ai-mood-board";
import { ActiveJobsIndicator } from "@/components/active-jobs-indicator";
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

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function SectionHeader({ icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-serif font-medium text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
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
  const id = params?.id;
  const { user, isAuthenticated } = useAuth();
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
  
  // Check if current user is the creator
  const isOwner = isAuthenticated && user?.id === summary?.creatorId;

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

  const handleDownloadTokens = () => {
    if (!summary) return;
    const tokensJson = JSON.stringify(summary.tokens, null, 2);
    const blob = new Blob([tokensJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${summary.name.toLowerCase().replace(/\s+/g, "-")}-tokens.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono w-fit">
            <ArrowLeft size={12} /> Back to Vault
          </Link>
          
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground">{summary.name}</h1>
              {isOwner && (
                <button
                  onClick={handleToggleVisibility}
                  disabled={visibilityLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
                  data-testid="button-toggle-visibility"
                >
                  {visibilityLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isPublic ? (
                    <Eye size={14} />
                  ) : (
                    <EyeOff size={14} />
                  )}
                  <span>{isPublic ? "Public" : "Private"}</span>
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-lg font-light leading-relaxed max-w-2xl">
              {summary.description}
            </p>
            {summary.creatorName && summary.creatorId && (
              <Link 
                href={`/creator/${summary.creatorId}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                data-testid={`link-creator-${summary.creatorId}`}
              >
                <User size={14} />
                <span>by {summary.creatorName}</span>
              </Link>
            )}
          </div>
          
          {(summary.imageIds?.reference || (summary.referenceImages && summary.referenceImages.length > 0)) && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Source Reference
              </h3>
              <div className="max-w-md">
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img 
                    src={summary.imageIds?.reference 
                      ? `/api/images/${summary.imageIds.reference}?size=medium`
                      : summary.referenceImages[0]
                    } 
                    alt="Source reference" 
                    className="w-full h-auto object-contain"
                    loading="lazy"
                    data-testid="img-reference-main"
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <time dateTime={summary.createdAt}>
                Created {(() => {
                  const date = new Date(summary.createdAt);
                  const displayDate = isNaN(date.getTime()) ? new Date() : date;
                  return displayDate.toLocaleDateString(undefined, { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  });
                })()}
              </time>
              <ActiveJobsIndicator styleId={id} />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Bookmark button */}
              {isAuthenticated && (
                <button
                  onClick={handleToggleBookmark}
                  disabled={bookmarkLoading}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${
                    isBookmarked 
                      ? "border-yellow-500 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20" 
                      : "border-border bg-muted/50 hover:bg-muted"
                  }`}
                  data-testid="button-bookmark-style"
                >
                  {bookmarkLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bookmark size={14} className={isBookmarked ? "fill-current" : ""} />
                  )}
                  <span>{isBookmarked ? "Saved" : "Save"}</span>
                </button>
              )}
              
              {/* Add to Collection button */}
              {isAuthenticated && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={collectionsLoading}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${
                        styleCollections.size > 0
                          ? "border-blue-500 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                          : "border-border bg-muted/50 hover:bg-muted"
                      }`}
                      data-testid="button-add-to-collection"
                    >
                      {collectionsLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FolderPlus size={14} />
                      )}
                      <span>{styleCollections.size > 0 ? `In ${styleCollections.size}` : "Collect"}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {collections.length === 0 ? (
                      <div className="px-2 py-3 text-center">
                        <p className="text-xs text-muted-foreground mb-2">No collections yet</p>
                        <Link href="/saved" className="text-xs text-blue-500 hover:underline">
                          Create your first collection
                        </Link>
                      </div>
                    ) : (
                      <>
                        {collections.map((collection) => (
                          <DropdownMenuItem
                            key={collection.id}
                            onClick={() => handleToggleCollection(collection.id)}
                            className="cursor-pointer"
                            data-testid={`collection-option-${collection.id}`}
                          >
                            <div className="flex items-center gap-2 w-full">
                              {styleCollections.has(collection.id) ? (
                                <Check size={14} className="text-green-500" />
                              ) : (
                                <Folder size={14} className="text-muted-foreground" />
                              )}
                              <span className="flex-1 truncate">{collection.name}</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/saved" className="flex items-center gap-2 cursor-pointer" data-testid="link-manage-collections">
                            <Plus size={14} />
                            <span>Manage Collections</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Share button */}
              {shareCode ? (
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/50 hover:bg-muted transition-colors"
                  data-testid="button-copy-share-link"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-green-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span className="font-mono">{shareCode}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                  data-testid="button-share-style"
                >
                  {shareLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Share2 size={14} />
                  )}
                  <span>Share</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Rating Section */}
          <div className="flex items-center gap-4 pt-2 border-t border-border mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rating:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => isAuthenticated && handleSubmitRating(star)}
                    onMouseEnter={() => isAuthenticated && setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    disabled={ratingLoading || !isAuthenticated}
                    className={`p-0.5 transition-colors disabled:cursor-default ${
                      isAuthenticated ? "cursor-pointer hover:scale-110" : ""
                    }`}
                    data-testid={`button-rate-${star}`}
                    title={isAuthenticated ? `Rate ${star} star${star > 1 ? 's' : ''}` : "Sign in to rate"}
                  >
                    <Star 
                      size={18} 
                      className={`transition-colors ${
                        star <= (hoveredStar || userRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {avgRating.count > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  {avgRating.average.toFixed(1)} ({avgRating.count} {avgRating.count === 1 ? 'rating' : 'ratings'})
                </span>
              )}
              {ratingLoading && <Loader2 size={14} className="animate-spin ml-2" />}
            </div>
          </div>
        </div>

        {/* Section 1: Visual Identity */}
        <section className="space-y-0">
          <SectionHeader
            icon={<Eye size={20} />}
            title="Visual Identity"
            description="How this style looks and feels across different compositions"
          />
          
          {/* Canonical Previews */}
          <div className="space-y-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Canonical Previews
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:grid-rows-[auto_auto]">
              {assetsLoading ? (
                <>
                  <PreviewSkeleton aspect="col-span-1 sm:col-span-4 aspect-video" />
                  <PreviewSkeleton aspect="sm:col-span-2 sm:row-span-2 aspect-[3/4]" />
                  <PreviewSkeleton aspect="sm:col-span-2 aspect-square" />
                </>
              ) : (
                <>
                  <div className="col-span-1 sm:col-span-4 aspect-video bg-muted rounded-lg overflow-hidden border border-border relative group">
                    {(summary.imageIds?.preview_landscape || previews.landscape) ? (
                      <>
                        <img 
                          src={summary.imageIds?.preview_landscape 
                            ? `/api/images/${summary.imageIds.preview_landscape}?size=medium`
                            : previews.landscape
                          } 
                          alt="Landscape preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs font-mono rounded">
                          Landscape
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No landscape preview
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2 sm:row-span-2 aspect-[3/4] bg-muted rounded-lg overflow-hidden border border-border relative">
                    {(summary.imageIds?.preview_portrait || previews.portrait) ? (
                      <>
                        <img 
                          src={summary.imageIds?.preview_portrait
                            ? `/api/images/${summary.imageIds.preview_portrait}?size=medium`
                            : previews.portrait
                          } 
                          alt="Portrait preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs font-mono rounded">
                          Portrait
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No portrait preview
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2 h-full bg-muted rounded-lg overflow-hidden border border-border relative">
                    {(summary.imageIds?.preview_still_life || previews.stillLife) ? (
                      <>
                        <img 
                          src={summary.imageIds?.preview_still_life
                            ? `/api/images/${summary.imageIds.preview_still_life}?size=medium`
                            : previews.stillLife
                          } 
                          alt="Still life preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs font-mono rounded">
                          Still Life
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No still life preview
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mood Board & UI Concepts */}
          <div className="pt-6">
            {assetsLoading ? (
              <div className="flex items-center justify-center py-12 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading mood board...</span>
                </div>
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
        </section>

        {/* Section 2: Color Palette */}
        <section className="space-y-0">
          <SectionHeader
            icon={<Droplets size={20} />}
            title="Color Palette"
            description="Click any swatch to copy the hex code"
          />
          <ColorPaletteSwatches tokens={summary.tokens} />
        </section>

        {/* Section 3: Design Tokens */}
        <section className="space-y-0">
          <SectionHeader
            icon={<Palette size={20} />}
            title="Design Tokens"
            description="The technical DNA behind this visual language"
          />

          <div className="space-y-4">
            {/* Download CTA */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">W3C DTCG Token File</p>
                <p className="text-xs text-muted-foreground mt-0.5">Standards-compliant JSON for design tools</p>
              </div>
              <button 
                onClick={handleDownloadTokens}
                data-testid="button-download-tokens"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Download size={16} />
                Download JSON
              </button>
            </div>

            {/* Collapsible Token Viewer */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setTokensExpanded(!tokensExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                data-testid="toggle-token-viewer"
              >
                <span className="text-sm font-medium text-foreground">View Token Structure</span>
                {tokensExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {tokensExpanded && (
                <div className="p-4 pt-0 border-t border-border animate-in fade-in duration-200">
                  <TokenViewer tokens={summary.tokens} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 4: Prompt Scaffolding */}
        <section className="space-y-0">
          <SectionHeader
            icon={<MessageSquare size={20} />}
            title="Prompt Scaffolding"
            description="Ready-to-use prompts for applying this style in AI tools"
          />
          
          <div className="space-y-6">
            {summary.promptScaffolding && (
              <>
                <div className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Base Prompt</h3>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <p className="text-sm font-mono text-foreground whitespace-pre-wrap">{summary.promptScaffolding.base}</p>
                  </div>
                </div>
                
                {summary.promptScaffolding.modifiers && summary.promptScaffolding.modifiers.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Style Modifiers</h3>
                    <div className="flex flex-wrap gap-2">
                      {summary.promptScaffolding.modifiers.map((mod: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-muted/70 text-xs rounded-md font-mono text-muted-foreground">
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {summary.promptScaffolding.negative && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Negative Prompt</h3>
                    <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                      <p className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">{summary.promptScaffolding.negative}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Section 5: Style Specification */}
        <section className="space-y-0">
          <SectionHeader
            icon={<FileEdit size={20} />}
            title="Style Specification"
            description="Usage guidelines and design notes for this style"
          />
          <StyleSpecEditor 
            styleId={summary.id} 
            styleSpec={summary.styleSpec}
            createdAt={summary.createdAt}
            updatedAt={summary.updatedAt}
            onUpdate={handleSpecUpdate}
          />
        </section>
      </div>
    </Layout>
  );
}
