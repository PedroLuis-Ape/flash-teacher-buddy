import { FileSpreadsheet, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ClassroomSuperImportLaunchCardProps {
  turmaId: string;
}

export function ClassroomSuperImportLaunchCard({ turmaId }: ClassroomSuperImportLaunchCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="mx-auto mt-3 max-w-6xl border-emerald-500/20 bg-emerald-500/[0.045] p-4 lg:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            Super Importador da turma
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Importe um lote com várias pastas, listas, glossários, camadas, explicações e centenas de cards em uma única transação.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => navigate(`/turmas/${turmaId}/import/super`)}
          className="w-full gap-2 sm:w-auto sm:min-w-56"
        >
          <FileSpreadsheet className="h-5 w-5" />
          Super importar lote
        </Button>
      </div>
    </Card>
  );
}
