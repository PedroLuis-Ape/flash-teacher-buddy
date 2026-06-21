import { Palette } from 'lucide-react';
import { PaletteSelector } from '@/components/PaletteSelector';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePalette } from '@/hooks/usePalette';
import { PALETTES } from '@/lib/palettes';
import { cn } from '@/lib/utils';

interface PublicThemeToggleProps {
  className?: string;
}

export function PublicThemeToggle({ className }: PublicThemeToggleProps) {
  const { palette } = usePalette();
  const activePalette = PALETTES.find((item) => item.id === palette) ?? PALETTES[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            'relative h-9 w-9 shrink-0 rounded-lg border-border/70 bg-background/80',
            className,
          )}
          aria-label={`Alterar layout. Atual: ${activePalette.name}`}
          title={`Alterar layout — ${activePalette.shortName}`}
        >
          <Palette className="h-4 w-4" />
          <span
            aria-hidden="true"
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full border border-background shadow-sm"
            style={{ backgroundColor: `hsl(${activePalette.swatch[1]})` }}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1rem))] p-3"
      >
        <PaletteSelector />
      </PopoverContent>
    </Popover>
  );
}
