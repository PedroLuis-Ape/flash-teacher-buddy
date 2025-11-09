import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ApeSectionTitleProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function ApeSectionTitle({ children, className, action }: ApeSectionTitleProps) {
  return (
    <div className={cn("flex items-center justify-between mb-3", className)}>
      <h2 className="text-base font-semibold">
        {children}
      </h2>
      {action}
    </div>
  );
}
