import { FolderArchive } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { FolderExportDialog } from '@/features/export/FolderExportDialog';
import { useAtribuicoesByTurma } from '@/features/classroom/hooks/useAtribuicoes';

interface ClassroomFolderExportPanelProps {
  turmaId: string;
}

export function ClassroomFolderExportPanel({ turmaId }: ClassroomFolderExportPanelProps) {
  const { data, isLoading } = useAtribuicoesByTurma(turmaId);
  const folderAssignments = (data?.atribuicoes ?? []).filter(
    (assignment: any) => assignment?.fonte_tipo === 'pasta' && assignment?.fonte_id,
  );
  const sources = Array.from(
    new Map(
      folderAssignments.map((assignment: any) => [
        assignment.fonte_id,
        { id: assignment.fonte_id as string, title: assignment.titulo as string },
      ]),
    ).values(),
  );

  if (isLoading || sources.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 lg:px-8">
      <Card className="flex flex-col gap-4 border-primary/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FolderArchive className="h-5 w-5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Exportar pastas da turma</p>
            <p className="text-sm text-muted-foreground">
              Reúna {sources.length} {sources.length === 1 ? 'pasta atribuída' : 'pastas atribuídas'} em um único TXT ou JSON compatível com o Super Importador.
            </p>
          </div>
        </div>
        <FolderExportDialog
          sources={sources}
          packageName="Pastas atribuídas da turma"
          label={sources.length === 1 ? 'Exportar pasta' : `Exportar ${sources.length} pastas`}
          variant="default"
          className="min-h-[44px] shrink-0"
        />
      </Card>
    </div>
  );
}
