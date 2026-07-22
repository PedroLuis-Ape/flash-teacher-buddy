import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FolderSync, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CLASS_GLOSSARY_QUERY_KEY,
  loadClassGlossaryLists,
} from "@/features/classroom/lib/classGlossary";
import { FOLDER_GLOSSARY_QUERY_KEY } from "@/hooks/useFolderGlossary";
import { publishFolderGlossaryRefresh } from "@/features/study/lib/folderGlossaryRefresh";

interface Props {
  turmaId: string;
  turmaTitle: string;
  storageFolderId: string;
}

export function ClassGlossarySyncCard({ turmaId, turmaTitle, storageFolderId }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<{ at: string; lists: number } | null>(null);

  const forceSync = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const lists = await loadClassGlossaryLists(turmaId);
      publishFolderGlossaryRefresh({
        folderId: storageFolderId,
        syncedAt: new Date().toISOString(),
        source: "manual",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CLASS_GLOSSARY_QUERY_KEY, refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: FOLDER_GLOSSARY_QUERY_KEY, refetchType: "active" }),
      ]);
      const next = { at: new Date().toISOString(), lists: lists.length };
      setLastSync(next);
      toast.success(`${lists.length.toLocaleString("pt-BR")} lista(s) da turma foram atualizadas para o glossário atual.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar o glossário da turma.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        {lastSync
          ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          : <FolderSync className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
        <div className="min-w-0">
          <p className="font-medium">Sincronizar materiais da turma</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Força as sessões de “{turmaTitle}” a recarregar o glossário exclusivo da turma. Nenhuma entrada é copiada para pastas pessoais.
          </p>
          {lastSync && (
            <p className="mt-2 text-xs text-muted-foreground">
              Última sincronização: {new Date(lastSync.at).toLocaleString("pt-BR")} · {lastSync.lists.toLocaleString("pt-BR")} lista(s)
            </p>
          )}
        </div>
      </div>
      <Button type="button" variant="outline" className="shrink-0" onClick={() => void forceSync()} disabled={busy}>
        {busy
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <FolderSync className="mr-2 h-4 w-4" />}
        {busy ? "Sincronizando..." : "Sincronizar turma inteira"}
      </Button>
    </div>
  );
}
