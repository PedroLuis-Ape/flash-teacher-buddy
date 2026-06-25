import { BarChart3, Plus, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function TeacherClassNavigation() {
  const navigate = useNavigate();
  const { turmaId } = useParams<{ turmaId: string }>();

  return (
    <div className="mx-auto max-w-6xl px-3 pt-3 sm:px-4 sm:pt-4 lg:px-8">
      <Card className="flex flex-col gap-3 border-primary/20 bg-primary/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <p className="font-semibold">Gerenciamento de turmas</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Acesse a turma, veja o tráfego ou crie outra sem apagar a atual.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate('/turmas/professor')}>
            <Users className="mr-2 h-4 w-4" />Minhas turmas
          </Button>
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            disabled={!turmaId}
            onClick={() => {
              if (turmaId) navigate(`/turmas/${turmaId}?tab=trafego`);
            }}
          >
            <BarChart3 className="mr-2 h-4 w-4" />Tráfego
          </Button>
          <Button className="col-span-2 w-full sm:w-auto" onClick={() => navigate('/turmas/professor?create=1')}>
            <Plus className="mr-2 h-4 w-4" />Nova turma
          </Button>
        </div>
      </Card>
    </div>
  );
}
