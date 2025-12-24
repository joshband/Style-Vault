import { deleteStyleApi, type Style } from "@/lib/store";
import { StyleCard } from "@/components/style-card";
import { StyleCardSkeleton } from "@/components/style-card-skeleton";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

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
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="border-b border-border pb-4 md:pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Vault</h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Your collection of visual styles
            </p>
          </div>
        </div>

        {/* Error State */}
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

        {/* Empty State */}
        {!isError && styles.length === 0 && (
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

        {/* Styles Grid */}
        {!isError && styles.length > 0 && (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {styles.map((style, index) => (
                <motion.div
                  key={style.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                >
                  <StyleCard style={style} onDelete={handleStyleDelete} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Layout>
  );
}
