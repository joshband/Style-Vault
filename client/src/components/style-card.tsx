import { Style } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ImageIcon, Trash2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { trackStyleView } from "@/lib/suggestions";
import { motion, AnimatePresence } from "framer-motion";

interface StyleCardProps {
  style: Style;
  className?: string;
  onDelete?: (id: string) => void;
}

export function StyleCard({ style, className, onDelete }: StyleCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Track view on mount
  useEffect(() => {
    trackStyleView(style.id);
  }, [style.id]);

  const handleDragEnd = (info: any) => {
    // Swipe left to delete - show confirmation dialog
    if (info.offset.x < -100 || info.velocity.x < -500) {
      setShowConfirmDialog(true);
      setDragX(0);
    } else {
      setDragX(0);
    }
  };

  const handleConfirmDelete = () => {
    onDelete?.(style.id);
    setShowConfirmDialog(false);
  };

  const handleDelete = () => {
    setShowConfirmDialog(true);
  };

  return (
    <>
      <motion.div
        drag="x"
        dragElastic={0.2}
        dragConstraints={{ left: -120, right: 0 }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(_, info) => {
          setIsDragging(false);
          handleDragEnd(info);
        }}
        onDrag={(_, info) => {
          setDragX(info.offset.x);
        }}
        className={cn("relative", className)}
      >
        {/* Red delete indicator underneath */}
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
      
      <div className={cn("group relative flex flex-col bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-primary/20", isDragging && "cursor-grabbing")}>
        {/* Preview Area - 3 Column Composite - Clickable */}
        <Link href={`/style/${style.id}`} className="block">
          <div className="relative aspect-[12/4] bg-muted overflow-hidden flex cursor-pointer">
            {/* Portrait Column */}
            <div className="flex-1 relative overflow-hidden border-r border-border/50">
              <img 
                src={style.previews.portrait} 
                alt={`${style.name} - portrait`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                draggable={false}
              />
            </div>
            {/* Landscape Column */}
            <div className="flex-1 relative overflow-hidden border-r border-border/50">
              <img 
                src={style.previews.landscape} 
                alt={`${style.name} - landscape`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                draggable={false}
              />
            </div>
            {/* Still Life Column */}
            <div className="flex-1 relative overflow-hidden">
              <img 
                src={style.previews.stillLife} 
                alt={`${style.name} - still life`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                draggable={false}
              />
            </div>

            {/* Quick Actions */}
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-[-10px] group-hover:translate-y-0">
               <button 
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   handleDelete();
                 }}
                 className="h-8 w-8 rounded-full bg-red-500/10 backdrop-blur text-red-600 hover:text-red-700 hover:bg-red-500/20 flex items-center justify-center transition-colors shadow-sm border border-red-500/20 hover:border-red-500/40" 
                 title="Delete style"
               >
                 <Trash2 size={14} />
               </button>
            </div>
          </div>
        </Link>

        {/* Info Area */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-serif font-medium text-lg leading-tight group-hover:text-primary transition-colors">
              <Link href={`/style/${style.id}`}>{style.name}</Link>
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider border border-border px-1.5 py-0.5 rounded-sm">
              V1.0
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {style.description}
          </p>

          <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5">
               <ImageIcon size={12} />
               <span>{Object.keys(style.tokens).length} Token Groups</span>
            </div>
            <time dateTime={style.createdAt}>
              {new Date(style.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </time>
          </div>
        </div>
      </div>
      </motion.div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowConfirmDialog(false)}
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
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
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
}
