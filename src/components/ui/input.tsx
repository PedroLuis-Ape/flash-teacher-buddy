import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, placeholder, autoComplete, spellCheck, title, ...props }, ref) => {
    const placeholderText = String(placeholder ?? "");
    const isSearch = type === "search" || placeholderText.toLocaleLowerCase().startsWith("buscar");
    const resolvedPlaceholder = placeholderText === "Buscar card..."
      ? "Buscar card — filtra enquanto digita"
      : placeholderText === "Buscar lista..."
        ? "Buscar lista — filtra enquanto digita"
        : placeholder;

    return (
      <input
        type={type ?? (isSearch ? "search" : undefined)}
        placeholder={resolvedPlaceholder}
        autoComplete={autoComplete ?? (isSearch ? "off" : undefined)}
        spellCheck={spellCheck ?? (isSearch ? false : undefined)}
        enterKeyHint={isSearch ? "search" : undefined}
        data-live-search={isSearch ? "true" : undefined}
        title={title ?? (isSearch ? "A busca é instantânea; não precisa apertar Enter." : undefined)}
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
