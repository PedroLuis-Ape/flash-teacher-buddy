import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ApeBadgeProps {
  children: ReactNode;
  variant?: "default" | "primary" | "secondary" | "success" | "warning";
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function ApeBadge({ 
  children, 
  variant = "default",
  size = "sm",
  className 
}: ApeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        // Sizes
        size === "xs" && "px-2 py-0.5 text-[10px]",
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3 py-1.5 text-sm",
        // Variants
        variant === "default" && "bg-muted text-muted-foreground",
        variant === "primary" && "bg-primary/10 text-primary",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "success" && "bg-success/10 text-success",
        variant === "warning" && "bg-warning/10 text-warning",
        className
      )}
    >
      {children}
    </span>
  );
}
