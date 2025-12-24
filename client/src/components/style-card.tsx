import { Style, deleteStyle } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Code, ImageIcon, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { trackStyleView } from "@/lib/suggestions";
import { motion } from "framer-motion";

interface StyleCardProps {
  style: Style;
  className?: string;
  onDelete?: (id: string) => void;
}

export function StyleCard({ style, className, onDelete }: StyleCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  
  // Track view on mount
  useEffect(() => {
    trackStyleView(style.id);
  }, [style.id]);

  const handleDragEnd = (info: any) => {
    // Swipe left to delete
    if (info.offset.x < -100 || info.velocity.x < -500) {
      deleteStyle(style.id);
      onDelete?.(style.id);
    } else {
      setDragX(0);
    }
  };

  const handleDelete = () => {
    deleteStyle(style.id);
    onDelete?.(style.id);
  };

  return (
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
      {/* Delete indicator background */}
      <motion.div
        className="absolute inset-0 bg-red-500/10 border border-red-500/20 rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: dragX < -20 ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      
      <div className={cn("group relative flex flex-col bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-primary/20", isDragging && "cursor-grabbing")}>
        {/* Preview Area - 3 Column Composite */}
        <div className="relative aspect-[12/4] bg-muted overflow-hidden flex">
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
             <button className="h-8 w-8 rounded-full bg-white/90 backdrop-blur text-black flex items-center justify-center hover:bg-white transition-colors shadow-sm" title="Inspect Tokens">
               <Code size={14} />
             </button>
             <button 
               onClick={(e) => {
                 e.preventDefault();
                 handleDelete();
               }}
               className="h-8 w-8 rounded-full bg-red-500/10 backdrop-blur text-red-600 hover:text-red-700 hover:bg-red-500/20 flex items-center justify-center transition-colors shadow-sm border border-red-500/20 hover:border-red-500/40" 
               title="Delete style"
             >
               <Trash2 size={14} />
             </button>
          </div>
        </div>

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
  );
}
