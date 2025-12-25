import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Wand2, ArrowRight, ArrowLeft, Loader2, X, Layers, Check, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { useLocation, Link } from "wouter";
import { createStyle, SAMPLE_TOKENS } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useJob, Job } from "@/hooks/use-job";
import { compressImage, getImageSizeKB } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

type WizardStep = 1 | 2;
type InputMode = "image" | "prompt" | null;
type ErrorType = "ai_unavailable" | "cv_disabled" | "network" | "unknown" | null;

interface AuthorError {
  type: ErrorType;
  message: string;
  canRetry: boolean;
}

interface TokenSummary {
  colorCount: number;
  hasTypography: boolean;
  hasSpacing: boolean;
  hasShadows: boolean;
}

// Classify errors into human-readable categories
function classifyError(error: unknown, context: string): AuthorError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  
  // AI/Gemini service errors
  if (lowerMessage.includes("ai service") || 
      lowerMessage.includes("gemini") ||
      lowerMessage.includes("model") ||
      lowerMessage.includes("503") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("quota")) {
    return {
      type: "ai_unavailable",
      message: `AI service is temporarily unavailable. Your ${context} has been preserved - you can retry when the service recovers.`,
      canRetry: true,
    };
  }
  
  // CV extraction disabled
  if (lowerMessage.includes("cv extraction") || 
      lowerMessage.includes("cv_extraction_enabled") ||
      lowerMessage.includes("python") ||
      lowerMessage.includes("opencv")) {
    return {
      type: "cv_disabled",
      message: "Computer vision analysis is not available. Standard AI analysis will be used instead.",
      canRetry: false,
    };
  }
  
  // Network errors
  if (lowerMessage.includes("network") || 
      lowerMessage.includes("fetch") ||
      lowerMessage.includes("connection") ||
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("econnrefused") ||
      lowerMessage.includes("failed to fetch")) {
    return {
      type: "network",
      message: `Network connection failed during ${context}. Please check your connection and try again.`,
      canRetry: true,
    };
  }
  
  // Unknown errors
  return {
    type: "unknown",
    message: message || `Something went wrong during ${context}. Please try again.`,
    canRetry: true,
  };
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
  
  // Error state - preserved across retries
  const [analyzeError, setAnalyzeError] = useState<AuthorError | null>(null);
  const [generateError, setGenerateError] = useState<AuthorError | null>(null);
  const [saveError, setSaveError] = useState<AuthorError | null>(null);

  // Job-based progress tracking
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  // Hook into analysis job status
  const { job: analysisJob } = useJob(analysisJobId, {
    onSuccess: useCallback((job: Job) => {
      if (job.output) {
        setName(job.output.styleName || "");
        setDescription(job.output.description || "");
        setAnalyzeError(null);
      }
      setIsAnalyzing(false);
      setAnalysisJobId(null);
    }, []),
    onError: useCallback((job: Job) => {
      const classified = classifyError(new Error(job.error || "Analysis failed"), "image analysis");
      setAnalyzeError(classified);
      if (pendingFileRef.current) {
        setFallbackFromFile(pendingFileRef.current.name);
      }
      setIsAnalyzing(false);
      setAnalysisJobId(null);
    }, []),
  });

  // Hook into preview job status
  const handlePreviewSuccess = useCallback((job: Job) => {
    if (job.output) {
      setGeneratedPreviews({
        stillLife: job.output.stillLife || "",
        landscape: job.output.landscape || "",
        portrait: job.output.portrait || "",
      });
      setGenerateError(null);
    }
    setIsGenerating(false);
    setPreviewJobId(null);
    setStep(2);
  }, []);

  const handlePreviewError = useCallback((job: Job) => {
    const classified = classifyError(new Error(job.error || "Preview generation failed"), "preview generation");
    setGenerateError(classified);
    setGeneratedPreviews({ stillLife: "", landscape: "", portrait: "" });
    setIsGenerating(false);
    setPreviewJobId(null);
    setStep(2);
  }, []);

  const { job: previewJob } = useJob(previewJobId, {
    onSuccess: handlePreviewSuccess,
    onError: handlePreviewError,
  });

  // Submission guard - any operation in progress blocks others
  const isProcessing = isAnalyzing || isGenerating || isSaving;

  const hasValidInput = inputMode === "image" ? !!referenceImage : (inputMode === "prompt" && textPrompt.trim().length >= 10);
  const canProceedToStep2 = hasValidInput && !isAnalyzing;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (isProcessing) return; // Prevent duplicate submissions

    setIsAnalyzing(true);
    setInputMode("image");
    setAnalyzeError(null); // Clear previous errors
    pendingFileRef.current = file;

    try {
      const compressedDataUrl = await compressImage(file);
      const sizeKB = getImageSizeKB(compressedDataUrl);
      console.log(`Image compressed to ${sizeKB}KB`);

      setReferenceImage(compressedDataUrl);

      try {
        // Use job-based endpoint for progress tracking
        const response = await fetch("/api/jobs/analyze-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: compressedDataUrl }),
        });

        if (response.ok) {
          const { jobId } = await response.json();
          setAnalysisJobId(jobId);
          // Job polling will handle success/error via useJob hook
        } else {
          // Non-OK response - try to get error details
          let errorText = "Analysis failed";
          try {
            const errorData = await response.json();
            errorText = errorData.error || errorData.message || errorText;
          } catch {}
          
          const classified = classifyError(new Error(errorText), "image analysis");
          setAnalyzeError(classified);
          setFallbackFromFile(file.name);
          setIsAnalyzing(false);
        }
      } catch (error) {
        const classified = classifyError(error, "image analysis");
        setAnalyzeError(classified);
        setFallbackFromFile(file.name);
        setIsAnalyzing(false);
      }
    } catch (error) {
      const classified = classifyError(error, "image compression");
      setAnalyzeError(classified);
      setFallbackFromFile(file.name);
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
    if (!canProceedToStep2 || isProcessing) return; // Prevent duplicate submissions

    setIsGenerating(true);
    setGenerateError(null); // Clear previous errors

    try {
      // Use job-based endpoint for progress tracking
      const response = await fetch("/api/jobs/generate-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleName: name,
          styleDescription: description,
          referenceImageBase64: referenceImage,
        }),
      });

      if (response.ok) {
        const { jobId } = await response.json();
        setPreviewJobId(jobId);
        // Job polling will handle success/error via useJob hook
      } else {
        // Non-OK response - try to get error details
        let errorText = "Preview generation failed";
        try {
          const errorData = await response.json();
          errorText = errorData.error || errorData.message || errorText;
        } catch {}
        
        const classified = classifyError(new Error(errorText), "preview generation");
        setGenerateError(classified);
        
        // Still proceed to step 2 with empty previews if possible
        setGeneratedPreviews({ stillLife: "", landscape: "", portrait: "" });
        setIsGenerating(false);
        setStep(2);
      }
    } catch (error) {
      const classified = classifyError(error, "preview generation");
      setGenerateError(classified);
      
      // Still proceed to step 2 with empty previews
      setGeneratedPreviews({ stillLife: "", landscape: "", portrait: "" });
      setIsGenerating(false);
      setStep(2);
    }
  };
  
  // Retry preview generation from step 2
  const retryPreviewGeneration = async () => {
    if (isProcessing) return;
    
    setIsGenerating(true);
    setGenerateError(null);

    try {
      // Use job-based endpoint for progress tracking
      const response = await fetch("/api/jobs/generate-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleName: name,
          styleDescription: description,
          referenceImageBase64: referenceImage,
        }),
      });

      if (response.ok) {
        const { jobId } = await response.json();
        setPreviewJobId(jobId);
        // Job polling will handle success/error via useJob hook
      } else {
        let errorText = "Preview generation failed";
        try {
          const errorData = await response.json();
          errorText = errorData.error || errorData.message || errorText;
        } catch {}
        setGenerateError(classifyError(new Error(errorText), "preview generation"));
        setIsGenerating(false);
      }
    } catch (error) {
      setGenerateError(classifyError(error, "preview generation"));
      setIsGenerating(false);
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
    setAnalyzeError(null);
    setGenerateError(null);
    setSaveError(null);
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

    if (isProcessing) return; // Prevent duplicate submissions

    setIsSaving(true);
    setSaveError(null); // Clear previous errors

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
        title: "Style created successfully",
        description: `"${name}" has been added to your library`,
      });

      setLocation("/");
    } catch (error) {
      const classified = classifyError(error, "saving your style");
      setSaveError(classified);
      
      toast({
        title: "Creation failed",
        description: classified.message,
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
                      disabled={isProcessing}
                      className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                      data-testid="button-remove-image"
                    >
                      <X size={16} />
                    </button>
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4">
                        <div className="w-full max-w-xs space-y-3">
                          <div className="flex items-center justify-center gap-2 text-white text-sm">
                            <Loader2 size={18} className="animate-spin" />
                            <span>{analysisJob?.progressMessage || "Analyzing image..."}</span>
                          </div>
                          <Progress 
                            value={analysisJob?.progress || 0} 
                            className="h-2 bg-white/20" 
                            data-testid="progress-analysis"
                          />
                          <div className="text-center text-xs text-white/70">
                            {analysisJob?.progress || 0}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Analysis Error Alert */}
                  {analyzeError && !isAnalyzing && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl" data-testid="alert-analyze-error">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-amber-800 dark:text-amber-200">{analyzeError.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">Using fallback name and description. You can still proceed.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!isAnalyzing && !analyzeError && (
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
                      disabled={isProcessing}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="pt-4 space-y-3">
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
                      {previewJob?.progressMessage || "Generating previews..."}
                    </>
                  ) : (
                    <>
                      Continue to Review
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                {isGenerating && previewJob && (
                  <div className="space-y-1">
                    <Progress 
                      value={previewJob.progress} 
                      className="h-2" 
                      data-testid="progress-preview"
                    />
                    <div className="text-center text-xs text-muted-foreground">
                      {previewJob.progress}%
                    </div>
                  </div>
                )}
                {!hasValidInput && inputMode && !isGenerating && (
                  <p className="text-xs text-muted-foreground text-center">
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

              {/* Preview Generation Error Alert with Retry */}
              {generateError && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl" data-testid="alert-generate-error">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Preview generation issue</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{generateError.message}</p>
                      {generateError.canRetry && (
                        <button
                          onClick={retryPreviewGeneration}
                          disabled={isProcessing}
                          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                          data-testid="button-retry-previews"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              {isGenerating ? "Retrying..." : "Please wait..."}
                            </>
                          ) : (
                            <>
                              <RefreshCw size={12} />
                              Retry Preview Generation
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Save Error Alert with Retry */}
              {saveError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl" data-testid="alert-save-error">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">Could not create style</p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">{saveError.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">Your input has been preserved. You can try again.</p>
                    </div>
                  </div>
                </div>
              )}

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
                  disabled={isProcessing}
                  className="flex-1 h-12 border border-border rounded-xl flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-back"
                >
                  <ArrowLeft size={18} />
                  Back
                </button>
                <button
                  onClick={handleCreateStyle}
                  disabled={!name.trim() || isProcessing}
                  className={cn(
                    "flex-[2] h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all",
                    name.trim() && !isProcessing
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
                  ) : isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing...
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
