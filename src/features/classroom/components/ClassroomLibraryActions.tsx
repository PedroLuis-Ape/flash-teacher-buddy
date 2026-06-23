import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileSpreadsheet, FolderArchive, FolderPlus, Library, Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FolderExportDialog } from "@/features/export/FolderExportDialog";
import { FolderGlossarySyncDialog } from "@/features/study/components/FolderGlossarySyncDialog";
import { syncFolderGlossary } from "@/features/study/lib/folderGlossaryApi";
import { useAtribuicoesByTurma, useCreateAtribuicao } from "@/features/classroom/hooks/useAtribuicoes";
import { useCreateClassFolder } from "@/features/classroom/hooks/useClassFolders";
import { ACCOUNT_GLOSSARY_QUERY_KEY } from "@/hooks/useAccountGlossary";
import { supabase } from "@/integrations/supabase/client";

interface Props { turmaId: string }
type SourceType = "pasta" | "lista";
interface Source { id: string; title: string; description: string | null; folder_id?: string }

export function ClassroomLibraryActions({ turmaId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFolder = useCreateClassFolder();
  const importAssignment = useCreateAtribuicao();
  const { data: assignmentsData } = useAtribuicoesByTurma(turmaId);

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("pasta");
  const [sourceId, setSourceId] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importDescription, setImportDescription] = useState("");
  const [includeNormalCards, setIncludeNormalCards] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const libraryQuery = useQuery({
    queryKey: ["classroom-library-sources", importOpen],
    enabled: importOpen,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para acessar sua biblioteca.");
      const { data: folders, error: foldersError } = await supabase.from("folders").select("id, title, description").eq("owner_id", user.id).is("class_id", null).is("deleted_at", null).order("title");
      if (foldersError) throw foldersError;
      const folderIds = (folders ?? []).map((folder) => folder.id);
      let lists: Source[] = [];
      if (folderIds.length > 0) {
        const { data, error } = await supabase.from("lists").select("id, title, description, folder_id").eq("owner_id", user.id).is("class_id", null).is("deleted_at", null).in("folder_id", folderIds).order("title");
        if (error) throw error;
        lists = (data ?? []) as Source[];
      }
      return { folders: (folders ?? []) as Source[], lists };
    },
  });

  const options = sourceType === "pasta" ? libraryQuery.data?.folders ?? [] : libraryQuery.data?.lists ?? [];
  const folderSources = useMemo(() => {
    const rows = (assignmentsData?.atribuicoes ?? []).filter((item: any) => item?.fonte_tipo === "pasta" && item?.fonte_id);
    return Array.from(new Map<string, { id: string; title: string }>(rows.map((item: any) => [item.fonte_id, { id: item.fonte_id, title: item.titulo }])).values());
  }, [assignmentsData]);

  const create = async () => {
    if (!title.trim()) return toast.error("Digite o nome da pasta.");
    try {
      const result = await createFolder.mutateAsync({ turmaId, title, description });
      setCreateOpen(false); setTitle(""); setDescription("");
      toast.success("Pasta criada na turma.");
      navigate(`/folder/${result.folder_id}?turma=${turmaId}`);
    } catch (error: any) { toast.error(error?.message || "Não foi possível criar a pasta."); }
  };

  const importContent = async () => {
    const selected = options.find((item) => item.id === sourceId);
    if (!selected) return toast.error("Escolha uma pasta ou lista.");
    try {
      await importAssignment.mutateAsync({ turma_id: turmaId, titulo: importTitle.trim() || selected.title, descricao: importDescription.trim() || undefined, fonte_tipo: sourceType, fonte_id: sourceId, pontos_vale: 50 });
      setImportOpen(false); setSourceId(""); setImportTitle(""); setImportDescription("");
      toast.success("Conteúdo adicionado à turma.");
    } catch (error: any) { toast.error(error?.message || "Não foi possível importar o conteúdo."); }
  };

  const syncAll = async () => {
    if (folderSources.length === 0 || syncingAll) return;
    setSyncingAll(true);
    let inserted = 0; let skipped = 0; let failed = 0;
    for (const folder of folderSources) {
      try {
        const report = await syncFolderGlossary(folder.id, includeNormalCards);
        inserted += report.inserted; skipped += report.skipped;
      } catch { failed += 1; }
    }
    await queryClient.invalidateQueries({ queryKey: ACCOUNT_GLOSSARY_QUERY_KEY });
    setSyncingAll(false);
    if (failed) toast.error(`${failed} pasta(s) falharam. ${inserted} entrada(s) foram adicionadas nas demais.`);
    else toast.success(`Todas as pastas sincronizadas: ${inserted} nova(s), ${skipped} já existente(s).`);
  };

  return <>
    <Card className="mx-auto mt-4 max-w-6xl border-primary/20 bg-primary/[0.035] p-4 lg:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-semibold">Biblioteca da turma</p><p className="mt-1 text-sm text-muted-foreground">Crie, importe, exporte e sincronize o conteúdo em um único lugar.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setCreateOpen(true)}><FolderPlus className="mr-2 h-4 w-4" />Nova pasta</Button>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}><Library className="mr-2 h-4 w-4" />Importar</Button>
          <Button type="button" variant="outline" onClick={() => setMoreOpen(true)}><MoreHorizontal className="mr-2 h-4 w-4" />Mais ações</Button>
        </div>
      </div>
    </Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Nova pasta da turma</DialogTitle><DialogDescription>A pasta ficará isolada nesta turma.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Nome</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></div><div><Label>Descrição</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => void create()} disabled={createFolder.isPending || !title.trim()}>{createFolder.isPending ? "Criando..." : "Criar e abrir"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent><DialogHeader><DialogTitle>Importar da biblioteca pessoal</DialogTitle><DialogDescription>Será criada uma cópia independente na turma.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Tipo</Label><Select value={sourceType} onValueChange={(value: SourceType) => { setSourceType(value); setSourceId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pasta">Pasta completa</SelectItem><SelectItem value="lista">Lista individual</SelectItem></SelectContent></Select></div><div><Label>Conteúdo</Label><Select value={sourceId} onValueChange={(value) => { setSourceId(value); const selected = options.find((item) => item.id === value); if (selected) { setImportTitle(selected.title); setImportDescription(selected.description || ""); } }}><SelectTrigger><SelectValue placeholder="Escolha o conteúdo" /></SelectTrigger><SelectContent>{options.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></div><div><Label>Título na turma</Label><Input value={importTitle} onChange={(event) => setImportTitle(event.target.value)} /></div><div><Label>Descrição</Label><Textarea value={importDescription} onChange={(event) => setImportDescription(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button><Button onClick={() => void importContent()} disabled={importAssignment.isPending || !sourceId}>{importAssignment.isPending ? "Importando..." : "Importar"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={moreOpen} onOpenChange={setMoreOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Mais ações da biblioteca</DialogTitle><DialogDescription>Ferramentas menos frequentes ficam organizadas aqui.</DialogDescription></DialogHeader><div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => navigate(`/turmas/${turmaId}/import/super`)}><FileSpreadsheet className="mr-2 h-4 w-4" />Super Importador</Button><Button variant="outline" onClick={() => navigate("/glossary")}><BookOpen className="mr-2 h-4 w-4" />Caixa de Glossário</Button>{folderSources.length > 0 && <FolderExportDialog sources={folderSources} packageName="Pastas atribuídas da turma" label="Exportar pastas" variant="outline" />}</div>
      <div className="space-y-3 rounded-xl border p-4"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" /><p className="font-medium">Sincronização de glossário</p></div><p className="text-sm text-muted-foreground">Sincronize cada pasta ou todas de uma vez com a caixa universal.</p><div className="flex items-start gap-2"><Checkbox id="sync-normal-cards" checked={includeNormalCards} onCheckedChange={(value) => setIncludeNormalCards(Boolean(value))} /><Label htmlFor="sync-normal-cards" className="text-sm">Também usar cards normais como termo e tradução</Label></div><Button onClick={() => void syncAll()} disabled={syncingAll || folderSources.length === 0}>{syncingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizar todas as pastas</Button><div className="space-y-2">{folderSources.map((folder) => <div key={folder.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2"><span className="truncate text-sm">{folder.title}</span><FolderGlossarySyncDialog folderId={folder.id} folderTitle={folder.title} compact stopPropagation /></div>)}</div></div>
    </div></DialogContent></Dialog>
  </>;
}
