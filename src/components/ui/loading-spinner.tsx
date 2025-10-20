import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  message?: string;
}

export function LoadingSpinner({ className, message = "Carregando..." }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
