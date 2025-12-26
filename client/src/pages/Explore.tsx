import { deleteStyleApi, type Style } from "@/lib/store";
import { StyleCard } from "@/components/style-card";
import { StyleCardSkeleton } from "@/components/style-card-skeleton";
import { StyleFilters, DEFAULT_FILTERS, type StyleFiltersState } from "@/components/style-filters";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, PenTool, Loader2, GitCompareArrows, X, Check } from "lucide-react";
import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

interface PaginatedResponse {
  items: Style[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

const PAGE_SIZE = 12;
const CARD_MIN_WIDTH = 280;

export default function Explore() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const preloadedImages = useRef<Set<string>>(new Set());
  const [filters, setFilters] = useState<StyleFiltersState>(DEFAULT_FILTERS);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  
  const filtersQueryKey = useMemo(() => {
    return JSON.stringify({
      search: filters.search,
      mood: [...filters.mood].sort(),
      colorFamily: [...filters.colorFamily].sort(),
      sortBy: filters.sortBy,
    });
  }, [filters]);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<PaginatedResponse>({
    queryKey: ["/api/styles", "paginated", filtersQueryKey],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) {
        params.set("cursor", pageParam as string);
      }
      if (filters.search) {
        params.set("search", filters.search);
      }
      if (filters.mood.length > 0) {
        params.set("mood", filters.mood.join(","));
      }
      if (filters.colorFamily.length > 0) {
        params.set("colorFamily", filters.colorFamily.join(","));
      }
      if (filters.sortBy !== "newest") {
        params.set("sortBy", filters.sortBy);
      }
      const response = await fetch(`/api/styles?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * attempt, 2000),
  });

  const allStyles = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  const totalCount = data?.pages[0]?.total ?? 0;
  const hasActiveFilters = filters.search || filters.mood.length > 0 || filters.colorFamily.length > 0;

  useEffect(() => {
    const stylesToPreload = allStyles.slice(-PAGE_SIZE);
    stylesToPreload.forEach((style) => {
      const imageUrl = style.previews?.landscape;
      if (imageUrl && !preloadedImages.current.has(imageUrl)) {
        const img = new Image();
        img.src = imageUrl;
        preloadedImages.current.add(imageUrl);
      }
    });
  }, [allStyles]);

  const deleteMutation = useMutation({
    mutationFn: deleteStyleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles"] });
    },
  });

  const handleStyleDelete = useCallback((deletedId: string) => {
    deleteMutation.mutate(deletedId);
  }, [deleteMutation]);

  const handleRetry = useCallback(() => refetch(), [refetch]);

  const handleFiltersChange = useCallback((newFilters: StyleFiltersState) => {
    setFilters(newFilters);
  }, []);

  const toggleCompareMode = useCallback(() => {
    setCompareMode(prev => !prev);
    setSelectedForCompare(new Set());
  }, []);

  const toggleStyleSelection = useCallback((styleId: string) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else if (next.size < 2) {
        next.add(styleId);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    const ids = Array.from(selectedForCompare);
    if (ids.length === 2) {
      navigate(`/compare?style1=${ids[0]}&style2=${ids[1]}`);
    }
  }, [selectedForCompare, navigate]);

  useEffect(() => {
    if (!sentinelRef.current || !containerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: "300px" }
    );
    
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="border-b border-border pb-4 md:pb-6">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Vault</h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                Community styles
              </p>
            </div>
          </div>
          <StyleFilters filters={filters} onFiltersChange={handleFiltersChange} />
          <div 
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}px, 1fr))` }}
          >
            <StyleCardSkeleton />
            <StyleCardSkeleton />
            <StyleCardSkeleton />
            <StyleCardSkeleton className="hidden sm:block" />
            <StyleCardSkeleton className="hidden md:block" />
            <StyleCardSkeleton className="hidden lg:block" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div ref={containerRef} className="flex flex-col gap-6 md:gap-8">
        <div className="border-b border-border pb-4 md:pb-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Vault</h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                {compareMode
                  ? `Select 2 styles to compare (${selectedForCompare.size}/2 selected)`
                  : totalCount > 0 
                    ? hasActiveFilters 
                      ? `${totalCount} styles`
                      : `${totalCount} community styles` 
                    : "Community styles"}
              </p>
            </div>
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              onClick={toggleCompareMode}
              data-testid="button-toggle-compare"
              className="gap-2"
            >
              {compareMode ? (
                <>
                  <X className="w-4 h-4" />
                  Cancel
                </>
              ) : (
                <>
                  <GitCompareArrows className="w-4 h-4" />
                  Compare
                </>
              )}
            </Button>
          </div>
        </div>

