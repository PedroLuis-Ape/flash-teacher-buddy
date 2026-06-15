import { Check, Palette } from "lucide-react";
import { usePalette } from "@/hooks/usePalette";
import { PaletteId, PALETTES } from "@/lib/palettes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaletteSelectorProps {
  /** Compact = no title/description, just the buttons row */
  compact?: boolean;
  className?: string;
}

export function PaletteSelector({ compact = false, className }: PaletteSelectorProps) {
  const { palette, setPalette } = usePalette();

  const handleChange = (id: PaletteId, name: string) => {
    if (id === palette) return;
    setPalette(id);
    toast.success(`Paleta alterada para ${name}`);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {!compact && (
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Layout do aplicativo</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PALETTES.map((p) => {
          const active = p.id === palette;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleChange(p.id, p.name)}
              aria-pressed={active}
              aria-label={`Aplicar paleta ${p.name}`}
              className={cn(
                "group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-left transition-all",
                "min-h-[64px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              <div className="flex h-5 w-full overflow-hidden rounded-md border border-border/50">
                {p.swatch.map((hsl, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: `hsl(${hsl})` }}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium leading-tight text-center">
                {p.shortName}
              </span>
              {active && (
                <span className="absolute top-1 right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
