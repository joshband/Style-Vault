import { Style } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Code, ImageIcon } from "lucide-react";
import { Link } from "wouter";

interface StyleCardProps {
  style: Style;
  className?: string;
}

export function StyleCard({ style, className }: StyleCardProps) {
  return (
    <div className={cn("group relative flex flex-col bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-primary/20", className)}>
      {/* Preview Area - 3 Column Composite */}
      <div className="relative aspect-[12/4] bg-muted overflow-hidden flex">
        {/* Portrait Column */}
        <div className="flex-1 relative overflow-hidden border-r border-border/50">
          <img 
            src={style.previews.portrait} 
            alt={`${style.name} - portrait`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        {/* Landscape Column */}
        <div className="flex-1 relative overflow-hidden border-r border-border/50">
          <img 
            src={style.previews.landscape} 
            alt={`${style.name} - landscape`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        {/* Still Life Column */}
        <div className="flex-1 relative overflow-hidden">
          <img 
            src={style.previews.stillLife} 
            alt={`${style.name} - still life`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
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
