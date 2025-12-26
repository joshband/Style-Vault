import { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { compressImage } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { 
  Upload, 
  X, 
  Loader2, 
  ArrowLeft, 
  ImagePlus, 
  CheckCircle2, 
  AlertCircle,
  Layers
} from "lucide-react";

interface QueuedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
  styleId?: string;
}

interface BatchStatus {
  id: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  status: "queued" | "running" | "succeeded" | "failed";
}

export default function BatchUpload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [images, setImages] = useState<QueuedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const currentCount = images.length;
    const maxTotal = 10;
    const remaining = maxTotal - currentCount;

    if (remaining <= 0) {
      toast({
        title: "Maximum reached",
        description: "You can upload up to 10 images per batch",
        variant: "destructive",
      });
      return;
    }

    const filesToAdd = Array.from(files).slice(0, remaining);
    
    const newImages: QueuedImage[] = [];
    for (const file of filesToAdd) {
      if (!file.type.startsWith("image/")) continue;
      
      const compressed = await compressImage(file);
      newImages.push({
        id: crypto.randomUUID(),
        file,
        preview: compressed,
        name: file.name.replace(/\.[^/.]+$/, ""),
        status: "pending",
      });
    }

    setImages((prev) => [...prev, ...newImages]);
  }, [images.length, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const startBatchProcessing = async () => {
    if (images.length === 0) return;
    
    setIsProcessing(true);

    try {
      const imageData = images.map((img) => ({
        id: img.id,
        name: img.name,
        imageBase64: img.preview,
      }));

      const response = await fetch("/api/batch/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imageData }),
      });

      if (!response.ok) {
        throw new Error("Failed to start batch processing");
      }

      const { batchId } = await response.json();
      
      setBatchStatus({
        id: batchId,
        totalItems: images.length,
        completedItems: 0,
        failedItems: 0,
        status: "running",
      });

      pollBatchStatus(batchId);

    } catch (error) {
      toast({
        title: "Batch processing failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const pollBatchStatus = async (batchId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/batch/${batchId}`);
        if (!response.ok) throw new Error("Failed to fetch batch status");
        
        const status: BatchStatus = await response.json();
        setBatchStatus(status);

        setImages((prev) => 
          prev.map((img) => {
            const jobStatus = (status as any).jobs?.find((j: any) => j.input?.imageId === img.id);
            if (jobStatus) {
              return {
                ...img,
                status: jobStatus.status === "succeeded" ? "success" 
                      : jobStatus.status === "failed" ? "error" 
                      : jobStatus.status === "running" ? "processing"
                      : "pending",
                error: jobStatus.error,
                styleId: jobStatus.styleId,
              };
            }
            return img;
          })
        );

        if (status.status === "running" || status.status === "queued") {
          setTimeout(poll, 2000);
        } else {
          setIsProcessing(false);
          if (status.status === "succeeded") {
            toast({
              title: "Batch complete!",
              description: `Created ${status.completedItems} styles successfully`,
            });
          } else if (status.failedItems > 0) {
            toast({
              title: "Batch completed with errors",
              description: `${status.completedItems} succeeded, ${status.failedItems} failed`,
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  const progress = batchStatus 
    ? Math.round(((batchStatus.completedItems + batchStatus.failedItems) / batchStatus.totalItems) * 100)
    : 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-4">
          <Link 
            href="/create" 
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono"
          >
            <ArrowLeft size={12} /> Back to Author
          </Link>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Layers className="text-primary" size={28} />
              <h1 className="text-3xl font-serif font-medium text-foreground">Batch Upload</h1>
            </div>
            <p className="text-muted-foreground text-lg font-light leading-relaxed max-w-2xl">
              Upload up to 10 images to create styles from each one. They'll process in the background so you can continue working.
            </p>
          </div>
        </div>

        {!isProcessing && !batchStatus && (
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-all",
              images.length === 0 
                ? "border-muted-foreground/20 hover:border-primary/50 bg-muted/30"
                : "border-primary/30 bg-primary/5"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            data-testid="batch-drop-zone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
              data-testid="batch-file-input"
            />

            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ImagePlus className="text-muted-foreground" size={28} />
              </div>
              <div>
                <p className="text-foreground font-medium">
                  Drop images here or{" "}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary underline hover:no-underline"
                    data-testid="button-browse-files"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Up to 10 images. Each becomes its own style.
                </p>
              </div>
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {images.length} Image{images.length !== 1 ? "s" : ""} Queued
              </h2>
              {!isProcessing && !batchStatus && (
                <Button
                  onClick={startBatchProcessing}
                  disabled={images.length === 0}
                  data-testid="button-start-batch"
                >
                  <Upload size={16} className="mr-2" />
                  Process All
                </Button>
              )}
            </div>

            {batchStatus && (
              <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {batchStatus.status === "running" ? "Processing..." : "Complete"}
                  </span>
                  <span className="font-mono">
                    {batchStatus.completedItems + batchStatus.failedItems} / {batchStatus.totalItems}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {images.map((img) => (
                <div 
                  key={img.id} 
                  className={cn(
                    "relative group rounded-lg overflow-hidden border aspect-square",
                    img.status === "success" && "border-green-500",
                    img.status === "error" && "border-red-500",
                    img.status === "processing" && "border-primary animate-pulse",
                    img.status === "pending" && "border-border"
                  )}
                  data-testid={`batch-image-${img.id}`}
                >
                  <img
                    src={img.preview}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-xs truncate">{img.name}</p>
                  </div>

                  {img.status === "pending" && !isProcessing && (
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                      data-testid={`button-remove-${img.id}`}
                    >
                      <X size={14} />
                    </button>
                  )}

                  {img.status === "processing" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="text-white animate-spin" size={24} />
                    </div>
                  )}

                  {img.status === "success" && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="text-green-500" size={20} />
                    </div>
                  )}

                  {img.status === "error" && (
                    <div className="absolute top-2 right-2" title={img.error}>
                      <AlertCircle className="text-red-500" size={20} />
                    </div>
                  )}

                  {img.status === "success" && img.styleId && (
                    <Link
                      href={`/style/${img.styleId}`}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="text-white text-sm font-medium">View Style</span>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {batchStatus?.status === "succeeded" && (
          <div className="flex justify-center pt-4">
            <Button onClick={() => setLocation("/")} data-testid="button-view-vault">
              View All Styles in Vault
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
