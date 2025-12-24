import { deleteStyleApi, type Style } from "@/lib/store";
import { StyleCard } from "@/components/style-card";
import { StyleCardSkeleton } from "@/components/style-card-skeleton";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { getRecommendedStyles, getBrowsingHistory } from "@/lib/suggestions";
import { Sparkles, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function Explore() {
  const queryClient = useQueryClient();
  
  const { data: styles = [], isLoading, isError, refetch } = useQuery<Style[]>({
    queryKey: ["/api/styles"],
    queryFn: async () => {
      const response = await fetch("/api/styles");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    staleTime: 60000,
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * attempt, 2000),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStyleApi,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<Style[]>(["/api/styles"], (old) => 
        old?.filter(s => s.id !== deletedId) ?? []
      );
    },
  });

  const handleStyleDelete = async (deletedId: string) => {
    deleteMutation.mutate(deletedId);
  };

  const handleRetry = () => refetch();

  const recommendations = useMemo(() => getRecommendedStyles(styles, 3), [styles]);
  const hasHistory = getBrowsingHistory().length > 0;
  const recommendedIds = useMemo(() => new Set(recommendations.map(r => r.id)), [recommendations]);
  const nonRecommendedStyles = useMemo(() => styles.filter(s => !recommendedIds.has(s.id)), [styles, recommendedIds]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-border pb-4 md:pb-6 gap-4 md:gap-0">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Vault</h1>
              <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
                Discover and compare visual styles. Click any style to explore its details.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-border pb-4 md:pb-6 gap-4 md:gap-0">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Vault</h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
              Discover and compare visual styles. Click any style to explore its details.
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-muted-foreground flex-shrink-0">
            <span>{styles.length} STYLES INDEXED</span>
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <div className="py-20 text-center border border-dashed border-destructive/50 rounded-lg bg-destructive/5">
            <p className="text-destructive mb-2">Failed to load styles</p>
            <p className="text-sm text-muted-foreground mb-4">
              There was a network error. Your styles are still saved.
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

        {/* Empty State */}
        {!isError && styles.length === 0 && (
          <div className="py-20 text-center border border-dashed border-border rounded-lg bg-muted/5">
            <p className="text-muted-foreground mb-2">No styles yet</p>
            <p className="text-sm text-muted-foreground/70">
              Create your first style by navigating to the Create page
            </p>
          </div>
        )}

        {/* Recommendations Section */}
        {hasHistory && recommendations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <h2 className="text-sm md:text-base font-medium text-foreground">Recommended For You</h2>
              <span className="text-[10px] font-mono text-muted-foreground">Based on your browsing history</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <AnimatePresence>
                {recommendations.map((style, index) => (
                  <motion.div
                    key={style.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
                    className="relative"
                  >
                    <div className="absolute -top-2 -right-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-sm">
                      SUGGESTED
                    </div>
                    <StyleCard style={style} onDelete={handleStyleDelete} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="h-px bg-border my-4"></div>
          </div>
        )}

        {/* All Styles Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm md:text-base font-medium text-foreground">
              {hasHistory && recommendations.length > 0 ? "Other Styles" : "All Styles"}
            </h2>
            <span className="text-[10px] font-mono text-muted-foreground">
              {hasHistory && recommendations.length > 0 ? `${nonRecommendedStyles.length} more` : "Complete collection"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <AnimatePresence>
              {(hasHistory && recommendations.length > 0 ? nonRecommendedStyles : styles).map((style, index) => (
                <motion.div
                  key={style.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
                >
                  <StyleCard style={style} onDelete={handleStyleDelete} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {styles.length === 0 && (
             <div className="py-20 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/10">
               <p>No styles found in the vault.</p>
             </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
