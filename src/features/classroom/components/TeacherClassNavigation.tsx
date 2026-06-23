import { Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function TeacherClassNavigation() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 lg:px-8">
      <Card className="flex flex-col gap-3 border-primary/20 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Gerenciamento de turmas</p>
          <p className="text-sm text-muted-foreground">
            Esta é uma turma independente. Você pode voltar à lista ou criar outra sem apagar a atual.
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:shrink-0">
          <Button variant="outline" onClick={() => navigate('/turmas/professor')}>
            <Users className="mr-2 h-4 w-4" />Minhas turmas
          </Button>
          <Button onClick={() => navigate('/turmas/professor?create=1')}>
            <Plus className="mr-2 h-4 w-4" />Nova turma
          </Button>
        </div>
      </Card>
    </div>
  );
}
