import { cn } from "@/lib/utils";

interface StyleCardSkeletonProps {
  className?: string;
}

export function StyleCardSkeleton({ className }: StyleCardSkeletonProps) {
  return (
    <div className={cn(
      "flex flex-col bg-card border border-border rounded-lg overflow-hidden",
      className
    )}>
      {/* Image placeholder - matches 16/10 aspect ratio */}
      <div className="aspect-[16/10] bg-muted animate-pulse" />
      
      {/* Content area */}
      <div className="p-4 flex flex-col gap-2">
        {/* Title line */}
        <div className="h-5 w-2/3 bg-muted rounded animate-pulse" />
        
        {/* Summary lines */}
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
        <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
        
        {/* Date */}
        <div className="h-3 w-24 bg-muted rounded animate-pulse mt-1" />
      </div>
    </div>
  );
}
