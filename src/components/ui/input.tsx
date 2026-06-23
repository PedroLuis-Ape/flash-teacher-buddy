import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, placeholder, autoComplete, spellCheck, ...props }, ref) => {
    const isSearch = type === "search" || String(placeholder ?? "").toLocaleLowerCase().startsWith("buscar");
    return (
      <input
        type={type ?? (isSearch ? "search" : undefined)}
        placeholder={placeholder}
        autoComplete={autoComplete ?? (isSearch ? "off" : undefined)}
        spellCheck={spellCheck ?? (isSearch ? false : undefined)}
        enterKeyHint={isSearch ? "search" : undefined}
        data-live-search={isSearch ? "true" : undefined}
        className={cn(
          "flex h-12 sm:h-10 w-full rounded-md border border-input bg-background px-4 py-3 sm:px-3 sm:py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
