import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  draggable?: boolean;
  thumbSrc?: string;
  aspectRatio?: string;
  objectFit?: "cover" | "contain" | "fill";
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({ 
  src, 
  alt, 
  className, 
  draggable = true,
  thumbSrc,
  aspectRatio,
  objectFit = "cover",
  onLoad,
  onError
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  const handleThumbLoad = useCallback(() => {
    setThumbLoaded(true);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative overflow-hidden bg-muted",
        className
      )}
      style={{ aspectRatio }}
    >
      {!isLoaded && !hasError && (
        <div 
          className={cn(
            "absolute inset-0 bg-muted",
            "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
          )}
        />
      )}
      
      {isInView && thumbSrc && !isLoaded && !hasError && (
        <img
          src={thumbSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 w-full h-full",
            objectFit === "cover" && "object-cover",
            objectFit === "contain" && "object-contain",
            objectFit === "fill" && "object-fill",
            "blur-lg scale-105 transition-opacity duration-300",
            thumbLoaded ? "opacity-60" : "opacity-0"
          )}
          onLoad={handleThumbLoad}
        />
      )}
      
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "absolute inset-0 w-full h-full",
            objectFit === "cover" && "object-cover",
            objectFit === "contain" && "object-contain",
            objectFit === "fill" && "object-fill",
            "transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={handleLoad}
          onError={handleError}
          draggable={draggable}
          loading="lazy"
          decoding="async"
        />
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          <svg 
            className="w-8 h-8 opacity-50" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export function OptimizedImage({
  imageId,
  alt,
  size = "medium",
  className,
  aspectRatio,
}: {
  imageId: string;
  alt: string;
  size?: "thumb" | "medium" | "full";
  className?: string;
  aspectRatio?: string;
}) {
  const src = `/api/images/${imageId}?size=${size}`;
  const thumbSrc = size !== "thumb" ? `/api/images/${imageId}?size=thumb` : undefined;

  return (
    <LazyImage
      src={src}
      thumbSrc={thumbSrc}
      alt={alt}
      className={className}
      aspectRatio={aspectRatio}
    />
  );
}
