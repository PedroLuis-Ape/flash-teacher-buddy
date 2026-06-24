import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FolderSync, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  inspectAndPublishFolderGlossaryRefresh,
  readFolderGlossaryRefreshReport,
  type FolderGlossaryRefreshReport,
} from "@/features/study/lib/folderGlossaryRefresh";
import { FOLDER_GLOSSARY_QUERY_KEY } from "@/hooks/useFolderGlossary";

interface Props {
  folderId: string;
  folderTitle: string;
}

export function FolderGlossaryForceSyncCard({ folderId, folderTitle }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<FolderGlossaryRefreshReport | null>(() =>
    readFolderGlossaryRefreshReport(folderId));

  const forceSync = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await inspectAndPublishFolderGlossaryRefresh(folderId);
      await queryClient.invalidateQueries({
        queryKey: FOLDER_GLOSSARY_QUERY_KEY,
        refetchType: "active",
      });
      await queryClient.refetchQueries({
        queryKey: FOLDER_GLOSSARY_QUERY_KEY,
        type: "active",
      });
      setReport(next);
      toast.success(
        `${next.lists ?? 0} lista(s) sincronizada(s) com ${next.activeEntries ?? 0} termo(s) ativo(s).`,
      );
    } catch (error) {
      toast.error(error instanceof Error
        ? error.message
        : "Não foi possível sincronizar as listas desta pasta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        {report?.source === "manual"
          ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          : <FolderSync className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
        <div className="min-w-0">
          <p className="font-medium">Sincronizar todas as listas</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Força todas as listas de “{folderTitle}” a recarregar o glossário único da pasta. Não cria cópias nem multiplica registros.
          </p>
          {report && (
            <p className="mt-2 text-xs text-muted-foreground">
              Última sincronização: {new Date(report.syncedAt).toLocaleString("pt-BR")}
              {typeof report.lists === "number" && typeof report.activeEntries === "number"
                ? ` · ${report.lists.toLocaleString("pt-BR")} lista(s) · ${report.activeEntries.toLocaleString("pt-BR")} termo(s) ativo(s)`
                : ""}
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        onClick={() => void forceSync()}
        disabled={busy}
      >
        {busy
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <FolderSync className="mr-2 h-4 w-4" />}
        {busy ? "Sincronizando..." : "Sincronizar pasta inteira"}
      </Button>
    </div>
  );
}
