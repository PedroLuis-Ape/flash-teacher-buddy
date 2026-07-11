import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CircleAlert, CheckSquare, FolderInput, FolderPlus, Search, Square, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeCardFolder } from "@/components/ape/ApeCardFolder";
import { ApeCardList } from "@/components/ape/ApeCardList";
import { ApeCardProfessor } from "@/components/ape/ApeCardProfessor";
import { ApeTabs } from "@/components/ape/ApeTabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { Textarea } from "@/components/ui/textarea";
import { useInstitution } from "@/contexts/InstitutionContext";
import {
  fetchLibrarySnapshot,
  fetchSubscribedTeachers,
  insertFolderIntoSnapshot,
  libraryKeys,
  removeFoldersFromSnapshot,
  type LibrarySnapshot,
} from "@/features/library/libraryQueries";
import { sortResourcesWithFavoritesFirst } from "@/features/study/lib/listMarkers";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { useResourceAttention, useToggleResourceAttention } from "@/hooks/useResourceAttention";
import { supabase } from "@/integrations/supabase/client";
import { pageMount } from "@/lib/perfLog";

export default function FoldersOptimized() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userId, isLoading: authLoading } = useAuthUser();
  const { selectedInstitution, institutions } = useInstitution();
  const institutionId = selectedInstitution?.id ?? null;
  const snapshotKey = userId
    ? libraryKeys.snapshot(userId, institutionId)
    : libraryKeys.snapshot("anonymous", institutionId);

  useEffect(() => {
    pageMount("Folders");
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, navigate, user]);

  const libraryQuery = useQuery({
    queryKey: snapshotKey,
    queryFn: () => fetchLibrarySnapshot(userId!, institutionId),
    enabled: Boolean(userId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const teachersQuery = useQuery({
    queryKey: userId ? libraryKeys.teachers(userId) : ["library", "teachers", "anonymous"],
    queryFn: () => fetchSubscribedTeachers(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const folders = libraryQuery.data?.folders ?? [];
  const lists = libraryQuery.data?.lists ?? [];
  const teachers = teachersQuery.data ?? [];
  const loading = authLoading || (libraryQuery.isPending && !libraryQuery.data);

  const { data: folderFavorites = [] } = useFavorites(userId, "folder");
  const { data: listFavorites = [] } = useFavorites(userId, "list");
  const toggleFavorite = useToggleFavorite();
  const { data: folderAttention = [] } = useResourceAttention(userId, "folder");
  const toggleFolderAttention = useToggleResourceAttention();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFolder, setNewFolder] = useState({ title: "", description: "", visibility: "private" });
  const [isCreating, setIsCreating] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [foldersToMove, setFoldersToMove] = useState<string[]>([]);
  const [moveDestination, setMoveDestination] = useState("general");
  const [isMoving, setIsMoving] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");

  const refreshCurrent = () => queryClient.invalidateQueries({ queryKey: snapshotKey });

  const createFolder = async () => {
    const title = newFolder.title.trim();
    if (!title) {
      toast.error("Digite um título para a pasta");
      return;
    }
    if (!userId || isCreating) return;

    setIsCreating(true);
    try {
      const { data, error } = await (supabase as any)
        .from("folders")
        .insert({
          owner_id: userId,
          title,
          description: newFolder.description.trim() || null,
          visibility: newFolder.visibility,
          institution_id: institutionId,
        })
        .select("id,title,description,visibility,owner_id")
        .single();
      if (error) throw error;

      queryClient.setQueryData<LibrarySnapshot>(snapshotKey, (current) =>
        insertFolderIntoSnapshot(current, {
          ...data,
          list_count: 0,
          card_count: 0,
          isOwner: true,
        }),
      );
      setDialogOpen(false);
      setNewFolder({ title: "", description: "", visibility: "private" });
      toast.success("✅ Pasta criada com sucesso!");
      void refreshCurrent();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("❌ Erro ao criar pasta");
    } finally {
      setIsCreating(false);
    }
  };

  const handleMoveFolders = async () => {
    if (!userId || !foldersToMove.length) return;
    const destinationId = moveDestination === "general" ? null : moveDestination;
    setIsMoving(true);
    try {
      const { error } = await supabase
        .from("folders")
        .update({ institution_id: destinationId })
        .in("id", foldersToMove);
      if (error) throw error;

      queryClient.setQueryData<LibrarySnapshot>(snapshotKey, (current) =>
        removeFoldersFromSnapshot(current, new Set(foldersToMove)),
      );
      void queryClient.invalidateQueries({ queryKey: snapshotKey });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.snapshot(userId, destinationId) });

      const destinationName = destinationId
        ? institutions.find((item) => item.id === destinationId)?.name ?? "destino"
        : "Biblioteca Geral";
      toast.success(`✅ ${foldersToMove.length} pasta(s) movida(s) para ${destinationName}!`);
      setMoveDialogOpen(false);
      setFoldersToMove([]);
      setMoveDestination("general");
      setSelectedFolders(new Set());
      setSelectMode(false);
    } catch (error) {
      console.error("Error moving folders:", error);
      toast.error("❌ Erro ao mover pastas");
      void refreshCurrent();
    } finally {
      setIsMoving(false);
    }
  };

  const deleteFolder = async () => {
    if (!folderToDelete || !userId) return;
    const id = folderToDelete;
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("soft_delete_folder" as any, {
        p_folder_id: id,
        p_user_id: userId,
      } as any);
      if (error) throw error;

      queryClient.setQueryData<LibrarySnapshot>(snapshotKey, (current) =>
        removeFoldersFromSnapshot(current, new Set([id])),
      );
      const { showUndoDeleteToast } = await import("@/lib/deleteUndo");
      showUndoDeleteToast({ id, type: "folder" }, () => void refreshCurrent());
      setFolderToDelete(null);
      void refreshCurrent();
    } catch (error) {
      console.error("Error soft-deleting folder:", error);
      toast.error("❌ Erro ao excluir pasta");
      void refreshCurrent();
    } finally {
      setIsDeleting(false);
    }
  };

  const bulkDeleteFolders = async () => {
    if (!selectedFolders.size || !userId || isDeleting) return;
    const ids = Array.from(selectedFolders);
    setIsDeleting(true);
    try {
      let totalFolders = 0;
      let totalLists = 0;
      let totalCards = 0;
      const chunkSize = 100;
      for (let index = 0; index < ids.length; index += chunkSize) {
        const chunk = ids.slice(index, index + chunkSize);
        const { data, error } = await supabase.rpc("bulk_soft_delete_folders" as any, {
          p_folder_ids: chunk,
          p_user_id: userId,
        } as any);
        if (error) throw error;
        const result = (data ?? {}) as any;
        totalFolders += result.deleted_folders_count ?? 0;
        totalLists += result.deleted_lists_count ?? 0;
        totalCards += result.deleted_cards_count ?? 0;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      queryClient.setQueryData<LibrarySnapshot>(snapshotKey, (current) =>
        removeFoldersFromSnapshot(current, new Set(ids)),
      );
      const { showBulkUndoDeleteToast } = await import("@/lib/deleteUndo");
      showBulkUndoDeleteToast(ids.map((id) => ({ id, type: "folder" as const })), () => void refreshCurrent());
      if (totalLists || totalCards) {
        toast.message(`📁 ${totalFolders} pasta(s) (${totalLists} listas, ${totalCards} cards) enviadas para a lixeira.`);
      }
      setSelectedFolders(new Set());
      setSelectMode(false);
      setShowBulkDeleteDialog(false);
      void refreshCurrent();
    } catch (error: any) {
      console.error("Error soft-deleting folders:", error);
      toast.error(`❌ Erro ao excluir pastas: ${error?.message || "desconhecido"}`);
      void refreshCurrent();
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleFolderSelection = (folderId: string) => {
    setSelectedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const filteredFolders = useMemo(
    () => sortResourcesWithFavoritesFirst(
      folders.filter((folder) => folder.title.toLocaleLowerCase().includes(folderSearch.toLocaleLowerCase())),
      folderFavorites,
    ),
    [folderFavorites, folderSearch, folders],
  );
  const favoritedFolders = folders.filter((folder) => folderFavorites.includes(folder.id));
  const favoritedLists = lists.filter((list) => listFavorites.includes(list.id));
  const totalFavorites = favoritedFolders.length + favoritedLists.length;

  const folderGrid = libraryQuery.isError && !libraryQuery.data ? (
    <div className="p-6 text-center">
      <p className="text-sm text-destructive">Não foi possível carregar a Biblioteca.</p>
      <Button className="mt-3" variant="outline" onClick={() => void libraryQuery.refetch()}>Tentar novamente</Button>
    </div>
  ) : loading ? (
    <SkeletonGrid count={5} variant="folder" />
  ) : folders.length === 0 ? (
    <div className="py-8 text-center text-muted-foreground">
      <p className="text-sm">Nenhuma pasta ainda</p>
      <p className="mt-1 text-xs">Crie sua primeira pasta de estudos</p>
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-3 auto-rows-fr sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredFolders.map((folder) => {
        const isFavorite = folderFavorites.includes(folder.id);
        const isAttention = folderAttention.includes(folder.id);
        const isSelected = selectedFolders.has(folder.id);
        return (
          <div key={folder.id} className="flex items-center gap-2">
            {selectMode && (
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => toggleFolderSelection(folder.id)}>
                {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
              </Button>
            )}
            <div className="min-w-0 flex-1" onClick={() => selectMode ? toggleFolderSelection(folder.id) : navigate(`/folder/${folder.id}`)}>
              <ApeCardFolder
                title={folder.title}
                listCount={folder.list_count}
                cardCount={folder.card_count}
                className={isAttention ? "border-red-500/60 bg-red-500/10 md:hover:border-red-500/70 md:hover:bg-red-500/15" : undefined}
                onClick={selectMode ? undefined : () => navigate(`/folder/${folder.id}`)}
              />
            </div>
            {!selectMode && (
              <>
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={() => { setFoldersToMove([folder.id]); setMoveDialogOpen(true); }} title="Mover pasta">
                  <FolderInput className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className={`h-11 w-11 shrink-0 rounded-xl ${isFavorite ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`} onClick={() => toggleFavorite.mutate({ resourceId: folder.id, resourceType: "folder", isFavorite })}>
                  <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" className={`h-11 w-11 shrink-0 rounded-xl ${isAttention ? "bg-red-500/15 text-red-500" : "text-muted-foreground hover:text-red-500"}`} onClick={() => userId && toggleFolderAttention.mutate({ userId, resourceType: "folder", resourceId: folder.id, isAttention })}>
                  <CircleAlert className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl text-destructive" onClick={() => setFolderToDelete(folder.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  const foldersTab = (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2 py-1">
        <div className="flex items-center gap-2">
          {folders.length > 0 && (
            <Button size="sm" variant={selectMode ? "secondary" : "outline"} className="min-h-[40px]" onClick={() => { setSelectMode((value) => !value); if (selectMode) setSelectedFolders(new Set()); }}>
              {selectMode ? <><X className="mr-2 h-4 w-4" />Cancelar</> : <><CheckSquare className="mr-2 h-4 w-4" />Selecionar</>}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm" className="min-h-[40px]"><FolderPlus className="mr-2 h-4 w-4" />Nova pasta</Button></DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Pasta</DialogTitle><DialogDescription>Crie uma pasta para organizar suas listas de estudo</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <div><Label htmlFor="folder-title">Título</Label><Input id="folder-title" value={newFolder.title} onChange={(event) => setNewFolder({ ...newFolder, title: event.target.value })} placeholder="Ex: Inglês Básico" /></div>
                <div><Label htmlFor="folder-description">Descrição (opcional)</Label><Textarea id="folder-description" value={newFolder.description} onChange={(event) => setNewFolder({ ...newFolder, description: event.target.value })} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreating}>Cancelar</Button><Button onClick={createFolder} disabled={isCreating}>{isCreating ? "Criando..." : "Criar Pasta"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {folders.length > 3 && <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={folderSearch} onChange={(event) => setFolderSearch(event.target.value)} placeholder="Buscar pasta..." className="h-10 pl-9" /></div>}
      {folderGrid}
      {selectMode && selectedFolders.size > 0 && <div className="fixed bottom-20 left-0 right-0 border-t bg-background/95 p-4 backdrop-blur md:static md:mt-4 md:border-0 md:bg-transparent md:p-0"><div className="flex gap-2"><Button variant="outline" className="min-h-[48px] flex-1" onClick={() => { setFoldersToMove(Array.from(selectedFolders)); setMoveDialogOpen(true); }}><FolderInput className="mr-2 h-4 w-4" />Mover ({selectedFolders.size})</Button><Button variant="destructive" className="min-h-[48px] flex-1" onClick={() => setShowBulkDeleteDialog(true)}><Trash2 className="mr-2 h-4 w-4" />Apagar ({selectedFolders.size})</Button></div></div>}
    </div>
  );

  const favoritesTab = (
    <div className="space-y-6 p-4">
      {loading ? <div className="py-4 text-center text-sm text-muted-foreground">Carregando...</div> : totalFavorites === 0 ? <div className="py-8 text-center text-muted-foreground"><Star className="mx-auto mb-3 h-12 w-12 opacity-30" /><p className="text-sm">Nenhum favorito ainda</p></div> : <>
        {favoritedFolders.length > 0 && <div className="space-y-3"><h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pastas favoritas</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{favoritedFolders.map((folder) => <div key={folder.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><ApeCardFolder title={folder.title} listCount={folder.list_count} cardCount={folder.card_count} onClick={() => navigate(`/folder/${folder.id}`)} /></div><Button variant="ghost" size="icon" className="h-11 w-11 text-yellow-500" onClick={() => toggleFavorite.mutate({ resourceId: folder.id, resourceType: "folder", isFavorite: true })}><Star className="h-4 w-4 fill-current" /></Button></div>)}</div></div>}
        {favoritedLists.length > 0 && <div className="space-y-3"><h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Listas favoritas</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{favoritedLists.map((list) => <div key={list.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><ApeCardList title={list.title} subtitle={list.folder_title ?? undefined} cardCount={list.card_count} onClick={() => navigate(`/list/${list.id}`)} onPlayClick={() => navigate(`/list/${list.id}/games`)} /></div><Button variant="ghost" size="icon" className="h-11 w-11 text-yellow-500" onClick={() => toggleFavorite.mutate({ resourceId: list.id, resourceType: "list", isFavorite: true })}><Star className="h-4 w-4 fill-current" /></Button></div>)}</div></div>}
      </>}
    </div>
  );

  const teachersTab = (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between py-1"><h2 className="text-lg font-semibold">Meus professores</h2><Button size="sm" variant="outline" onClick={() => navigate("/my-teachers")}>Gerenciar</Button></div>
      {teachersQuery.isPending && !teachersQuery.data ? <div className="py-4 text-center text-sm text-muted-foreground">Carregando...</div> : teachers.length === 0 ? <div className="py-8 text-center text-muted-foreground"><p className="text-sm">Você ainda não segue nenhum professor</p><Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/my-teachers")}>Buscar Professores</Button></div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{teachers.map((teacher) => <ApeCardProfessor key={teacher.id} name={teacher.first_name || "Professor"} email="" folderCount={teacher.folder_count} listCount={teacher.list_count} cardCount={teacher.card_count} onClick={() => navigate(`/teacher/${teacher.id}/folders`)} />)}</div>}
    </div>
  );

  const tabs = [
    { value: "folders", label: "Pastas", count: folders.length, content: foldersTab },
    { value: "favorites", label: "Favoritas", count: totalFavorites, content: favoritesTab },
    { value: "teachers", label: "Professores", count: teachers.length, content: teachersTab },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Biblioteca" variant="home" />
      <div className="mx-auto max-w-6xl px-4 lg:px-8"><ApeTabs tabs={tabs} defaultValue="folders" /></div>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Mover {foldersToMove.length > 1 ? `${foldersToMove.length} pastas` : "pasta"}</DialogTitle><DialogDescription>Selecione o destino</DialogDescription></DialogHeader><div className="py-4"><Label htmlFor="destination">Destino</Label><Select value={moveDestination} onValueChange={setMoveDestination}><SelectTrigger id="destination" className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">📚 Biblioteca Geral</SelectItem>{institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>🏫 {institution.name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setMoveDialogOpen(false)} disabled={isMoving}>Cancelar</Button><Button onClick={handleMoveFolders} disabled={isMoving}>{isMoving ? "Movendo..." : "Mover"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Excluir {selectedFolders.size} pasta(s) e todo o conteúdo?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={bulkDeleteFolders} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting ? "Excluindo..." : "Excluir"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={Boolean(folderToDelete)} onOpenChange={(open) => !open && setFolderToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir pasta?</AlertDialogTitle><AlertDialogDescription>Todas as listas e cards dentro desta pasta serão enviados para a lixeira.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={deleteFolder} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting ? "Excluindo..." : "Excluir"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
