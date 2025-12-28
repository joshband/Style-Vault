import { cn } from "@/lib/utils";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

interface StyleCardSkeletonProps {
  className?: string;
}

export function StyleCardSkeleton({ className }: StyleCardSkeletonProps) {
  return (
    <div className={cn(
      "flex flex-col bg-card border border-border rounded-lg overflow-hidden",
      className
    )}>
      <Skeleton className="aspect-[16/10] rounded-none" />
      
      <div className="p-4 flex flex-col gap-2">
        <Skeleton className="h-5 w-2/3" />
        <SkeletonText lines={2} lastLineWidth="80%" />
        <Skeleton className="h-3 w-24 mt-1" />
      </div>
    </div>
  );
}

export function StyleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div 
      className="grid gap-6"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StyleCardSkeleton key={i} className={cn(
          i >= 4 && "hidden lg:block",
          i >= 3 && i < 4 && "hidden md:block",
          i >= 2 && i < 3 && "hidden sm:block"
        )} />
      ))}
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skeleton className="aspect-square rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <SkeletonText lines={3} />
          <div className="flex gap-2 mt-6">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
      <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="w-20 h-8" />
    </div>
  );
}