        <StyleFilters filters={filters} onFiltersChange={handleFiltersChange} />

        {isError && (
          <div className="py-16 text-center border border-dashed border-destructive/50 rounded-lg bg-destructive/5">
            <p className="text-destructive mb-2">Unable to load your styles</p>
            <p className="text-sm text-muted-foreground mb-4">
              Please check your connection and try again.
            </p>
            <Button 
              variant="outline" 
              onClick={handleRetry}
              data-testid="button-retry-load"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {!isError && allStyles.length === 0 && !hasActiveFilters && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="py-20 px-6 text-center border border-dashed border-border rounded-xl"
          >
            <div className="max-w-md mx-auto space-y-4">
              <h2 className="text-xl font-serif font-medium text-foreground">
                What is a style?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                A style is a reusable visual language — a captured essence of color, mood, texture, and form. 
                It's not just an image or a prompt. It's a living artifact you can apply to generate 
                new visuals that feel cohesive and intentional.
              </p>
              <div className="pt-4">
                <Link href="/create">
                  <Button 
                    size="lg" 
                    className="gap-2"
                    data-testid="button-create-first-style"
                  >
                    <PenTool className="w-4 h-4" />
                    Create your first style
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {!isError && allStyles.length === 0 && hasActiveFilters && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="py-16 px-6 text-center border border-dashed border-border rounded-xl"
          >
            <div className="max-w-md mx-auto space-y-4">
              <h2 className="text-lg font-medium text-foreground">
                No styles match your filters
              </h2>
              <p className="text-muted-foreground text-sm">
                Try adjusting your search terms or removing some filters to see more results.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setFilters(DEFAULT_FILTERS)}
                data-testid="button-clear-all-filters"
              >
                Clear all filters
              </Button>
            </div>
          </motion.div>
        )}

        {!isError && allStyles.length > 0 && (
          <>
            <div 
              className="grid gap-6"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}px, 1fr))` }}
            >
              <AnimatePresence mode="popLayout">
                {allStyles.map((style, index) => (
                  <motion.div
                    key={style.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: "easeOut" }}
                    className="relative"
                  >
                    {compareMode && (
                      <button
                        onClick={() => toggleStyleSelection(style.id)}
                        className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selectedForCompare.has(style.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-background/80 border-muted-foreground/50 hover:border-primary"
                        }`}
                        data-testid={`checkbox-compare-${style.id}`}
                      >
                        {selectedForCompare.has(style.id) && <Check className="w-4 h-4" />}
                      </button>
                    )}
                    <div className={compareMode ? "pointer-events-none" : ""}>
                      <StyleCard style={style} onDelete={handleStyleDelete} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div ref={sentinelRef} className="h-4" aria-hidden="true" />
            
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading more styles...</span>
                </div>
              </div>
            )}
            
            {!hasNextPage && allStyles.length > PAGE_SIZE && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                All styles loaded
              </div>
            )}
          </>
        )}

        {compareMode && selectedForCompare.size === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <Button
              size="lg"
              onClick={handleCompare}
              className="gap-2 shadow-lg"
              data-testid="button-compare-now"
            >
              <GitCompareArrows className="w-5 h-5" />
              Compare Selected Styles
            </Button>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
