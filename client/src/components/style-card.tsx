import { Style } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Eye, Code, ImageIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface StyleCardProps {
  style: Style;
  className?: string;
}

export function StyleCard({ style, className }: StyleCardProps) {
  const [activePreview, setActivePreview] = useState<'stillLife' | 'landscape' | 'portrait'>('stillLife');

  return (
    <div className={cn("group relative flex flex-col bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-primary/20", className)}>
      {/* Preview Area */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <img 
          src={style.previews[activePreview]} 
          alt={`${style.name} - ${activePreview}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Preview Switcher Overlay - Appears on Hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <div className="flex gap-2 w-full justify-center">
            {(['stillLife', 'landscape', 'portrait'] as const).map((type) => (
              <button
                key={type}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActivePreview(type);
                }}
                className={cn(
                  "h-1.5 flex-1 rounded-full backdrop-blur-md transition-colors",
                  activePreview === type ? "bg-white" : "bg-white/30 hover:bg-white/50"
                )}
                title={type}
              />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-[-10px] group-hover:translate-y-0">
           <button className="h-8 w-8 rounded-full bg-white/90 backdrop-blur text-black flex items-center justify-center hover:bg-white transition-colors shadow-sm" title="Inspect Tokens">
             <Code size={14} />
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
  );
}
