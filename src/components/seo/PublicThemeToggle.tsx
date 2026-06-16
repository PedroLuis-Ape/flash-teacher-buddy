import { Sparkles, SwatchBook } from 'lucide-react';
import { usePalette } from '@/hooks/usePalette';
import { cn } from '@/lib/utils';

interface PublicThemeToggleProps {
  className?: string;
}

export function PublicThemeToggle({ className }: PublicThemeToggleProps) {
  const { palette, setPalette } = usePalette();

  return (
    <div
      role="group"
      aria-label="Escolher tema visual"
      className={cn('inline-flex items-center rounded-lg border border-border/70 bg-background/70 p-1', className)}
    >
      <button
        type="button"
        aria-pressed={palette === 'black'}
        aria-label="Usar tema roxo padrão"
        title="Tema roxo padrão"
        onClick={() => setPalette('black')}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          palette === 'black'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <SwatchBook className="h-4 w-4" />
        <span className="hidden xl:inline">Roxo</span>
      </button>
      <button
        type="button"
        aria-pressed={palette === 'galaxy'}
        aria-label="Usar tema galáxia"
        title="Tema galáxia"
        onClick={() => setPalette('galaxy')}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          palette === 'galaxy'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden xl:inline">Galáxia</span>
      </button>
    </div>
  );
}
