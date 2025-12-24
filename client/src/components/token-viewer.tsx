import { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DTCGTokenGroup, DesignToken } from "@/lib/store";

interface TokenViewerProps {
  tokens: DTCGTokenGroup;
  className?: string;
}

export function TokenViewer({ tokens, className }: TokenViewerProps) {
  return (
    <div className={cn("font-mono text-xs bg-muted/30 border border-border rounded-md overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="font-medium text-muted-foreground uppercase tracking-wider text-[10px]">W3C DTCG Token Definition</span>
        <button className="text-muted-foreground hover:text-foreground transition-colors" title="Copy JSON">
          <Copy size={12} />
        </button>
      </div>
      <div className="p-4 overflow-x-auto overflow-y-auto">
        <TokenNode node={tokens} label="root" isRoot />
      </div>
    </div>
  );
}

function TokenNode({ node, label, isRoot = false }: { node: DTCGTokenGroup | DesignToken, label: string, isRoot?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  
  const isToken = (n: any): n is DesignToken => {
    return n && typeof n === 'object' && '$value' in n;
  };

  if (isToken(node)) {
    return (
      <div className="pl-4 py-0.5 group flex items-start">
        <span className="text-muted-foreground mr-2 opacity-50 select-none">·</span>
        <span className="text-accent-foreground mr-2 font-medium">"{label}"</span>
        <span className="text-muted-foreground mr-2">:</span>
        <span className="text-primary truncate">
           {typeof node.$value === 'object' ? JSON.stringify(node.$value) : `"${node.$value}"`}
        </span>
        <span className="ml-2 text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
           {/* ({node.$type}) */}
           {node.$type}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(!isRoot && "pl-4")}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center gap-1.5 py-0.5 hover:bg-muted/50 w-full text-left rounded-sm px-1 -ml-1 transition-colors"
      >
        {isOpen ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
        <span className={cn("font-bold text-foreground", isRoot && "hidden")}>
          "{label}"
        </span>
        {isRoot && <span className="text-muted-foreground italic">root</span>}
      </button>
      
      {isOpen && (
        <div className="border-l border-border/50 ml-2.5">
          {Object.entries(node).map(([key, value]) => (
            <TokenNode key={key} node={value as any} label={key} />
          ))}
        </div>
      )}
    </div>
  );
}
