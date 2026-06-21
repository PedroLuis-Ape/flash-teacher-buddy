import { usePalette } from '@/hooks/usePalette';
import { PALETTES, type PaletteId } from '@/lib/palettes';
import { cn } from '@/lib/utils';

interface PublicThemeToggleProps {
  className?: string;
}

export function PublicThemeToggle({ className }: PublicThemeToggleProps) {
  const { palette, setPalette } = usePalette();

  return (
    <label className={cn('relative shrink-0', className)} title="Alterar layout">
      <span className="sr-only">Alterar layout</span>
      <select
        value={palette}
        onChange={(event) => setPalette(event.target.value as PaletteId)}
        aria-label="Alterar layout do aplicativo"
        className="h-9 w-[76px] rounded-lg border border-border/70 bg-background px-1.5 text-[11px] font-medium text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-[92px] sm:px-2 sm:text-xs"
      >
        {PALETTES.map((item) => (
          <option key={item.id} value={item.id}>{item.shortName}</option>
        ))}
      </select>
    </label>
  );
}
