import { Layout } from "@/components/layout";
import { useState } from "react";
import { Upload, Wand2, ArrowRight, Loader2, Code, Image as ImageIcon } from "lucide-react";
import { useLocation } from "wouter";
import { addStyle, SAMPLE_TOKENS } from "@/lib/store";
import { TokenViewer } from "@/components/token-viewer";
import { cn } from "@/lib/utils";

export default function Authoring() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!name || !prompt) return;
    
    setIsGenerating(true);
    
    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false);
      setStep(2);
    }, 2000);
  };

  const handleSave = () => {
    addStyle({
      id: `style-${Date.now()}`,
      name: name,
      description: prompt,
      createdAt: new Date().toISOString(),
      referenceImages: referenceImage ? [referenceImage] : [],
      previews: {
        stillLife: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop", // Placeholder
        landscape: "https://images.unsplash.com/photo-1614850523060-8da1d56e37def?q=80&w=600&auto=format&fit=crop", // Placeholder
        portrait: "https://images.unsplash.com/photo-1614851099511-e51a8781977d?q=80&w=600&auto=format&fit=crop", // Placeholder
      },
      tokens: SAMPLE_TOKENS, // In a real app, this would be generated
      promptScaffolding: {
        base: prompt,
        modifiers: ["generated", "auto-extracted"],
        negative: "blurry, low quality"
      }
    });
    
    setLocation("/");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="border-b border-border pb-6">
          <h1 className="text-3xl font-serif font-medium text-foreground">Style Authoring</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Create a new immutable style artifact. System will automatically generate canonical previews and W3C tokens.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-4 text-sm font-mono border-b border-border pb-8">
           <div className={cn("flex items-center gap-2", step === 1 ? "text-primary" : "text-muted-foreground")}>
             <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
             <span>DEFINITION</span>
           </div>
           <div className="h-px w-8 bg-border"></div>
           <div className={cn("flex items-center gap-2", step === 2 ? "text-primary" : "text-muted-foreground")}>
             <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
             <span>TOKENIZATION & PREVIEW</span>
           </div>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Left: Inputs */}
             <div className="space-y-6">
               <div className="space-y-2">
                 <label className="text-sm font-medium">Style Name</label>
                 <input 
                   type="text" 
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                   placeholder="e.g. Kinetic Typographic Clay"
                 />
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-medium">Generative Prompt / Description</label>
                 <textarea 
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[120px]"
                   placeholder="Describe the visual characteristics, lighting, texture, and mood..."
                 />
               </div>

               <div className="pt-4">
                  <button 
                    onClick={handleGenerate}
                    disabled={!name || !prompt || isGenerating}
                    className="w-full bg-primary text-primary-foreground h-10 rounded-sm flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                    {isGenerating ? "Analyzing & Tokenizing..." : "Generate Artifacts"}
                  </button>
               </div>
             </div>

             {/* Right: Reference */}
             <div className="space-y-4">
                <label className="text-sm font-medium">Reference Image (Optional)</label>
                <div className="aspect-square border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10">
                   <Upload size={32} className="mb-2 opacity-50" />
                   <span className="text-xs">Drag & drop or click to upload</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Providing a reference image helps the tokenizer extract more accurate palette and texture data.
                </p>
             </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-sm text-green-700 dark:text-green-400 text-sm flex items-center gap-3">
               <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
               <span>Analysis complete. Tokens extracted and previews generated.</span>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Generated Previews */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ImageIcon size={14} /> Generated Previews
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="col-span-2 aspect-video bg-muted rounded-sm border border-border relative overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1614850523060-8da1d56e37def?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Landscape" />
                        <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm">Landscape</span>
                     </div>
                     <div className="aspect-square bg-muted rounded-sm border border-border relative overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Still Life" />
                        <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm">Still Life</span>
                     </div>
                     <div className="aspect-[3/4] bg-muted rounded-sm border border-border relative overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1614851099511-e51a8781977d?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Portrait" />
                        <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm">Portrait</span>
                     </div>
                  </div>
                </div>

                {/* Generated Tokens */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Code size={14} /> Extracted Tokens
                  </h3>
                  <TokenViewer tokens={SAMPLE_TOKENS} className="h-[400px]" />
                </div>
             </div>

             <div className="flex justify-end gap-4 pt-6 border-t border-border">
                <button 
                   onClick={() => setStep(1)}
                   className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-sm transition-colors"
                >
                  Discard & Restart
                </button>
                <button 
                   onClick={handleSave}
                   className="bg-primary text-primary-foreground px-6 py-2 rounded-sm flex items-center gap-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Commit to Vault <ArrowRight size={16} />
                </button>
             </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
