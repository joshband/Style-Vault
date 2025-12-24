import { Layout } from "@/components/layout";
import { getStyles, Style } from "@/lib/store";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Search, Wand2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Generation() {
  const styles = getStyles();
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const selectedStyle = styles.find(s => s.id === selectedStyleId);

  const handleGenerate = () => {
    if (!selectedStyleId || !prompt) return;
    setIsGenerating(true);
    setResult(null);
    
    setTimeout(() => {
      setIsGenerating(false);
      // Mock result
      setResult("https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop");
    }, 2500);
  };

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
               />
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
               {styles.map((style) => (
                 <div 
                   key={style.id}
                   onClick={() => setSelectedStyleId(style.id)}
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
             </div>
          </div>

          {/* Middle/Right: Composition & Result */}
          <div className="col-span-1 lg:col-span-8 flex flex-col gap-4 md:gap-6 overflow-y-auto">
             
             {/* Prompt Input */}
             <div className="space-y-4 flex-shrink-0">
               <div className="flex items-center justify-between">
                 <label className="text-sm font-medium">Prompt</label>
                 {selectedStyle && (
                   <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                     Active Style: {selectedStyle.name}
                   </span>
                 )}
               </div>
               <div className="relative">
                 <textarea 
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   className="w-full bg-background border border-border rounded-md p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm min-h-[100px] resize-none"
                   placeholder={selectedStyle ? `Describe what you want to generate in the style of "${selectedStyle.name}"...` : "Select a style to begin..."}
                   disabled={!selectedStyle}
                 />
                 <button
                   onClick={handleGenerate}
                   disabled={!selectedStyle || !prompt || isGenerating}
                   className="absolute bottom-4 right-4 bg-primary text-primary-foreground h-8 px-4 rounded-sm text-xs font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                   {isGenerating ? <span className="animate-spin">⏳</span> : <Wand2 size={12} />}
                   Generate
                 </button>
               </div>
             </div>

             {/* Result Area */}
             <div className="flex-1 bg-muted/10 border-2 border-dashed border-border rounded-lg flex items-center justify-center relative overflow-hidden min-h-[400px]">
                {result ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full h-full p-4"
                  >
                    <img src={result} className="w-full h-full object-contain rounded-md shadow-lg" />
                    <div className="absolute top-6 right-6 flex gap-2">
                       <button className="bg-black/70 text-white px-3 py-1.5 rounded-sm text-xs backdrop-blur-md hover:bg-black/90">
                         Upscale
                       </button>
                       <button className="bg-black/70 text-white px-3 py-1.5 rounded-sm text-xs backdrop-blur-md hover:bg-black/90">
                         Save to Library
                       </button>
                    </div>
                  </motion.div>
                ) : (
                   <div className="text-center text-muted-foreground">
                      {isGenerating ? (
                        <div className="flex flex-col items-center gap-4">
                           <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                           <p className="text-sm font-mono animate-pulse">Synthesizing style tokens...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-50">
                           <Wand2 size={32} />
                           <p className="text-sm">Select a style and enter a prompt to generate</p>
                        </div>
                      )}
                   </div>
                )}
             </div>

             {selectedStyle && !result && !isGenerating && (
                <div className="p-4 bg-muted/30 rounded-md border border-border/50 text-xs font-mono text-muted-foreground space-y-2">
                   <p className="uppercase font-bold text-[10px] opacity-70">Injecting Token Scaffolding:</p>
                   <div className="grid grid-cols-2 gap-2">
                     <div>BASE: <span className="text-foreground">{selectedStyle.promptScaffolding.base}</span></div>
                     <div>MODS: <span className="text-foreground">{selectedStyle.promptScaffolding.modifiers.join(", ")}</span></div>
                   </div>
                </div>
             )}

          </div>
        </div>
      </div>
    </Layout>
  );
}
