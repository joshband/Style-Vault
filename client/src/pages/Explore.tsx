import { deleteStyleApi, type Style } from "@/lib/store";
import { StyleCard } from "@/components/style-card";
import { StyleCardSkeleton } from "@/components/style-card-skeleton";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, PenTool, Loader2 } from "lucide-react";
import { useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const preloadedImages = useRef<Set<string>>(new Set());
  
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<PaginatedResponse>({
    queryKey: ["/api/styles", "paginated"],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) {
        params.set("cursor", pageParam as string);
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
                Your collection of visual styles
              </p>
            </div>
          </div>
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
                {totalCount > 0 ? `${totalCount} styles in your collection` : "Your collection of visual styles"}
              </p>
            </div>
          </div>
        </div>

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

        {!isError && allStyles.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="py-20 px-6 text-center border border-dashed border-border rounded-xl bg-gradient-to-b from-muted/20 to-transparent"
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
                  >
                    <StyleCard style={style} onDelete={handleStyleDelete} />
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
      </div>
    </Layout>
  );
}
