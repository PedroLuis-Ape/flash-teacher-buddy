import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Library, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateClassFolder } from '@/features/classroom/hooks/useClassFolders';

interface ClassroomContentToolbarProps {
  turmaId: string;
}

export function ClassroomContentToolbar({ turmaId }: ClassroomContentToolbarProps) {
  const navigate = useNavigate();
  const createFolder = useCreateClassFolder();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Digite o nome da pasta.');
      return;
    }

    try {
      const result = await createFolder.mutateAsync({
        turmaId,
        title,
        description,
      });

      toast.success('Pasta criada exclusivamente nesta turma.');
      setOpen(false);
      reset();
      navigate(`/folder/${result.folder_id}?turma=${turmaId}`);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar a pasta da turma.');
    }
  };

  return (
    <>
      <Card className="mx-auto mt-4 max-w-6xl border-primary/20 bg-primary/[0.035] p-4 lg:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              <LockKeyhole className="h-5 w-5 text-primary" />
              Biblioteca exclusiva da turma
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Pastas criadas aqui ficam isoladas da sua biblioteca pessoal. A visibilidade acompanha somente a turma.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const assignments = document.querySelector('[data-classroom-assignments]');
                assignments?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="sm:min-w-48"
            >
              <Library className="h-5 w-5" />
              Ver conteúdos da turma
            </Button>
            <Button
              type="button"
              onClick={() => setOpen(true)}
              className="sm:min-w-52"
            >
              <FolderPlus className="h-5 w-5" />
              Nova pasta da turma
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen && !createFolder.isPending) reset();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar pasta nesta turma</DialogTitle>
            <DialogDescription>
              Esta pasta será criada e editada somente dentro da turma. Tornar a turma pública ou privada controla todo o conteúdo dela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="class-folder-title">Nome da pasta</Label>
              <Input
                id="class-folder-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Verbo To Be — Etapas"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleCreate();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-folder-description">Descrição opcional</Label>
              <Textarea
                id="class-folder-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Explique a sequência ou o objetivo desta pasta."
                rows={3}
              />
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              A pasta não aparecerá na biblioteca pessoal nem terá uma configuração pública/privada própria.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createFolder.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={createFolder.isPending || !title.trim()}
            >
              {createFolder.isPending ? 'Criando...' : 'Criar e abrir pasta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
