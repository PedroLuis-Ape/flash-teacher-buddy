import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ 
  className, 
  message = "Carregando...",
  size = "md" 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };

  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="text-center space-y-3">
        <Loader2 className={cn("animate-spin text-primary mx-auto", sizeClasses[size])} />
        {message && <p className="text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
