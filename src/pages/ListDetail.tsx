import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Play, Trash2, Share2, Copy, Pencil, Lightbulb, FolderPlus, Mic, CheckSquare, Square, Download, ArrowLeftRight, MoreVertical, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateFlashcardForm } from "@/components/CreateFlashcardForm";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { EditFlashcardDialog } from "@/components/EditFlashcardDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useFavorites } from "@/hooks/useFavorites";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListStudyTypeSelector, ListStudySettings, listRowToSettings, settingsToDbColumns } from "@/components/ListStudyTypeSelector";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ListType {
  id: string;
  title: string;
  description: string | null;
  folder_id: string;
  owner_id: string;
  class_id?: string | null;
}

interface FolderType {
  id: string;
  title: string;
  visibility: string;
  class_id?: string | null;
}

interface Flashcard {
  id: string;
  term: string;
  translation: string;
  hint?: string | null;
  audio_url: string | null;
}

const ListDetail = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false); // True if owner OR turma owner
  const [isSharing, setIsSharing] = useState(false);
  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const [isCloning, setIsCloning] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportText, setExportText] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  // List settings dialog
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [listSettings, setListSettings] = useState<ListStudySettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Fetch current user ID for favorites
  useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
      return user?.id;
    },
  });

  const { data: favorites = [] } = useFavorites(userId, 'flashcard');

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["list", id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("lists")
        .select("*, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, class_id")
        .eq("id", id)
        .maybeSingle();
      
      if (error) throw error;
      if (data && session) {
        const isDirectOwner = session.user.id === data.owner_id;
        setIsOwner(isDirectOwner);
        
        // Check if user is turma owner (if list is linked to a turma via class_id)
        if (data.class_id && !isDirectOwner) {
          const { data: turmaData } = await supabase
            .from("turmas")
            .select("owner_teacher_id")
            .eq("id", data.class_id)
            .maybeSingle();
          
          const isTurmaOwner = turmaData?.owner_teacher_id === session.user.id;
          setCanEdit(isDirectOwner || isTurmaOwner);
        } else {
          setCanEdit(isDirectOwner);
        }
      }
      return data as (ListType & { study_type?: string; lang_a?: string; lang_b?: string; labels_a?: string; labels_b?: string; tts_enabled?: boolean; class_id?: string | null }) | null;
    },
    staleTime: 60_000,
  });

  const { data: folder, isLoading: folderLoading } = useQuery({
    queryKey: ["folder", list?.folder_id],
    queryFn: async () => {
      if (!list?.folder_id) return null;
      const { data, error } = await supabase
        .from("folders")
        .select("id, title, visibility")
        .eq("id", list.folder_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as FolderType | null;
    },
    enabled: !!list?.folder_id,
    staleTime: 60_000,
  });

  const { data: flashcards = [], isLoading: flashcardsLoading, refetch: loadFlashcards } = useQuery({
    queryKey: ["flashcards", id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const { data, error } = await supabase.rpc('get_portal_flashcards', { 
          _list_id: id 
        });
        if (error) throw error;
        return data as Flashcard[];
      }
      
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .eq("list_id", id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as Flashcard[];
    },
    staleTime: 30_000,
  });


  const handleAddFlashcard = async (term: string, translation: string, hint?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("flashcards")
        .insert({
          list_id: id,
          user_id: session.user.id,
          term,
          translation,
          hint: hint || null,
        });

      if (error) throw error;
      loadFlashcards();
    } catch (error: any) {
      toast.error("Erro ao adicionar flashcard: " + error.message);
    }
  };

  const handleDeleteFlashcard = async (flashcardId: string) => {
    try {
      const { error } = await supabase
        .from("flashcards")
        .delete()
        .eq("id", flashcardId);

      if (error) throw error;
      toast.success("Flashcard excluído!");
      loadFlashcards();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCards.length === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("flashcards")
        .delete()
        .in("id", selectedCards);

      if (error) throw error;
      toast.success(`${selectedCards.length} cards excluídos!`);
      setSelectedCards([]);
      loadFlashcards();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCards.length === flashcards.length) {
      setSelectedCards([]);
    } else {
      setSelectedCards(flashcards.map(f => f.id));
    }
  };

  const handleUpdateFlashcard = async (flashcardId: string, term: string, translation: string, hint: string) => {
    try {
      const { error } = await supabase
        .from("flashcards")
        .update({ term, translation, hint: hint || null })
        .eq("id", flashcardId);

      if (error) throw error;
      toast.success("Flashcard atualizado!");
      loadFlashcards();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleToggleSharing = async () => {
    if (!folder) return;
    
    setIsSharing(true);
    try {
      const newVisibility = folder.visibility === 'class' ? 'private' : 'class';
      
      const { error } = await supabase
        .from("folders")
        .update({ visibility: newVisibility })
        .eq("id", folder.id);

      if (error) throw error;

      toast.success(
        newVisibility === 'class' 
          ? "Pasta compartilhada com sucesso!" 
          : "Compartilhamento desativado"
      );
    } catch (error: any) {
      toast.error("Erro ao alterar compartilhamento: " + error.message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!folder) return;
    const shareUrl = `${window.location.origin}/share/folder/${folder.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado para a área de transferência!");
  };

  // NEW: Clone list to user's account
  const handleCloneList = async () => {
    if (!list || !userId || isOwner) return;
    
    setIsCloning(true);
    try {
      // First, get user's default folder or create one
      let { data: userFolders } = await supabase
        .from("folders")
        .select("id")
        .eq("owner_id", userId)
        .limit(1);
      
      let targetFolderId: string;
      
      if (!userFolders || userFolders.length === 0) {
        // Create a default folder
        const { data: newFolder, error: folderError } = await supabase
          .from("folders")
          .insert({
            owner_id: userId,
            title: "Minhas Pastas",
            visibility: "private"
          })
          .select("id")
          .single();
        
        if (folderError) throw folderError;
        targetFolderId = newFolder.id;
      } else {
        targetFolderId = userFolders[0].id;
      }
      
      // Create the cloned list
      const { data: clonedList, error: listError } = await supabase
        .from("lists")
        .insert({
          owner_id: userId,
          folder_id: targetFolderId,
          title: `${list.title} (Cópia)`,
          description: list.description,
          visibility: "private"
        })
        .select("id")
        .single();
      
      if (listError) throw listError;
      
      // Clone all flashcards
      if (flashcards.length > 0) {
        const clonedCards = flashcards.map(card => ({
          user_id: userId,
          list_id: clonedList.id,
          term: card.term,
          translation: card.translation,
          hint: card.hint || null,
        }));
        
        const { error: cardsError } = await supabase
          .from("flashcards")
          .insert(clonedCards);
        
        if (cardsError) throw cardsError;
      }
      
      toast.success(`Lista clonada com ${flashcards.length} cards!`);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      
      // Navigate to the cloned list
      navigate(`/list/${clonedList.id}`);
    } catch (error: any) {
      console.error("Clone error:", error);
      toast.error("Erro ao clonar lista: " + error.message);
    } finally {
      setIsCloning(false);
    }
  };

  // Export all flashcards with pagination for 1000+ items
  const handleExport = async () => {
    if (!id) return;
    
    setIsExporting(true);
    setExportDialogOpen(true);
    setExportText("Carregando...");

    try {
      let allCards: { term: string; translation: string }[] = [];
      let offset = 0;
      const pageSize = 1000;

      // Paginate to get ALL cards (beyond 1000 limit)
      while (true) {
        const { data, error } = await supabase
          .from("flashcards")
          .select("term, translation")
          .eq("list_id", id)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allCards = [...allCards, ...data];
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      // Format: remove internal line breaks to keep one card per line
      const formatted = allCards.map(card => {
        const term = (card.term || "").replace(/[\r\n]+/g, " ").trim();
        const translation = (card.translation || "").replace(/[\r\n]+/g, " ").trim();
        return `${term} / ${translation}`;
      }).join("\n");

      setExportText(formatted || "Nenhum card encontrado");
    } catch (error: any) {
      console.error("Export error:", error);
      setExportText("Erro ao exportar: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportText);
    toast.success("Copiado para a área de transferência!");
  };

  // Swap A/B sides using atomic RPC
  const handleSwapSides = async () => {
    if (!id) return;
    
    setIsSwapping(true);
    try {
      const { data, error } = await supabase.rpc('swap_list_sides', {
        _list_id: id
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };
      
      if (result.success) {
        toast.success(result.message || "A/B invertidos com sucesso!");
        // Invalidate and refetch both list and flashcards
        queryClient.invalidateQueries({ queryKey: ["list", id] });
        queryClient.invalidateQueries({ queryKey: ["flashcards", id] });
        setSwapDialogOpen(false);
      } else {
        toast.error(result.message || "Erro ao inverter A/B");
      }
    } catch (error: any) {
      console.error("Swap error:", error);
      toast.error("Erro ao inverter A/B: " + error.message);
    } finally {
      setIsSwapping(false);
    }
  };

  // Open settings dialog with current list settings
  const handleOpenSettings = () => {
    if (!list) return;
    setListSettings(listRowToSettings({
      study_type: list.study_type,
      lang_a: list.lang_a,
      lang_b: list.lang_b,
      labels_a: list.labels_a,
      labels_b: list.labels_b,
      tts_enabled: list.tts_enabled,
    }));
    setSettingsDialogOpen(true);
  };

  // Save list settings
  const handleSaveSettings = async () => {
    if (!list || !listSettings) return;
    
    setIsSavingSettings(true);
    try {
      const dbColumns = settingsToDbColumns(listSettings);
      const { error } = await supabase
        .from("lists")
        .update(dbColumns)
        .eq("id", list.id);
      
      if (error) throw error;
      
      toast.success("Configurações salvas!");
      setSettingsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["list", id] });
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loading = listLoading || flashcardsLoading || folderLoading;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!list) {
    return <div className="min-h-screen flex items-center justify-center">Lista não encontrada</div>;
  }

  if (!folder) {
    return <div className="min-h-screen flex items-center justify-center">Pasta não encontrada</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1 truncate">{folder.title}</p>
              <h1 className="text-2xl md:text-3xl font-bold truncate">{list.title}</h1>
              {list.description && (
                <p className="text-muted-foreground mt-2 text-sm line-clamp-2">{list.description}</p>
              )}
            </div>
            
            {/* Action buttons - grid on mobile, flex on desktop */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3">
              {flashcards.length > 0 && (
                <>
                  <Button
                    onClick={() => navigate(isOwner ? `/list/${id}/games` : `/portal/list/${id}/games`)}
                    className="ape-action-btn col-span-1"
                  >
                    <Play className="h-5 w-5 shrink-0" />
                    Estudar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/list/${id}/study?mode=pronunciation`)}
                    className="ape-action-btn col-span-1"
                  >
                    <Mic className="h-5 w-5 shrink-0" />
                    Pronúncia
                  </Button>
                </>
              )}
              {/* Clone button for non-owners */}
              {!canEdit && userId && (
                <Button
                  variant="outline"
                  onClick={handleCloneList}
                  disabled={isCloning}
                  className="ape-action-btn col-span-2 sm:col-span-1"
                >
                  <FolderPlus className="h-5 w-5 shrink-0" />
                  {isCloning ? "Clonando..." : "Clonar"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <Card className="p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="share-mode"
                  checked={folder.visibility === 'class'}
                  onCheckedChange={handleToggleSharing}
                  disabled={isSharing}
                />
                <Label htmlFor="share-mode" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    <span className="font-semibold">
                      {folder.visibility === 'class' ? "Pasta Compartilhada" : "Compartilhar Pasta"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-normal">
                    {folder.visibility === 'class' 
                      ? "Alunos podem acessar via link" 
                      : "Ative para gerar link de acesso"}
                  </p>
                </Label>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {folder.visibility === 'class' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyShareLink}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                  </Button>
                )}
                <BulkImportDialog
                  collectionId={id!}
                  existingCards={flashcards.map(f => ({ term: f.term, translation: f.translation }))}
                  onImported={loadFlashcards}
                  labelA={list?.labels_a || (list?.lang_a === 'en' ? 'English' : list?.lang_a === 'pt' ? 'Português' : 'Lado A')}
                  labelB={list?.labels_b || (list?.lang_b === 'pt' ? 'Português' : list?.lang_b === 'en' ? 'English' : 'Lado B')}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={flashcards.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
                
                {/* More actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleOpenSettings}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configurações A/B
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSwapDialogOpen(true)}>
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      Inverter A/B
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Card>
        )}

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exportar Lista ({flashcards.length} cards)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={exportText}
                readOnly
                className="min-h-[300px] font-mono text-sm"
                placeholder="Carregando..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                  Fechar
                </Button>
                <Button onClick={handleCopyExport} disabled={isExporting || !exportText}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Tudo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Swap A/B Confirmation Dialog */}
        <AlertDialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Inverter A/B
              </AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai inverter o lado A e B de <strong>todos os {flashcards.length} cards</strong> desta lista 
                e trocar os idiomas/labels A ↔ B.
                <br /><br />
                Você pode desfazer invertendo novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSwapping}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleSwapSides} 
                disabled={isSwapping}
              >
                {isSwapping ? "Invertendo..." : "Inverter agora"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="space-y-8">
          {canEdit && (
            <CreateFlashcardForm 
              onAdd={handleAddFlashcard}
              labelA={list?.labels_a || (list?.lang_a === 'en' ? 'English' : list?.lang_a === 'pt' ? 'Português' : 'Lado A')}
              labelB={list?.labels_b || (list?.lang_b === 'pt' ? 'Português' : list?.lang_b === 'en' ? 'English' : 'Lado B')}
            />
          )}

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : flashcards.length === 0 ? (
            <Card className="text-center p-12">
              <p className="text-muted-foreground">
                {canEdit
                  ? "Nenhum flashcard ainda. Adicione o primeiro!"
                  : "Esta lista ainda não possui flashcards."}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Bulk selection controls */}
              {canEdit && flashcards.length > 0 && (
                <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="gap-2"
                  >
                    {selectedCards.length === flashcards.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {selectedCards.length === flashcards.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                  
                  {selectedCards.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDeleting}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir ({selectedCards.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir {selectedCards.length} cards? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}

              {flashcards.map((flashcard) => (
                <Card key={flashcard.id} className={`p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow ${selectedCards.includes(flashcard.id) ? 'ring-2 ring-primary' : ''}`}>
                  <div className="flex items-start gap-3">
                    {/* Checkbox for selection */}
                    {canEdit && (
                      <div className="pt-1">
                        <Checkbox
                          checked={selectedCards.includes(flashcard.id)}
                          onCheckedChange={() => toggleCardSelection(flashcard.id)}
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base sm:text-lg mb-1 break-words">{flashcard.term}</p>
                      <p className="text-muted-foreground break-words">{flashcard.translation}</p>
                      {flashcard.hint && (
                        <div className="flex items-start gap-1.5 mt-2 text-sm text-muted-foreground">
                          <Lightbulb className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <span className="italic break-words">{flashcard.hint}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {userId && (
                        <FavoriteButton
                          resourceId={flashcard.id}
                          resourceType="flashcard"
                          isFavorite={favorites.includes(flashcard.id)}
                          size="sm"
                        />
                      )}
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingFlashcard(flashcard)}
                            className="h-9 w-9"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteFlashcard(flashcard.id)}
                            className="h-9 w-9 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <EditFlashcardDialog
        flashcard={editingFlashcard}
        isOpen={!!editingFlashcard}
        onClose={() => setEditingFlashcard(null)}
        onSave={handleUpdateFlashcard}
      />

      {/* List Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações da Lista
            </DialogTitle>
            <DialogDescription>
              Altere os idiomas e configurações de estudo desta lista.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="py-4">
              {listSettings && (
                <ListStudyTypeSelector
                  value={listSettings}
                  onChange={setListSettings}
                />
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListDetail;
