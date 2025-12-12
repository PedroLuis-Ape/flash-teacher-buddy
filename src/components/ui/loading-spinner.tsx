import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingSpinnerProps {
  className?: string;
  message?: string;
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "skeleton";
}

export function LoadingSpinner({ 
  className, 
  message = "Carregando...",
  size = "md",
  variant = "spinner"
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };

  if (variant === "skeleton") {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-[60vh] p-8 animate-pulse", className)}>
        <div className="w-full max-w-md space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          
          {/* Content skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>
          
          {/* Footer text */}
          <p className="text-muted-foreground text-center text-sm">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="text-center space-y-3">
        <Loader2 className={cn("animate-spin text-primary mx-auto", sizeClasses[size])} />
        {message && <p className="text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
