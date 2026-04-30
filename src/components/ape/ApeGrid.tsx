import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ApeGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    ["2xl"]?: number;
  };
}

// Static class maps so Tailwind can statically detect the classes.
// Keep this list in sync with usage across the app — adding a new value
// here is safe; removing one could break existing call sites.
const DEFAULT_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};
const SM_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};
const MD_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};
const LG_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};
const XL_COLS: Record<number, string> = {
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};
const XXL_COLS: Record<number, string> = {
  4: "2xl:grid-cols-4",
  5: "2xl:grid-cols-5",
  6: "2xl:grid-cols-6",
};

export function ApeGrid({ 
  children, 
  className,
  cols = { default: 1, md: 2, lg: 3 }
}: ApeGridProps) {
  return (
    <div 
      className={cn(
        "grid gap-3",
        cols.default && DEFAULT_COLS[cols.default],
        cols.sm && SM_COLS[cols.sm],
        cols.md && MD_COLS[cols.md],
        cols.lg && LG_COLS[cols.lg],
        cols.xl && XL_COLS[cols.xl],
        cols["2xl"] && XXL_COLS[cols["2xl"]],
        className
      )}
    >
      {children}
    </div>
  );
}
