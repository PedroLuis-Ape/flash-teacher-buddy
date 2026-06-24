import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";

export function BulkGlossaryImportPanel() {
  return (
    <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4">
      <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p className="font-medium">Glossário organizado por pasta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O glossário não é mais salvo em uma caixa global. Depois da importação,
          abra a pasta de destino para importar, mesclar, substituir, editar ou
          exportar o glossário compartilhado pelas listas daquela pasta.
        </p>
      </div>
    </Card>
  );
}
