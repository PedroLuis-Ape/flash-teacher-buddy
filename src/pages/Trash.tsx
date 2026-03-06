import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, RotateCcw, Folder, FileText, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTrash, TrashItem } from "@/hooks/useTrash";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function daysUntilExpiry(deletedAt: string): number {
  const deleted = new Date(deletedAt);
  const expiry = new Date(deleted.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

const typeIcon = {
  folder: Folder,
  list: FileText,
  flashcard: CreditCard,
};

const typeLabel = {
  folder: "Pasta",
  list: "Lista",
  flashcard: "Card",
};

export default function Trash() {
  const navigate = useNavigate();
  const { items, loading, loadTrash, restoreItem, permanentDelete, emptyTrash } = useTrash();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TrashItem | null>(null);

  useEffect(() => { loadTrash(); }, [loadTrash]);

  const folders = items.filter(i => i.type === "folder");
  const lists = items.filter(i => i.type === "list");
  const flashcards = items.filter(i => i.type === "flashcard");

  const renderItem = (item: TrashItem) => {
    const Icon = typeIcon[item.type];
    const days = daysUntilExpiry(item.deleted_at);

    return (
      <div
        key={`${item.type}-${item.id}`}
        className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl"
      >
        <div className="shrink-0 w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {typeLabel[item.type]}
            </Badge>
            {item.parent_title && (
              <span className="text-[10px] text-muted-foreground truncate">
                em {item.parent_title}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {days > 0 ? `Expira em ${days}d` : "Expirando..."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-primary hover:bg-primary/10"
            onClick={() => restoreItem(item)}
            title="Restaurar"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(item)}
            title="Excluir definitivamente"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderList = (filteredItems: TrashItem[]) => {
    if (filteredItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Trash2 className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Nenhum item na lixeira</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {filteredItems.map(renderItem)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Lixeira</h1>
          <p className="text-xs text-muted-foreground">
            Itens são removidos automaticamente após 7 dias
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setConfirmEmpty(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Esvaziar
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Carregando lixeira..." />
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="all">
              Tudo {items.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{items.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="folders">
              Pastas {folders.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{folders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="lists">
              Listas {lists.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{lists.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="cards">
              Cards {flashcards.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{flashcards.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">{renderList(items)}</TabsContent>
          <TabsContent value="folders">{renderList(folders)}</TabsContent>
          <TabsContent value="lists">{renderList(lists)}</TabsContent>
          <TabsContent value="cards">{renderList(flashcards)}</TabsContent>
        </Tabs>
      )}

      {/* Confirm permanent delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>não pode ser desfeita</strong>. O item será removido para sempre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) permanentDelete(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Excluir para sempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm empty trash */}
      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Esvaziar lixeira?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Todos os {items.length} itens</strong> serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                emptyTrash();
                setConfirmEmpty(false);
              }}
            >
              Esvaziar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
