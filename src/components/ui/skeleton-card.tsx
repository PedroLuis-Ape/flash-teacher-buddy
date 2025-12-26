import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface SkeletonCardProps {
  className?: string;
  variant?: "folder" | "list" | "default";
}

export function SkeletonCard({ className, variant = "default" }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl bg-card border border-border",
        "animate-pulse",
        className
      )}
    >
      {/* Icon placeholder */}
      <Skeleton className="w-11 h-11 rounded-lg shrink-0" />
      
      {/* Content */}
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      
      {/* Action button placeholder */}
      {variant === "list" && (
        <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
      )}
    </div>
  );
}

interface SkeletonGridProps {
  count?: number;
  variant?: "folder" | "list" | "default";
  className?: string;
}

export function SkeletonGrid({ count = 6, variant = "default", className }: SkeletonGridProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
}
