import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, FolderOpen, FolderPlus, Library, LockKeyhole } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCreateAtribuicao } from '@/features/classroom/hooks/useAtribuicoes';
import { useCreateClassFolder } from '@/features/classroom/hooks/useClassFolders';

interface ClassroomContentToolbarProps {
  turmaId: string;
}

type SourceType = 'pasta' | 'lista';

interface LibrarySource {
  id: string;
  title: string;
  description: string | null;
  folder_id?: string;
}

export function ClassroomContentToolbar({ turmaId }: ClassroomContentToolbarProps) {
  const navigate = useNavigate();
  const createFolder = useCreateClassFolder();
  const importAssignment = useCreateAtribuicao();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('pasta');
  const [sourceId, setSourceId] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importDescription, setImportDescription] = useState('');

  const libraryQuery = useQuery({
    queryKey: ['classroom-library-sources', importOpen],
    enabled: importOpen,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login para acessar sua biblioteca.');

      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('id, title, description')
        .eq('owner_id', user.id)
        .is('class_id', null)
        .is('deleted_at', null)
        .order('title', { ascending: true });

      if (foldersError) throw foldersError;

      const folderIds = (folders || []).map((folder) => folder.id);
      let lists: LibrarySource[] = [];

      if (folderIds.length > 0) {
        const { data: listRows, error: listsError } = await supabase
          .from('lists')
          .select('id, title, description, folder_id')
          .eq('owner_id', user.id)
          .is('class_id', null)
          .is('deleted_at', null)
          .in('folder_id', folderIds)
          .order('title', { ascending: true });

        if (listsError) throw listsError;
        lists = (listRows || []) as LibrarySource[];
      }

      return {
        folders: (folders || []) as LibrarySource[],
        lists,
      };
    },
  });

  const sourceOptions = useMemo(
    () => sourceType === 'pasta'
      ? libraryQuery.data?.folders || []
      : libraryQuery.data?.lists || [],
    [libraryQuery.data, sourceType],
  );

  const resetCreate = () => {
    setTitle('');
    setDescription('');
  };

  const resetImport = () => {
    setSourceType('pasta');
    setSourceId('');
    setImportTitle('');
    setImportDescription('');
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
      setCreateOpen(false);
      resetCreate();
      navigate(`/folder/${result.folder_id}?turma=${turmaId}`);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar a pasta da turma.');
    }
  };

  const handleSourceChange = (nextId: string) => {
    setSourceId(nextId);
    const selected = sourceOptions.find((item) => item.id === nextId);
    if (selected) {
      setImportTitle(selected.title);
      setImportDescription(selected.description || '');
    }
  };

  const handleImport = async () => {
    if (!sourceId) {
      toast.error('Escolha uma pasta ou lista da sua biblioteca.');
      return;
    }

    const selected = sourceOptions.find((item) => item.id === sourceId);
    const finalTitle = importTitle.trim() || selected?.title || '';
    if (!finalTitle) {
      toast.error('Digite um título para o conteúdo da turma.');
      return;
    }

    try {
      await importAssignment.mutateAsync({
        turma_id: turmaId,
        titulo: finalTitle,
        descricao: importDescription.trim() || undefined,
        fonte_tipo: sourceType,
        fonte_id: sourceId,
        pontos_vale: 50,
      });

      toast.success('Cópia isolada adicionada à turma.');
      setImportOpen(false);
      resetImport();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível importar o conteúdo.');
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
              Crie conteúdo diretamente aqui ou importe uma cópia da biblioteca pessoal. A visibilidade acompanha somente a turma.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="sm:min-w-52"
            >
              <Library className="h-5 w-5" />
              Importar da biblioteca
            </Button>
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="sm:min-w-52"
            >
              <FolderPlus className="h-5 w-5" />
              Nova pasta da turma
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);
          if (!nextOpen && !createFolder.isPending) resetCreate();
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
              onClick={() => setCreateOpen(false)}
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

      <Dialog
        open={importOpen}
        onOpenChange={(nextOpen) => {
          setImportOpen(nextOpen);
          if (!nextOpen && !importAssignment.isPending) resetImport();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar da biblioteca pessoal</DialogTitle>
            <DialogDescription>
              O aplicativo cria uma cópia independente dentro da turma. Alterações futuras não afetam o conteúdo original.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de conteúdo</Label>
              <Select
                value={sourceType}
                onValueChange={(value: SourceType) => {
                  setSourceType(value);
                  setSourceId('');
                  setImportTitle('');
                  setImportDescription('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pasta">Pasta completa</SelectItem>
                  <SelectItem value="lista">Lista individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conteúdo da biblioteca</Label>
              <Select value={sourceId} onValueChange={handleSourceChange}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={libraryQuery.isLoading
                      ? 'Carregando biblioteca...'
                      : `Escolha ${sourceType === 'pasta' ? 'uma pasta' : 'uma lista'}`}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum conteúdo pessoal disponível para importar.
                    </div>
                  ) : sourceOptions.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      <span className="flex items-center gap-2">
                        {sourceType === 'pasta'
                          ? <FolderOpen className="h-4 w-4" />
                          : <BookOpen className="h-4 w-4" />}
                        {source.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {libraryQuery.error && (
                <p className="text-sm text-destructive">
                  Não foi possível carregar a biblioteca.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-import-title">Título dentro da turma</Label>
              <Input
                id="class-import-title"
                value={importTitle}
                onChange={(event) => setImportTitle(event.target.value)}
                placeholder="Nome exibido para os alunos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-import-description">Descrição opcional</Label>
              <Textarea
                id="class-import-description"
                value={importDescription}
                onChange={(event) => setImportDescription(event.target.value)}
                rows={3}
              />
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              Pastas pessoais públicas e privadas podem ser copiadas. A cópia passa a obedecer exclusivamente à visibilidade da turma.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={importAssignment.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleImport()}
              disabled={importAssignment.isPending || !sourceId}
            >
              {importAssignment.isPending ? 'Importando...' : 'Importar cópia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
