import { Layout } from "@/components/layout";
import { fetchStyles, type Style } from "@/lib/store";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, Wand2, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Generation() {
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetchStyles()
      .then(setStyles)
      .finally(() => setLoading(false));
  }, []);

  const selectedStyle = styles.find(s => s.id === selectedStyleId);

  const handleGenerate = () => {
    if (!selectedStyleId || !prompt) return;
    setIsGenerating(true);
    setResult(null);
    
    setTimeout(() => {
      setIsGenerating(false);
      setResult("https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop");
    }, 2500);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="border-b border-border pb-4 md:pb-6 mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Application</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-2">
            Apply a curated style to a new concept. The system will blend your prompt with the style's rigid token definition.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 flex-1 min-h-0">
          
          {/* Left: Style Selector */}
          <div className="col-span-1 lg:col-span-4 flex flex-col border-b lg:border-b-0 lg:border-r border-border pb-4 md:pb-6 lg:pb-0 lg:pr-6 overflow-hidden">
             <div className="flex items-center gap-2 mb-4 bg-muted/30 p-2 rounded-sm border border-border/50">
               <Search size={14} className="text-muted-foreground" />
               <input 
                 type="text" 
                 placeholder="Filter styles..." 
                 className="bg-transparent border-none outline-none text-xs w-full"
                 data-testid="input-filter-styles"
               />
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
               {styles.map((style) => (
                 <div 
                   key={style.id}
                   onClick={() => setSelectedStyleId(style.id)}
                   data-testid={`card-style-${style.id}`}
                   className={cn(
                     "flex gap-3 p-2 rounded-md border cursor-pointer transition-all hover:shadow-sm",
                     selectedStyleId === style.id 
                       ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20" 
                       : "bg-card border-border hover:border-primary/20"
                   )}
                 >
                    <div className="w-16 h-16 rounded-sm bg-muted overflow-hidden flex-shrink-0">
                      <img src={style.previews.stillLife} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <h4 className={cn("font-medium text-sm truncate", selectedStyleId === style.id && "text-primary")}>{style.name}</h4>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{style.description}</p>
                    </div>
                 </div>
               ))}
               
               {styles.length === 0 && (
                 <div className="text-center text-muted-foreground text-sm py-8">
                   No styles available. Create one first.
                 </div>
               )}
             </div>
          </div>

          {/* Middle: Prompt Input */}
          <div className="col-span-1 lg:col-span-4 flex flex-col border-b lg:border-b-0 lg:border-r border-border pb-4 md:pb-6 lg:pb-0 lg:px-6">
             <h3 className="text-sm font-medium mb-4">Describe Your Concept</h3>
             
             {selectedStyle && (
               <div className="mb-4 p-3 bg-muted/50 rounded-sm border border-border/50">
                 <p className="text-xs text-muted-foreground">Applying style:</p>
                 <p className="text-sm font-medium">{selectedStyle.name}</p>
               </div>
             )}
             
             <textarea 
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               placeholder="e.g., A cozy reading nook with warm lighting and vintage books..."
               className="flex-1 resize-none p-3 text-sm bg-background border border-border rounded-sm focus:ring-1 focus:ring-primary/30 outline-none min-h-[120px]"
               data-testid="input-concept-prompt"
             />
             
             <button 
               onClick={handleGenerate}
               disabled={!selectedStyleId || !prompt || isGenerating}
               data-testid="button-generate"
               className={cn(
                 "mt-4 h-10 flex items-center justify-center gap-2 rounded-sm text-sm font-medium transition-all",
                 selectedStyleId && prompt && !isGenerating
                   ? "bg-primary text-primary-foreground hover:opacity-90"
                   : "bg-muted text-muted-foreground cursor-not-allowed"
               )}
             >
               {isGenerating ? (
                 <>
                   <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                   Generating...
                 </>
               ) : (
                 <>
                   <Wand2 size={14} />
                   Generate
                   <ArrowRight size={14} />
                 </>
               )}
             </button>
          </div>

          {/* Right: Result Preview */}
          <div className="col-span-1 lg:col-span-4 flex flex-col lg:pl-6">
             <h3 className="text-sm font-medium mb-4">Result</h3>
             
             <div className="flex-1 bg-muted rounded-sm border border-border overflow-hidden relative min-h-[200px]">
               {result ? (
                 <motion.img 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   src={result} 
                   alt="Generated result" 
                   className="w-full h-full object-cover"
                 />
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center">
                   <p className="text-xs text-muted-foreground font-mono text-center px-4">
                     {isGenerating ? "Processing..." : "Select a style and describe your concept"}
                   </p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
