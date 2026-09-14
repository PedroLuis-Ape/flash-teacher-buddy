import { Copy } from "lucide-react";
import type { MouseEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ReferenceIdControlProps {
  entityLabel: "pasta" | "lista";
  referenceId?: string | null;
}

export function ReferenceIdControl({ entityLabel, referenceId }: ReferenceIdControlProps) {
  if (!referenceId) return null;

  const copyReference = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(referenceId);
      toast.success(`Referência da ${entityLabel} copiada.`);
    } catch {
      toast.error("Não foi possível copiar a referência.");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 max-w-full gap-1.5 rounded-md px-2 font-mono text-[11px] font-medium text-muted-foreground hover:text-foreground"
      aria-label={`Copiar referência da ${entityLabel} ${referenceId}`}
      title={`Copiar ${referenceId}`}
      onClick={copyReference}
    >
      <span className="truncate">{referenceId}</span>
      <Copy aria-hidden className="h-3.5 w-3.5 shrink-0" />
    </Button>
  );
}
