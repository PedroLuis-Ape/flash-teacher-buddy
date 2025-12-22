import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ArrowLeft, ListPlus, FileText, Trash2, Pencil, Share2, Play, CheckSquare, Square, X, Settings, BookOpen, Copy, Sparkles, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VideoList } from "@/components/VideoList";
import { naturalSort } from "@/lib/sorting";
import { ListStudyTypeSelector, ListStudySettings, getDefaultListStudySettings, settingsToDbColumns } from "@/components/ListStudyTypeSelector";
import { useFolderText } from "@/hooks/useFolderText";

interface ListType {
  id: string;
  title: string;
  description: string | null;
  card_count?: number;
}

interface FolderType {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  class_id?: string | null;
  // Language settings (inherited by new lists)
  study_type?: string;
  lang_a?: string;
  lang_b?: string;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean;
}

const Folder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [folder, setFolder] = useState<FolderType | null>(null);
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false); // True if owner OR turma owner
  const [isClassContext, setIsClassContext] = useState(false); // True if folder is linked to a class
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<ListType | null>(null);
  const [newList, setNewList] = useState({ title: "", description: "" });
  const [newListStudySettings, setNewListStudySettings] = useState<ListStudySettings>(getDefaultListStudySettings());
  // Folder language settings dialog
  const [folderSettingsOpen, setFolderSettingsOpen] = useState(false);
  const [folderSettings, setFolderSettings] = useState<ListStudySettings>(getDefaultListStudySettings());
  const [isSavingFolderSettings, setIsSavingFolderSettings] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [allowPublicPortal, setAllowPublicPortal] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  // Text tab state
  const [isEditingText, setIsEditingText] = useState(false);
  const [editTextTitle, setEditTextTitle] = useState("");
  const [editTextContent, setEditTextContent] = useState("");
  
  // Folder text hook
  const { folderText, isLoading: textLoading, saveText, isSaving: isSavingText, deleteText } = useFolderText(id);
  
  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-folder'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 5 * 60 * 1000,
  });
  
  const userId = currentUser?.id;

  // Reset permission states when id changes, THEN load data
  useEffect(() => {
    // CRITICAL: Reset permission states first to avoid stale canEdit
    setCanEdit(false);
    setIsOwner(false);
    setIsClassContext(false);
    setFolder(null);
    setLists([]);
    setLoading(true);
    setIsEditingText(false);
    
    loadFolder();
    loadLists();
  }, [id]);

  const loadFolder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // First try direct query (works for owners due to RLS)
        const { data: directData, error: directError } = await supabase
          .from("folders")
          .select("*, class_id")
          .eq("id", id)
          .maybeSingle();
        
        if (directData) {
          // Got folder directly (user is owner or has RLS access)
          setFolder(directData);
          const isDirectOwner = session.user.id === directData.owner_id;
          setIsOwner(isDirectOwner);
          setIsClassContext(!!directData.class_id);
          
          // Check if user is turma owner (if folder is linked to a turma via class_id)
          if (directData.class_id) {
            const { data: turmaData } = await supabase
              .from("turmas")
              .select("owner_teacher_id")
              .eq("id", directData.class_id)
              .maybeSingle();
            
            const isTurmaOwner = turmaData?.owner_teacher_id === session.user.id;
            setCanEdit(isDirectOwner || isTurmaOwner);
          } else {
            setCanEdit(isDirectOwner);
          }
        } else {
          // If RLS blocked or not owner, use edge function for student access
          console.log("[Folder] Direct query failed, trying edge function for student access");
          
          const { data: edgeFnData, error: edgeFnError } = await supabase.functions.invoke('get-folder-full', {
            body: { folder_id: id }
          });
          
          if (edgeFnError) {
            console.error("[Folder] Edge function error:", edgeFnError);
            toast.error("Pasta não encontrada ou sem permissão");
            navigate("/folders");
            return;
          }
          
          if (!edgeFnData?.folder) {
            console.log("[Folder] No folder returned from edge function");
            toast.error("Pasta não encontrada ou sem permissão");
            navigate("/folders");
            return;
          }
          
          console.log("[Folder] Loaded via edge function:", edgeFnData.folder.title);
          setFolder(edgeFnData.folder);
          setIsOwner(session.user.id === edgeFnData.folder.owner_id);
          setCanEdit(session.user.id === edgeFnData.folder.owner_id);
          
          // Also set lists if returned by edge function
          if (edgeFnData.lists) {
            setLists(edgeFnData.lists.map((l: any) => ({
              id: l.id,
              title: l.title,
              description: l.description,
              card_count: l.cards_count || 0,
            })));
            setLoading(false);
          }
        }
      } else {
        // Acesso público via portal
        const { data, error } = await supabase.rpc('get_portal_folder', { _id: id });
        
        if (error) {
          console.error("Erro RPC get_portal_folder:", error);
          toast.error("Pasta não encontrada ou não está compartilhada");
          navigate("/portal");
          return;
        }
        
        if (!data) {
          console.log("Nenhuma pasta retornada do RPC");
          toast.error("Pasta não encontrada ou não está compartilhada");
          navigate("/portal");
          return;
        }
        
        console.log("Pasta carregada via portal:", data);
        setFolder(data as any);
        setIsOwner(false);
      }
    } catch (error: any) {
      console.error("Erro ao carregar pasta:", error);
      toast.error("Erro ao carregar pasta: " + error.message);
      const { data: { session } } = await supabase.auth.getSession();
      navigate(session ? "/folders" : "/portal");
    }
  };

  const loadLists = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use RPC to get lists with card counts in a single query (eliminates N+1)
      if (session) {
        const { data, error } = await supabase.rpc('get_lists_with_card_counts', { 
          _folder_id: id 
        });
        if (error) throw error;
        setLists((data as any[]) || []);
      } else {
        // Public portal access - use RPC with counts
        const { data, error } = await supabase.rpc('get_portal_lists_with_counts', { 
          _folder_id: id 
        });
        
        if (error) {
          console.error("Erro RPC get_portal_lists_with_counts:", error);
        }
        
        setLists((data as any[]) || []);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar listas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || !folder) return;
    
    setIsSavingTitle(true);
    try {
      const { error } = await supabase
        .from("folders")
        .update({ title: editTitle.trim() })
        .eq("id", folder.id);
      
      if (error) throw error;
      
      setFolder({ ...folder, title: editTitle.trim() });
      setIsEditingTitle(false);
      toast.success("Título atualizado!");
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleShareFolder = async () => {
    setSharing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Faça login para compartilhar");
      
      // Update folder visibility
      const { error: folderError } = await supabase
        .from("folders")
        .update({ visibility: "class" })
        .eq("id", id);
      
      if (folderError) throw folderError;

      // Update all lists in folder
      const { error: listsError } = await supabase
        .from("lists")
        .update({ visibility: "class" })
        .eq("folder_id", id as string);
      
      if (listsError) throw listsError;

      // Enable public portal access if requested
      if (allowPublicPortal) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            { id: session.user.id, public_access_enabled: true },
            { onConflict: "id" }
          );
        
        if (profileError) throw profileError;
      }

      toast.success("Pasta compartilhada com sucesso!");
      setShareDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro ao compartilhar: " + error.message);
    } finally {
      setSharing(false);
    }
  };

  // Open folder settings dialog with current folder settings
  const handleOpenFolderSettings = () => {
    if (!folder) return;
    setFolderSettings({
      studyType: (folder.study_type === "general" ? "general" : "language") as "language" | "general",
      langA: folder.lang_a || "en",
      langB: folder.lang_b || "pt",
      labelsA: folder.labels_a || (folder.study_type === "general" ? "Frente" : "English"),
      labelsB: folder.labels_b || (folder.study_type === "general" ? "Verso" : "Português"),
      ttsEnabled: folder.tts_enabled ?? true,
    });
    setFolderSettingsOpen(true);
  };

  // Save folder settings
  const handleSaveFolderSettings = async () => {
    if (!folder) return;
    
    setIsSavingFolderSettings(true);
    try {
      const { error } = await supabase
        .from("folders")
        .update({
          study_type: folderSettings.studyType,
          lang_a: folderSettings.langA,
          lang_b: folderSettings.langB,
          labels_a: folderSettings.labelsA,
          labels_b: folderSettings.labelsB,
          tts_enabled: folderSettings.ttsEnabled,
        })
        .eq("id", folder.id);
      
      if (error) throw error;
      
      // Update local state
      setFolder({
        ...folder,
        study_type: folderSettings.studyType,
        lang_a: folderSettings.langA,
        lang_b: folderSettings.langB,
        labels_a: folderSettings.labelsA,
        labels_b: folderSettings.labelsB,
        tts_enabled: folderSettings.ttsEnabled,
      });
      
      toast.success("Idiomas da pasta atualizados!");
      setFolderSettingsOpen(false);
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSavingFolderSettings(false);
    }
  };

  // When dialog opens for new list, inherit folder settings
  const handleOpenNewListDialog = () => {
    if (folder) {
      setNewListStudySettings({
        studyType: (folder.study_type === "general" ? "general" : "language") as "language" | "general",
        langA: folder.lang_a || "en",
        langB: folder.lang_b || "pt",
        labelsA: folder.labels_a || (folder.study_type === "general" ? "Frente" : "English"),
        labelsB: folder.labels_b || (folder.study_type === "general" ? "Verso" : "Português"),
        ttsEnabled: folder.tts_enabled ?? true,
      });
    }
    setDialogOpen(true);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newList.title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const studyDbColumns = settingsToDbColumns(newListStudySettings);

      const { data: createdList, error } = await supabase
        .from("lists")
        .insert({
          folder_id: id,
          title: newList.title,
          description: newList.description,
          owner_id: session.user.id,
          order_index: lists.length,
          ...studyDbColumns,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Lista criada! Edite o conteúdo abaixo.");
      setDialogOpen(false);
      setNewList({ title: "", description: "" });
      setNewListStudySettings(getDefaultListStudySettings());
      
      // Navegar automaticamente para a lista criada
      if (createdList) {
        navigate(`/list/${createdList.id}`);
      } else {
        loadLists();
      }
    } catch (error: any) {
      toast.error("Erro ao criar lista: " + error.message);
    }
  };

  const handleEditList = (list: ListType) => {
    setEditingList(list);
    setEditDialogOpen(true);
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingList || !editingList.title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from("lists")
        .update({
          title: editingList.title,
          description: editingList.description,
        })
        .eq("id", editingList.id);

      if (error) throw error;

      toast.success("Lista atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingList(null);
      loadLists();
    } catch (error: any) {
      toast.error("Erro ao atualizar lista: " + error.message);
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      const { error } = await supabase
        .from("lists")
        .delete()
        .eq("id", listId);

      if (error) throw error;

      toast.success("Lista excluída com sucesso!");
      loadLists();
    } catch (error: any) {
      toast.error("Erro ao excluir lista: " + error.message);
    }
  };

  // Toggle list selection
  const toggleListSelection = (listId: string) => {
    setSelectedLists(prev => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedLists.size === lists.length) {
      setSelectedLists(new Set());
    } else {
      setSelectedLists(new Set(lists.map(l => l.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedLists.size === 0) return;
    
    setIsBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("lists")
        .delete()
        .in("id", Array.from(selectedLists));
      
      if (error) throw error;
      
      toast.success(`${selectedLists.size} lista(s) excluída(s)!`);
      setSelectedLists(new Set());
      setSelectionMode(false);
      setShowBulkDeleteDialog(false);
      loadLists();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Copy all vocabulary terms from all lists in this folder
  const handleCopyVocabulary = async () => {
    try {
      // Fetch all flashcards from all lists in this folder
      const { data: flashcards, error } = await supabase
        .from("flashcards")
        .select("term, list_id")
        .in("list_id", lists.map(l => l.id));
      
      if (error) throw error;
      
      if (!flashcards || flashcards.length === 0) {
        toast.error("Nenhum termo encontrado nas listas");
        return;
      }
      
      // Get unique terms
      const uniqueTerms = [...new Set(flashcards.map(f => f.term))];
      const vocabulary = uniqueTerms.join(", ");
      
      await navigator.clipboard.writeText(vocabulary);
      toast.success(`${uniqueTerms.length} termos copiados!`);
    } catch (error: any) {
      toast.error("Erro ao copiar: " + error.message);
    }
  };

  // Copy pre-formatted AI prompt for story generation
  const handleCopyAIPrompt = async () => {
    try {
      // Fetch all flashcards from all lists in this folder
      const { data: flashcards, error } = await supabase
        .from("flashcards")
        .select("term, list_id")
        .in("list_id", lists.map(l => l.id));
      
      if (error) throw error;
      
      if (!flashcards || flashcards.length === 0) {
        toast.error("Nenhum termo encontrado nas listas");
        return;
      }
      
      // Get unique terms
      const uniqueTerms = [...new Set(flashcards.map(f => f.term))];
      const vocabulary = uniqueTerms.join(", ");
      
      // Detect language from folder settings
      const langLabel = folder?.lang_a === "en" ? "Inglês" 
        : folder?.lang_a === "pt" ? "Português"
        : folder?.lang_a === "es" ? "Espanhol"
        : folder?.lang_a || "Inglês";
      
      const prompt = `Crie uma história curta em ${langLabel} usando as seguintes palavras: ${vocabulary}. O texto deve ser adequado para nível iniciante.`;
      
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copiado! Cole em uma IA como ChatGPT ou Gemini.");
    } catch (error: any) {
      toast.error("Erro ao copiar: " + error.message);
    }
  };

  // Memoize sorted lists to avoid re-sorting on every render
  const sortedLists = useMemo(() => naturalSort(lists, (list) => list.title), [lists]);

  if (!folder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando pasta...</p>
        </div>
      </div>
    );
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
          
          <div className="flex items-center gap-3">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold h-12"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
                <Button onClick={handleSaveTitle} disabled={isSavingTitle} size="sm">
                  {isSavingTitle ? "..." : "Salvar"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingTitle(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{folder.title}</h1>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditTitle(folder.title);
                      setIsEditingTitle(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          {folder.description && (
            <p className="text-muted-foreground mt-2">{folder.description}</p>
          )}
        </div>

        <Tabs defaultValue="lists" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="lists">Listas</TabsTrigger>
            <TabsTrigger value="texto">
              <BookOpen className="mr-1.5 h-4 w-4" />
              Texto
            </TabsTrigger>
            <TabsTrigger value="videos">Vídeos</TabsTrigger>
          </TabsList>

          <TabsContent value="lists">
            {canEdit && (
              <div className="mb-4 flex flex-wrap gap-2">
                {/* Folder language settings button */}
                <Button variant="outline" size="sm" onClick={handleOpenFolderSettings}>
                  <Settings className="mr-1.5 h-4 w-4" />
                  Idiomas
                </Button>
                
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={handleOpenNewListDialog}>
                      <ListPlus className="mr-1.5 h-4 w-4" />
                      Nova Lista
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Lista</DialogTitle>
                      <DialogDescription>
                        A lista será criada e você será redirecionado automaticamente para editá-la.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateList}>
                      <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="title">Título</Label>
                            <Input
                              id="title"
                              value={newList.title}
                              onChange={(e) => setNewList({ ...newList, title: e.target.value })}
                              placeholder="Ex: Verbos Irregulares"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">Descrição (opcional)</Label>
                            <Textarea
                              id="description"
                              value={newList.description}
                              onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                              placeholder="Descreva o conteúdo desta lista..."
                            />
                          </div>
                          
                          {/* Study Type Selector */}
                          <ListStudyTypeSelector
                            value={newListStudySettings}
                            onChange={setNewListStudySettings}
                          />
                        </div>
                      </ScrollArea>
                      <DialogFooter className="mt-4">
                        <Button type="submit">Criar Lista</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Share2 className="mr-1.5 h-4 w-4" />
                      Compartilhar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Compartilhar Pasta</DialogTitle>
                      <DialogDescription>
                        Torne esta pasta e todo o seu conteúdo visível para seus alunos no Portal do Aluno.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <p className="text-sm text-muted-foreground">
                        A pasta será compartilhada com a turma. As listas e flashcards dentro dela também serão compartilhados.
                      </p>
                      <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
                        <Checkbox
                          id="allow-public"
                          checked={allowPublicPortal}
                          onCheckedChange={(c) => setAllowPublicPortal(Boolean(c))}
                        />
                        <div className="flex-1">
                          <Label htmlFor="allow-public" className="font-semibold cursor-pointer">
                            Permitir acesso sem login no Portal do Aluno
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Os alunos poderão acessar o conteúdo em /portal sem precisar fazer login
                          </p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleShareFolder} disabled={sharing}>
                        {sharing ? "Compartilhando..." : "Compartilhar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Selection Mode Toggle */}
                {lists.length > 0 && (
                  <Button 
                    variant={selectionMode ? "default" : "outline"} 
                    size="sm"
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      setSelectedLists(new Set());
                    }}
                  >
                    {selectionMode ? (
                      <>
                        <X className="mr-1.5 h-4 w-4" />
                        Cancelar
                      </>
                    ) : (
                      <>
                        <CheckSquare className="mr-1.5 h-4 w-4" />
                        Selecionar
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Selection Actions Bar */}
            {selectionMode && selectedLists.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-50 md:relative md:mb-4 md:p-3 md:rounded-lg md:border">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                      {selectedLists.size === lists.length ? (
                        <>
                          <Square className="mr-1.5 h-4 w-4" />
                          Desmarcar
                        </>
                      ) : (
                        <>
                          <CheckSquare className="mr-1.5 h-4 w-4" />
                          Todos
                        </>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedLists.size} selecionado(s)
                    </span>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Apagar ({selectedLists.size})
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-4">Carregando...</p>
            ) : lists.length === 0 ? (
              <Card className="text-center p-8">
                <CardHeader>
                  <CardTitle className="text-lg">Nenhuma lista ainda</CardTitle>
                  <CardDescription className="text-sm">
                    {canEdit
                      ? "Crie sua primeira lista de flashcards"
                      : "Esta pasta ainda não possui listas"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className={`space-y-2 ${selectionMode && selectedLists.size > 0 ? 'pb-24 md:pb-0' : ''}`}>
                {sortedLists.map((list) => {
                  const isSelected = selectedLists.has(list.id);
                  return (
                    <div
                      key={list.id}
                      onClick={() => {
                        if (selectionMode) {
                          toggleListSelection(list.id);
                        } else {
                          navigate(isOwner ? `/list/${list.id}` : `/portal/list/${list.id}/games`);
                        }
                      }}
                      className={`w-full text-left cursor-pointer ${isSelected ? 'ring-2 ring-primary rounded-lg' : ''}`}
                    >
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-3 flex items-center gap-3">
                          {/* Selection checkbox */}
                          {selectionMode && (
                            <div 
                              className="shrink-0" 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleListSelection(list.id);
                              }}
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          
                          {!selectionMode && (
                            <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate leading-tight">
                              {list.title}
                            </h3>
                            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                              {list.card_count || 0} {list.card_count === 1 ? 'card' : 'cards'}
                            </p>
                          </div>

                          {/* Play Button - hidden in selection mode */}
                          {!selectionMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/list/${list.id}/games`);
                              }}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}

                          {canEdit && !selectionMode && (
                            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditList(list);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. Todos os flashcards desta lista também serão excluídos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteList(list.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TEXT TAB */}
          <TabsContent value="texto">
            {textLoading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Carregando...</p>
              </Card>
            ) : isEditingText ? (
              // EDIT MODE
              <Card className="p-4 space-y-4">
                {isClassContext && canEdit && (
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Esta alteração afetará todos os alunos da turma.
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="text-title">Título</Label>
                  <Input
                    id="text-title"
                    value={editTextTitle}
                    onChange={(e) => setEditTextTitle(e.target.value)}
                    placeholder="Ex: História com vocabulário"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-content">Conteúdo</Label>
                  <Textarea
                    id="text-content"
                    value={editTextContent}
                    onChange={(e) => setEditTextContent(e.target.value)}
                    placeholder="Digite ou cole seu texto aqui..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => {
                      saveText({ title: editTextTitle || "Texto", content: editTextContent });
                      setIsEditingText(false);
                    }}
                    disabled={isSavingText}
                  >
                    {isSavingText ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditingText(false)}>
                    Cancelar
                  </Button>
                </div>
              </Card>
            ) : folderText?.content ? (
              // VIEW MODE with content
              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{folderText.title || "Texto"}</h3>
                  {canEdit && (
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Collect all unique terms from lists
                                const allTerms = lists.flatMap(list => list.title);
                                // This will get terms from flashcards via API
                                handleCopyVocabulary();
                              }}
                            >
                              <Copy className="mr-1.5 h-4 w-4" />
                              Copiar Vocabulário
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copia todos os termos das listas</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditTextTitle(folderText.title || "Texto");
                          setEditTextContent(folderText.content || "");
                          setIsEditingText(true);
                        }}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed bg-transparent p-0 m-0">
                    {folderText.content}
                  </pre>
                </div>
              </Card>
            ) : (
              // EMPTY STATE
              <Card className="p-8 text-center space-y-4">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Nenhum texto ainda</h3>
                  <p className="text-sm text-muted-foreground">
                    {canEdit
                      ? "Adicione textos de leitura baseados no vocabulário das listas"
                      : "Esta pasta ainda não possui textos de apoio"}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      onClick={() => {
                        setEditTextTitle("Texto");
                        setEditTextContent("");
                        setIsEditingText(true);
                      }}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Criar Texto
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" onClick={handleCopyVocabulary}>
                            <Copy className="mr-1.5 h-4 w-4" />
                            Copiar Vocabulário
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copia todos os termos das listas</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" onClick={handleCopyAIPrompt}>
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            Copiar Prompt para IA
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copia um prompt para gerar história com IA</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="videos">
            <VideoList folderId={id as string} isOwner={isOwner} />
          </TabsContent>
        </Tabs>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Lista</DialogTitle>
              <DialogDescription>
                Altere o título e descrição da lista
              </DialogDescription>
            </DialogHeader>
            {editingList && (
              <form onSubmit={handleUpdateList}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-list-title">Título</Label>
                    <Input
                      id="edit-list-title"
                      value={editingList.title}
                      onChange={(e) => setEditingList({ ...editingList, title: e.target.value })}
                      placeholder="Ex: Verbos Irregulares"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-list-description">Descrição (opcional)</Label>
                    <Textarea
                      id="edit-list-description"
                      value={editingList.description || ""}
                      onChange={(e) => setEditingList({ ...editingList, description: e.target.value })}
                      placeholder="Descreva o conteúdo desta lista..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Salvar Alterações</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedLists.size} lista(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os flashcards das listas selecionadas também serão excluídos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isBulkDeleting ? 'Excluindo...' : `Excluir ${selectedLists.size} lista(s)`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Folder Language Settings Dialog */}
        <Dialog open={folderSettingsOpen} onOpenChange={setFolderSettingsOpen}>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Idiomas da Pasta
              </DialogTitle>
              <DialogDescription>
                Defina o idioma padrão para novas listas criadas nesta pasta.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="py-4">
                <ListStudyTypeSelector
                  value={folderSettings}
                  onChange={setFolderSettings}
                />
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFolderSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveFolderSettings} disabled={isSavingFolderSettings}>
                {isSavingFolderSettings ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Folder;
