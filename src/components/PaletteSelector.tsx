import { Check, Palette, Sparkles } from "lucide-react";
import { usePalette } from "@/hooks/usePalette";
import { PaletteId, PALETTES } from "@/lib/palettes";
import { usePerformance } from "@/contexts/PerformanceContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaletteSelectorProps {
  compact?: boolean;
  className?: string;
}

export function PaletteSelector({ compact = false, className }: PaletteSelectorProps) {
  const { palette, setPalette } = usePalette();
  const { settings, setGalaxyQuality } = usePerformance();

  const handleChange = (id: PaletteId, name: string) => {
    if (id === palette) return;
    setPalette(id);
    toast.success(`Paleta alterada para ${name}`);
  };

  const handleGalaxyQuality = (quality: "standard" | "high") => {
    if (settings.galaxyQuality === quality) return;
    setGalaxyQuality(quality);
    toast.success(quality === "high" ? "Galáxia em alta nitidez" : "Galáxia no modo padrão");
  };

  return (
    <div className={cn("space-y-3", className)}>
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
                "group relative flex min-h-[64px] flex-col items-center gap-1.5 rounded-lg border p-2 text-left transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              <div className="flex h-5 w-full overflow-hidden rounded-md border border-border/50">
                {p.swatch.map((hsl, index) => (
                  <div key={index} className="flex-1" style={{ backgroundColor: `hsl(${hsl})` }} />
                ))}
              </div>
              <span className="text-center text-[11px] font-medium leading-tight">{p.shortName}</span>
              {active && (
                <span className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {palette === "galaxy" && (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">Qualidade da galáxia</div>
              <div className="text-[11px] text-muted-foreground">Alta reforça nebulosa, estrelas e chuva de meteoros.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["standard", "high"] as const).map((quality) => {
              const active = settings.galaxyQuality === quality;
              return (
                <button
                  key={quality}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleGalaxyQuality(quality)}
                  className={cn(
                    "min-h-10 rounded-md border px-3 text-xs font-medium transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {quality === "high" ? "Alta" : "Padrão"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
