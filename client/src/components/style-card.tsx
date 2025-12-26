import { cn } from "@/lib/utils";
import { Trash2, AlertCircle, Palette } from "lucide-react";
import { Link, useLocation } from "wouter";
import { memo, useState, useCallback, useRef } from "react";
import { trackStyleView } from "@/lib/suggestions";
import { motion, AnimatePresence } from "framer-motion";
import { queryClient } from "@/lib/queryClient";

interface StyleSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  metadataTags?: any;
  moodBoardStatus?: string;
  uiConceptsStatus?: string;
  thumbnailPreview?: string | null;
  imageIds?: Record<string, string>;
  tokens?: any;
  creatorId?: string | null;
  creatorName?: string | null;
  isPublic?: boolean;
}

interface StyleCardProps {
  style: StyleSummary;
  className?: string;
  onDelete?: (id: string) => void;
}

const StyleCardComponent = memo(function StyleCard({ style, className, onDelete }: StyleCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const hasTrackedView = useRef(false);
  const [, navigate] = useLocation();

  const handlePrefetch = useCallback(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      trackStyleView(style.id);
    }
    queryClient.prefetchQuery({
      queryKey: ["/api/styles", style.id],
      queryFn: async () => {
        const res = await fetch(`/api/styles/${style.id}`);
        return res.json();
      },
      staleTime: 60000,
    });
  }, [style.id]);

  const handleDragEnd = useCallback((info: any) => {
    if (info.offset.x < -100 || info.velocity.x < -500) {
      setShowConfirmDialog(true);
      setDragX(0);
    } else {
      setDragX(0);
    }
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete?.(style.id);
    setShowConfirmDialog(false);
  }, [onDelete, style.id]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDrag = useCallback((_: any, info: any) => {
    setDragX(info.offset.x);
  }, []);

  const handleDragEndWrapper = useCallback((_: any, info: any) => {
    setIsDragging(false);
    handleDragEnd(info);
  }, [handleDragEnd]);

  return (
    <>
      <motion.div
        drag="x"
        dragElastic={0.2}
        dragConstraints={{ left: -120, right: 0 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEndWrapper}
        onDrag={handleDrag}
        className={cn("relative", className)}
      >
        {/* Swipe delete indicator */}
        <motion.div
          className="absolute inset-0 bg-red-500 rounded-lg flex items-center justify-end pr-4 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: dragX < -20 ? 1 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            animate={{ opacity: dragX < -80 ? 1 : 0.5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 text-white"
          >
            <Trash2 size={16} />
            <span className="text-xs font-medium">DELETE</span>
          </motion.div>
        </motion.div>
      
        <Link 
          href={`/style/${style.id}`} 
          className="block"
          onMouseEnter={handlePrefetch}
          data-testid={`card-style-${style.id}`}
        >
          <motion.div 
            className={cn(
              "relative flex flex-col bg-card border border-border rounded-lg overflow-hidden",
              "transition-shadow duration-200",
              isDragging && "cursor-grabbing"
            )}
            whileHover={{ 
              scale: 1.015,
              boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.12)"
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Preview Image */}
            <div className="relative aspect-[16/10] bg-muted overflow-hidden">
              {(style.imageIds?.preview_landscape || style.imageIds?.reference || style.thumbnailPreview) ? (
                <img 
                  src={
                    style.imageIds?.preview_landscape 
                      ? `/api/images/${style.imageIds.preview_landscape}?size=thumb`
                      : style.imageIds?.reference
                      ? `/api/images/${style.imageIds.reference}?size=thumb`
                      : style.thumbnailPreview!
                  } 
                  alt={style.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  width={400}
                  height={250}
                />
              ) : (
                <div className="flex-1 h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <Palette className="w-10 h-10 text-muted-foreground/20" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col gap-2">
              <h3 className="font-serif font-medium text-base leading-tight text-foreground">
                {style.name}
              </h3>
              
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {style.description}
              </p>

              <div className="flex items-center justify-between mt-1">
                <time 
                  dateTime={style.createdAt}
                  className="text-xs text-muted-foreground/70"
                >
                  {new Date(style.createdAt).toLocaleDateString(undefined, { 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </time>
                {style.creatorName && style.creatorId && (
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/creator/${style.creatorId}`);
                    }}
                    className="text-xs text-primary hover:underline cursor-pointer"
                    data-testid={`link-creator-${style.creatorId}`}
                  >
                    by {style.creatorName}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={handleCancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={20} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-serif font-medium text-foreground">Delete Style</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Are you sure you want to delete "<span className="font-medium">{style.name}</span>"? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors text-foreground"
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  data-testid="button-confirm-delete"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export { StyleCardComponent as StyleCard };
