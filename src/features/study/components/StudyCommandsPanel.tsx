import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { keyLabel } from "@/features/study/lib/keyboardShortcuts";
import { useShortcutMap } from "@/hooks/useKeyboardShortcuts";
import {
  resolveStudyCommands,
  type StudyCommandContext,
} from "@/features/study/lib/studyCommandRegistry";

/**
 * Painel "Comandos". Renderiza EXATAMENTE a lista resolvida pela registry de
 * capacidades — a mesma consultada pelo roteador de teclado. Se um comando não
 * aparece aqui, ele também não executa.
 */
export function StudyCommandsPanel({ context }: { context: StudyCommandContext }) {
  const shortcuts = useShortcutMap();
  const commands = resolveStudyCommands(context);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-full px-3 text-xs"
          aria-label="Comandos disponíveis"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span>Comandos</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 max-w-[92vw] p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Comandos deste modo
        </p>
        <ul className="space-y-1.5" data-testid="study-commands-list">
          {commands.map((command) => (
            <li key={command.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="leading-snug">{command.label}</span>
              <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {keyLabel(shortcuts[command.id])}
              </kbd>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default StudyCommandsPanel;
