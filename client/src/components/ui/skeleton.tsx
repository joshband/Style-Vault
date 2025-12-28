import { cn } from "@/lib/utils"

function Skeleton({
  className,
  shimmer = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted relative overflow-hidden",
        shimmer && "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

function SkeletonText({ 
  lines = 1, 
  className,
  lastLineWidth = "75%"
}: { 
  lines?: number; 
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-4" 
          style={{ width: i === lines - 1 ? lastLineWidth : "100%" }}
        />
      ))}
    </div>
  )
}

function SkeletonCircle({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Skeleton 
      className={cn("rounded-full", className)} 
      style={{ width: size, height: size }}
    />
  )
}

function SkeletonImage({ aspectRatio = "16/10", className }: { aspectRatio?: string; className?: string }) {
  return (
    <Skeleton 
      className={cn("w-full", className)} 
      style={{ aspectRatio }}
    />
  )
}

export { Skeleton, SkeletonText, SkeletonCircle, SkeletonImage }
