import { useRoute } from "wouter";
import { getStyleById } from "@/lib/store";
import { Layout } from "@/components/layout";
import { TokenViewer } from "@/components/token-viewer";
import { ArrowLeft, ImageIcon, Layers, Download } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function StyleDetail() {
  const [, params] = useRoute("/style/:id");
  const id = params?.id;
  const style = id ? getStyleById(id) : undefined;
  const [activeTab, setActiveTab] = useState<'tokens' | 'scaffolding'>('tokens');

  if (!style) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <h1 className="text-2xl font-serif text-muted-foreground">Style Not Found</h1>
          <Link href="/" className="mt-4 text-sm underline">Return to Explorer</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col gap-6">
           <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono mb-2">
             <ArrowLeft size={12} /> Back to Vault
           </Link>
           
           <div className="flex items-start justify-between">
             <div className="space-y-2">
               <h1 className="text-4xl font-serif font-medium text-foreground">{style.name}</h1>
               <p className="text-muted-foreground max-w-2xl text-lg font-light leading-relaxed">
                 {style.description}
               </p>
             </div>
             <div className="flex gap-3">
               <button className="h-9 px-4 flex items-center gap-2 border border-border rounded-sm hover:bg-secondary transition-colors text-sm font-medium">
                 <Download size={14} />
                 Export Bundle
               </button>
             </div>
           </div>
           
           <div className="flex gap-4 text-xs font-mono text-muted-foreground border-b border-border pb-6">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-sm">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>ID: {style.id}</span>
             </div>
             <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-sm">
                <Layers size={12} />
                <span>v1.0.0</span>
             </div>
             <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-sm">
                <ImageIcon size={12} />
                <span>Standardized DTCG</span>
             </div>
           </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-12 gap-8">
          
          {/* Left Column: Visuals */}
          <div className="col-span-12 lg:col-span-7 space-y-8">
             <div className="space-y-4">
               <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Canonical Previews</h2>
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 aspect-video bg-muted rounded-sm overflow-hidden border border-border relative group">
                    <img src={style.previews.landscape} className="w-full h-full object-cover" alt="Landscape" />
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-sm backdrop-blur-sm">
                      LANDSCAPE 16:9
                    </div>
                  </div>
                  <div className="aspect-square bg-muted rounded-sm overflow-hidden border border-border relative group">
                    <img src={style.previews.stillLife} className="w-full h-full object-cover" alt="Still Life" />
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-sm backdrop-blur-sm">
                      STILL LIFE 1:1
                    </div>
                  </div>
                  <div className="aspect-[3/4] bg-muted rounded-sm overflow-hidden border border-border relative group">
                    <img src={style.previews.portrait} className="w-full h-full object-cover" alt="Portrait" />
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-sm backdrop-blur-sm">
                      PORTRAIT 3:4
                    </div>
                  </div>
               </div>
             </div>

             <div className="space-y-4 pt-8 border-t border-border">
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Reference Artifacts</h2>
                <div className="grid grid-cols-4 gap-4">
                  {style.referenceImages.map((img, i) => (
                    <div key={i} className="aspect-square bg-muted rounded-sm overflow-hidden border border-border opacity-80 hover:opacity-100 transition-opacity cursor-zoom-in">
                       <img src={img} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" alt="Reference" />
                    </div>
                  ))}
                </div>
             </div>
          </div>

          {/* Right Column: Data */}
          <div className="col-span-12 lg:col-span-5 flex flex-col h-full">
            <div className="sticky top-20 space-y-4">
              <div className="flex items-center gap-4 border-b border-border">
                <button 
                  onClick={() => setActiveTab('tokens')}
                  className={cn(
                    "pb-2 text-sm font-medium transition-colors border-b-2 translate-y-[1px]", 
                    activeTab === 'tokens' ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Design Tokens
                </button>
                <button 
                  onClick={() => setActiveTab('scaffolding')}
                  className={cn(
                    "pb-2 text-sm font-medium transition-colors border-b-2 translate-y-[1px]", 
                    activeTab === 'scaffolding' ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Prompt Scaffolding
                </button>
              </div>

              {activeTab === 'tokens' ? (
                <div className="space-y-2">
                   <p className="text-xs text-muted-foreground mb-4">
                     Full W3C Design Token Community Group (DTCG) standard definition. These tokens are the source of truth for this style.
                   </p>
                   <TokenViewer tokens={style.tokens} className="max-h-[600px] overflow-y-auto" />
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="space-y-2">
                     <label className="text-xs font-mono uppercase text-muted-foreground">Base Prompt</label>
                     <div className="p-3 bg-muted/30 border border-border rounded-md text-sm font-mono">
                       {style.promptScaffolding.base}
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-mono uppercase text-muted-foreground">Modifiers</label>
                     <div className="flex flex-wrap gap-2">
                       {style.promptScaffolding.modifiers.map((mod, i) => (
                         <span key={i} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-sm border border-border/50">
                           {mod}
                         </span>
                       ))}
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-mono uppercase text-destructive/70">Negative Constraints</label>
                     <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-md text-sm font-mono text-destructive/80">
                       {style.promptScaffolding.negative}
                     </div>
                   </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
