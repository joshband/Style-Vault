import { cn } from "@/lib/utils";

interface StyleCardSkeletonProps {
  className?: string;
}

export function StyleCardSkeleton({ className }: StyleCardSkeletonProps) {
  return (
    <div className={cn("flex flex-col bg-card border border-border rounded-lg overflow-hidden", className)}>
      <div className="aspect-[12/4] bg-muted animate-pulse" />
      <div className="p-4 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-10 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          <div className="h-4 w-12 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
