import { deleteStyleApi, type Style } from "@/lib/store";
import { StyleCard } from "@/components/style-card";
import { StyleCardSkeleton } from "@/components/style-card-skeleton";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { RefreshCw, PenTool, Loader2 } from "lucide-react";
import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useVirtualizer } from "@tanstack/react-virtual";

function useColumnCount() {
  const [columnCount, setColumnCount] = useState(3);
  
  useEffect(() => {
    const updateColumnCount = () => {
      if (window.innerWidth < 640) {
        setColumnCount(1);
      } else if (window.innerWidth < 1024) {
        setColumnCount(2);
      } else {
        setColumnCount(3);
      }
    };
    
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);
  
  return columnCount;
}

interface PaginatedResponse {
  items: Style[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

const PAGE_SIZE = 12;

export default function Explore() {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  
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

  const deleteMutation = useMutation({
    mutationFn: deleteStyleApi,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles"] });
    },
  });

  const handleStyleDelete = useCallback((deletedId: string) => {
    deleteMutation.mutate(deletedId);
  }, [deleteMutation]);

  const handleRetry = useCallback(() => refetch(), [refetch]);

  const columnCount = useColumnCount();
  const rowCount = Math.ceil(allStyles.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 420,
    overscan: 2,
  });

  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
    if (!lastItem) return;
    
    if (
      lastItem.index >= rowCount - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
    rowCount,
  ]);

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
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <StyleCardSkeleton />
            <StyleCardSkeleton className="hidden sm:block" />
            <StyleCardSkeleton className="hidden lg:block" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 md:gap-8 h-full">
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
          <div
            ref={parentRef}
            className="flex-1 overflow-auto -mx-4 px-4"
            style={{ contain: "strict" }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const isLoaderRow = virtualRow.index >= rowCount;
                const startIndex = virtualRow.index * columnCount;
                const rowStyles = allStyles.slice(startIndex, startIndex + columnCount);

                if (isLoaderRow) {
                  return (
                    <div
                      key="loader"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="flex items-center justify-center py-8"
                    >
                      {isFetchingNextPage && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm">Loading more styles...</span>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pb-6">
                      {rowStyles.map((style, idx) => (
                        <motion.div
                          key={style.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05, ease: "easeOut" }}
                        >
                          <StyleCard style={style} onDelete={handleStyleDelete} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
