import { useState, useRef } from "react";
import { Upload, Wand2, ArrowRight, ArrowLeft, Loader2, X, Layers, Check, Sparkles } from "lucide-react";
import { useLocation, Link } from "wouter";
import { createStyle, SAMPLE_TOKENS } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { compressImage, getImageSizeKB } from "@/lib/image-utils";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2;
type InputMode = "image" | "prompt" | null;

interface TokenSummary {
  colorCount: number;
  hasTypography: boolean;
  hasSpacing: boolean;
  hasShadows: boolean;
}

function getTokenSummary(tokens: any): TokenSummary {
  return {
    colorCount: tokens?.color ? Object.keys(tokens.color).length : 0,
    hasTypography: !!tokens?.typography,
    hasSpacing: !!tokens?.spacing,
    hasShadows: !!tokens?.shadow,
  };
}

export default function Author() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [inputMode, setInputMode] = useState<InputMode>(null);

  // Input state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState("");

  // Generated data
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [generatedPreviews, setGeneratedPreviews] = useState<{
    stillLife: string;
    landscape: string;
    portrait: string;
  } | null>(null);

  // Loading states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasValidInput = inputMode === "image" ? !!referenceImage : (inputMode === "prompt" && textPrompt.trim().length >= 10);
  const canProceedToStep2 = hasValidInput && !isAnalyzing;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setIsAnalyzing(true);
    setInputMode("image");

    try {
      const compressedDataUrl = await compressImage(file);
      const sizeKB = getImageSizeKB(compressedDataUrl);
      console.log(`Image compressed to ${sizeKB}KB`);

      setReferenceImage(compressedDataUrl);

      try {
        const response = await fetch("/api/analyze-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: compressedDataUrl }),
        });

        if (response.ok) {
          const { styleName, description: desc } = await response.json();
          setName(styleName || "");
          setDescription(desc || "");
        } else {
          setFallbackFromFile(file.name);
        }
      } catch {
        setFallbackFromFile(file.name);
      }
    } catch {
      setFallbackFromFile(file.name);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const setFallbackFromFile = (fileName: string) => {
    const cleanName = fileName.replace(/\.[^/.]+$/, "");
    const fallbackName = cleanName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    setName(fallbackName);
    setDescription(`A visual style inspired by ${cleanName}.`);
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

  const proceedToStep2 = async () => {
    if (!canProceedToStep2) return;

    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleName: name,
          styleDescription: description,
          referenceImageBase64: referenceImage,
        }),
      });

      if (response.ok) {
        const { previews } = await response.json();
        setGeneratedPreviews({
          stillLife: previews.stillLife || "",
          landscape: previews.landscape || "",
          portrait: previews.portrait || "",
        });
      } else {
        setGeneratedPreviews({
          stillLife: "",
          landscape: "",
          portrait: "",
        });
      }
    } catch {
      setGeneratedPreviews({
        stillLife: "",
        landscape: "",
        portrait: "",
      });
    } finally {
      setIsGenerating(false);
      setStep(2);
    }
  };

  const goBackToStep1 = () => {
    setStep(1);
  };

  const resetWizard = () => {
    setStep(1);
    setInputMode(null);
    setReferenceImage(null);
    setTextPrompt("");
    setName("");
    setDescription("");
    setGeneratedPreviews(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateStyle = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your style",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await createStyle({
        name: name.trim(),
        description: description.trim(),
        referenceImages: referenceImage ? [referenceImage] : [],
        previews: generatedPreviews || { stillLife: "", landscape: "", portrait: "" },
        tokens: SAMPLE_TOKENS,
        promptScaffolding: {
          base: description,
          modifiers: ["auto-generated"],
          negative: "blurry, low quality, distorted",
        },
        metadataTags: undefined as any,
      });

      toast({
        title: "Style created!",
        description: `"${name}" has been added to your library`,
      });

      setLocation("/");
    } catch (error) {
      toast({
        title: "Creation failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const tokenSummary = getTokenSummary(SAMPLE_TOKENS);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <Layers size={20} />
          <span className="font-serif font-medium text-sm">Style Explorer</span>
        </Link>
        <Link 
          href="/" 
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-cancel"
        >
          Cancel
        </Link>
      </header>

      {/* Progress Indicator */}
      <div className="border-b border-border bg-muted/30">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-center gap-4">
            <div className={cn(
              "flex items-center gap-2 transition-colors",
              step === 1 ? "text-foreground" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                step > 1 && "bg-green-500 text-white"
              )}>
                {step > 1 ? <Check size={16} /> : "1"}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Reference Input</span>
            </div>

            <div className={cn(
              "w-12 h-0.5 transition-colors",
              step >= 2 ? "bg-primary" : "bg-border"
            )} />

            <div className={cn(
              "flex items-center gap-2 transition-colors",
              step === 2 ? "text-foreground" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                2
              </div>
              <span className="text-sm font-medium hidden sm:inline">Review & Create</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center px-4 md:px-8 py-8 md:py-12">
        <div className="w-full max-w-2xl">
          
          {/* Step 1: Reference Input */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">
                  Create a New Style
                </h1>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Upload a reference image or describe the style you want to create
                </p>
              </div>

              {/* Input Options */}
              {!inputMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Upload Image Option */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer p-6"
                    data-testid="dropzone-image"
                  >
                    <Upload size={40} className="mb-4 opacity-50" />
                    <span className="text-sm font-medium text-center">Upload Reference Image</span>
                    <span className="text-xs mt-2 opacity-60 text-center">Drag & drop or click to browse</span>
                  </div>

                  {/* Text Prompt Option */}
                  <div
                    onClick={() => setInputMode("prompt")}
                    className="aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer p-6"
                    data-testid="option-prompt"
                  >
                    <Sparkles size={40} className="mb-4 opacity-50" />
                    <span className="text-sm font-medium text-center">Describe with Words</span>
                    <span className="text-xs mt-2 opacity-60 text-center">Enter a text description</span>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {inputMode === "image" && referenceImage && (
                <div className="space-y-4">
                  <div className="relative aspect-video max-w-md mx-auto border border-border rounded-xl overflow-hidden bg-muted">
                    <img
                      src={referenceImage}
                      alt="Reference"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={resetWizard}
                      className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                      data-testid="button-remove-image"
                    >
                      <X size={16} />
                    </button>
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-white text-sm">
                          <Loader2 size={18} className="animate-spin" />
                          Analyzing image...
                        </div>
                      </div>
                    )}
                  </div>
                  {!isAnalyzing && (
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-sm">
                        <Check size={14} />
                        Reference image loaded
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prompt Input */}
              {inputMode === "prompt" && !referenceImage && (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      value={textPrompt}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTextPrompt(value);
                        // Auto-sync description and name as user types
                        if (value.trim().length >= 10) {
                          setDescription(value.trim());
                          if (!name) {
                            const words = value.trim().split(/\s+/).slice(0, 4);
                            const generatedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                            setName(generatedName);
                          }
                        }
                      }}
                      placeholder="Describe the visual style you want to create... (e.g., 'Warm sunset tones with soft gradients, vintage film grain, and muted earth colors')"
                      className="w-full h-40 bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      data-testid="input-prompt"
                      autoFocus
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                      {textPrompt.length} / 500
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={resetWizard}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Use image instead
                    </button>
                    {textPrompt.trim().length >= 10 && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check size={14} />
                        Ready to continue
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {/* Next Button */}
              <div className="pt-4">
                <button
                  onClick={proceedToStep2}
                  disabled={!canProceedToStep2 || isGenerating}
                  className={cn(
                    "w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all",
                    canProceedToStep2
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  data-testid="button-next"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Generating previews...
                    </>
                  ) : (
                    <>
                      Continue to Review
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                {!hasValidInput && inputMode && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {inputMode === "image" ? "Upload an image to continue" : "Enter at least 10 characters"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Review & Commit */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">
                  Review Your Style
                </h1>
                <p className="text-muted-foreground text-sm">
                  Finalize the name and description before creating
                </p>
              </div>

              {/* Editable Name */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Style Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a name for your style"
                  className="w-full h-12 bg-background border border-border rounded-xl px-4 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  data-testid="input-name"
                />
              </div>

              {/* Editable Description */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the visual characteristics of this style"
                  className="w-full h-24 bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  data-testid="input-description"
                />
              </div>

              {/* Token Summary (Read-only) */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Design Tokens (Auto-generated)
                </label>
                <div className="p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-primary">{tokenSummary.colorCount}</div>
                      <div className="text-xs text-muted-foreground">Colors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-primary">{tokenSummary.hasTypography ? "Yes" : "—"}</div>
                      <div className="text-xs text-muted-foreground">Typography</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-primary">{tokenSummary.hasSpacing ? "Yes" : "—"}</div>
                      <div className="text-xs text-muted-foreground">Spacing</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono font-bold text-primary">{tokenSummary.hasShadows ? "Yes" : "—"}</div>
                      <div className="text-xs text-muted-foreground">Shadows</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Thumbnails (if available) */}
              {generatedPreviews && (generatedPreviews.landscape || generatedPreviews.portrait || generatedPreviews.stillLife) && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Generated Previews
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {generatedPreviews.landscape && (
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden border border-border">
                        <img src={generatedPreviews.landscape} alt="Landscape" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {generatedPreviews.portrait && (
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden border border-border">
                        <img src={generatedPreviews.portrait} alt="Portrait" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {generatedPreviews.stillLife && (
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden border border-border">
                        <img src={generatedPreviews.stillLife} alt="Still Life" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={goBackToStep1}
                  className="flex-1 h-12 border border-border rounded-xl flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  data-testid="button-back"
                >
                  <ArrowLeft size={18} />
                  Back
                </button>
                <button
                  onClick={handleCreateStyle}
                  disabled={!name.trim() || isSaving}
                  className={cn(
                    "flex-[2] h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all",
                    name.trim()
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  data-testid="button-create-style"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} />
                      Create Style
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
