import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ApeSectionTitleProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function ApeSectionTitle({ children, className, action }: ApeSectionTitleProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <h2 className="text-lg font-semibold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  );
}
