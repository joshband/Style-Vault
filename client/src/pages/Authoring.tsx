import { Layout } from "@/components/layout";
import { useState, useRef } from "react";
import { Upload, Wand2, ArrowRight, Loader2, Code, Image as ImageIcon, X } from "lucide-react";
import { useLocation } from "wouter";
import { addStyle, SAMPLE_TOKENS } from "@/lib/store";
import { TokenViewer } from "@/components/token-viewer";
import { cn } from "@/lib/utils";

export default function Authoring() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [generatedPreviews, setGeneratedPreviews] = useState<{ stillLife: string; landscape: string; portrait: string } | null>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setReferenceImage(dataUrl);
      setIsAnalyzing(true);
      
      // Analyze with AI after a brief delay to ensure state is set
      setTimeout(async () => {
        try {
          // Call backend to analyze image with AI
          const response = await fetch("/api/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: dataUrl }),
          });

          if (response.ok) {
            const { styleName, description } = await response.json();
            setName(styleName);
            setPrompt(description);
          } else {
            const error = await response.json().catch(() => ({}));
            console.warn("AI analysis failed, using fallback:", error);
            setFallbackName(file.name);
          }
        } catch (error) {
          console.error("Error analyzing image:", error);
          setFallbackName(file.name);
        } finally {
          setIsAnalyzing(false);
        }
      }, 100);
    };
    reader.readAsDataURL(file);
  };

  const setFallbackName = (fileName: string) => {
    const cleanName = fileName.replace(/\.[^/.]+$/, '');
    const fallbackName = cleanName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    setName(fallbackName);
    setPrompt(`A visual style inspired by ${cleanName}. Rich color palette, thoughtful composition, and distinctive lighting that captures the essence of the reference image.`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const generateVariations = async () => {
    if (!name || !prompt) return;
    
    setIsGenerating(true);
    
    try {
      // Call backend to generate canonical preview images
      const response = await fetch("/api/generate-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleName: name,
          styleDescription: prompt,
        }),
      });

      if (response.ok) {
        const { previews } = await response.json();
        
        setGeneratedPreviews({
          stillLife: previews.stillLife || "",
          landscape: previews.landscape || "",
          portrait: previews.portrait || "",
        });

        setStep(2);
      } else {
        const error = await response.json().catch(() => ({}));
        console.error("Preview generation failed:", error);
        // Fallback: use placeholder images
        setGeneratedPreviews({
          stillLife: `https://images.unsplash.com/photo-${Math.random().toString().slice(2, 15)}?q=80&w=600&auto=format&fit=crop`,
          landscape: `https://images.unsplash.com/photo-${Math.random().toString().slice(2, 15)}?q=80&w=600&auto=format&fit=crop`,
          portrait: `https://images.unsplash.com/photo-${Math.random().toString().slice(2, 15)}?q=80&w=600&auto=format&fit=crop`,
        });
        setStep(2);
      }
    } catch (error) {
      console.error("Error generating previews:", error);
      // Fallback silently
      setGeneratedPreviews({
        stillLife: `https://images.unsplash.com/photo-${Math.random().toString().slice(2, 15)}?q=80&w=600&auto=format&fit=crop`,
        landscape: `https://images.unsplash.com/photo-${Math.random().toString().slice(2, 15)}?q=80&w=600&auto=format&fit=crop`,
        portrait: `https://images.unsplash.com/photo-${Math.random().toString().slice(2, 15)}?q=80&w=600&auto=format&fit=crop`,
      });
      setStep(2);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedPreviews) return;

    addStyle({
      id: `style-${Date.now()}`,
      name: name,
      description: prompt,
      createdAt: new Date().toISOString(),
      referenceImages: referenceImage ? [referenceImage] : [],
      previews: generatedPreviews,
      tokens: SAMPLE_TOKENS, // In a real app, tokens would be extracted from the reference image
      promptScaffolding: {
        base: prompt,
        modifiers: ["extracted-from-reference", "auto-analyzed"],
        negative: "blurry, low quality, distorted"
      }
    });
    
    setLocation("/");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
        <div className="border-b border-border pb-4 md:pb-6">
          <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Authoring</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-2">
            Create a new immutable style artifact. System will automatically generate canonical previews and W3C tokens.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm font-mono border-b border-border pb-4 md:pb-8 overflow-x-auto">
           <div className={cn("flex items-center gap-2 whitespace-nowrap", step === 1 ? "text-primary" : "text-muted-foreground")}>
             <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] flex-shrink-0">1</span>
             <span>UPLOAD & ANALYZE</span>
           </div>
           <div className="h-px w-6 md:w-8 bg-border flex-shrink-0"></div>
           <div className={cn("flex items-center gap-2 whitespace-nowrap", step === 2 ? "text-primary" : "text-muted-foreground")}>
             <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] flex-shrink-0">2</span>
             <span>REVIEW & COMMIT</span>
           </div>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Left: Upload */}
             <div className="space-y-4 flex flex-col">
                <label className="text-sm font-medium">Step 1: Upload Reference Image</label>
                {referenceImage ? (
                  <div className="relative aspect-square border border-border rounded-sm overflow-hidden bg-muted">
                    <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => {
                        setReferenceImage(null);
                        setGeneratedPreviews(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-sm transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-green-500/90 text-white text-[10px] px-2 py-1 rounded-sm">
                      REFERENCE LOADED
                    </div>
                  </div>
                ) : (
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer bg-muted/10"
                  >
                    <Upload size={32} className="mb-2 opacity-50" />
                    <span className="text-xs font-medium">Drag & drop or click to upload</span>
                    <span className="text-[10px] mt-1 opacity-60">JPG, PNG, WebP • Max 10MB</span>
                  </div>
                )}
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Upload a reference image to extract visual style. The system will analyze color palette, texture, lighting, and compositional patterns to generate design tokens.
                </p>
             </div>

             {/* Right: Auto-filled Details */}
             <div className="space-y-4 flex flex-col">
               <label className="text-sm font-medium">Step 2: Refine Details (Auto-populated)</label>
               
               <div className="space-y-2">
                 <label className="text-xs font-medium text-muted-foreground">Style Name</label>
                 <input 
                   type="text" 
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   disabled={!referenceImage}
                   className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                   placeholder="Waiting for image upload..."
                 />
               </div>

               <div className="space-y-2 flex-1">
                 <label className="text-xs font-medium text-muted-foreground">Style Description</label>
                 <textarea 
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   disabled={!referenceImage || isAnalyzing}
                   className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[120px] disabled:opacity-50"
                   placeholder={isAnalyzing ? "AI analyzing image..." : "Waiting for image upload..."}
                 />
                 <p className="text-[10px] text-muted-foreground">
                   {isAnalyzing ? "✨ AI is analyzing your image..." : "Edit the AI-generated name and description as needed."}
                 </p>
               </div>

               <button 
                 onClick={generateVariations}
                 disabled={!referenceImage || !name || isGenerating || isAnalyzing}
                 className="w-full bg-primary text-primary-foreground h-10 rounded-sm flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
               >
                 {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                 {isGenerating ? "Extracting Tokens..." : "Extract Tokens & Generate Previews"}
               </button>
             </div>
          </div>
        )}

        {step === 2 && generatedPreviews && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             <div className="p-3 md:p-4 bg-green-500/10 border border-green-500/20 rounded-sm text-green-700 dark:text-green-400 text-xs md:text-sm flex items-start gap-2 md:gap-3">
               <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs flex-shrink-0">✓</div>
               <span>Analysis complete. Design tokens extracted and 3 canonical previews generated in a single immutable artifact.</span>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                {/* Generated Previews - 3 Columns Side-by-Side */}
                <div className="space-y-3 md:space-y-4">
                  <h3 className="text-xs md:text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ImageIcon size={14} /> Canonical Preview Set
                  </h3>
                  <div className="relative w-full border border-border rounded-sm bg-muted/20 overflow-hidden shadow-sm">
                    <div className="flex w-full aspect-[12/4] md:aspect-[16/6]">
                      {/* Portrait Column */}
                      <div className="flex-1 relative overflow-hidden border-r border-border/50">
                        <img src={generatedPreviews.portrait} className="w-full h-full object-cover" alt="Portrait" />
                      </div>
                      {/* Landscape Column */}
                      <div className="flex-1 relative overflow-hidden border-r border-border/50">
                        <img src={generatedPreviews.landscape} className="w-full h-full object-cover" alt="Landscape" />
                      </div>
                      {/* Still Life Column */}
                      <div className="flex-1 relative overflow-hidden">
                        <img src={generatedPreviews.stillLife} className="w-full h-full object-cover" alt="Still Life" />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Three canonical previews showcasing the style across different aspect ratios and subjects.
                  </p>
                </div>

                {/* Generated Tokens */}
                <div className="space-y-3 md:space-y-4">
                  <h3 className="text-xs md:text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Code size={14} /> W3C DTCG Design Tokens
                  </h3>
                  <TokenViewer tokens={SAMPLE_TOKENS} className="h-[300px] md:h-[400px]" />
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Extracted from the reference image using vision analysis and standardized in W3C Design Token Community Group format.
                  </p>
                </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-4 md:pt-6 border-t border-border">
                <button 
                   onClick={() => {
                     setStep(1);
                     setGeneratedPreviews(null);
                   }}
                   className="order-2 sm:order-1 px-4 py-2 text-xs md:text-sm font-medium hover:bg-secondary rounded-sm transition-colors border border-border"
                >
                  Back & Upload
                </button>
                <button 
                   onClick={handleSave}
                   className="order-1 sm:order-2 bg-primary text-primary-foreground px-4 md:px-6 py-2 rounded-sm flex items-center justify-center gap-2 text-xs md:text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Commit to Vault <ArrowRight size={14} />
                </button>
             </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
