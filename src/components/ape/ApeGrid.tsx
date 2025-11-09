import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ApeGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    md?: number;
    lg?: number;
  };
}

export function ApeGrid({ 
  children, 
  className,
  cols = { default: 1, md: 2, lg: 3 }
}: ApeGridProps) {
  return (
    <div 
      className={cn(
        "grid gap-3",
        cols.default === 1 && "grid-cols-1",
        cols.default === 2 && "grid-cols-2",
        cols.md === 2 && "md:grid-cols-2",
        cols.md === 3 && "md:grid-cols-3",
        cols.lg === 3 && "lg:grid-cols-3",
        cols.lg === 4 && "lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
