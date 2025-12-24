import { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { DTCGTokenGroup, DesignToken } from "@/lib/store";

interface TokenViewerProps {
  tokens: DTCGTokenGroup;
  className?: string;
  expandable?: boolean;
  showExport?: boolean;
}

export function TokenViewer({ tokens, className, expandable = false, showExport = false }: TokenViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(tokens, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(tokens, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-tokens.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn(
      "font-mono text-xs bg-muted/30 border border-border rounded-md overflow-hidden",
      !expandable && "overflow-y-auto",
      className
    )}>
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="font-medium text-muted-foreground uppercase tracking-wider text-[10px]">W3C DTCG Token Definition</span>
        <div className="flex items-center gap-2">
          {showExport && (
            <button 
              onClick={handleDownload}
              className="text-muted-foreground hover:text-foreground transition-colors" 
              title="Download JSON"
              data-testid="button-download-tokens"
            >
              <Download size={12} />
            </button>
          )}
          <button 
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors" 
            title={copied ? "Copied!" : "Copy JSON"}
            data-testid="button-copy-tokens"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      <div className={cn("p-4 overflow-x-auto", !expandable && "overflow-y-auto")}>
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
