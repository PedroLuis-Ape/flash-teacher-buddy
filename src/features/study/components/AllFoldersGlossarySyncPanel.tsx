import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderSync, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FolderGlossarySyncDialog } from "./FolderGlossarySyncDialog";
import { syncFolderGlossary, readFolderGlossarySyncStatus } from "@/features/study/lib/folderGlossaryApi";
import { ACCOUNT_GLOSSARY_QUERY_KEY } from "@/hooks/useAccountGlossary";
import { supabase } from "@/integrations/supabase/client";

interface FolderRow { id: string; title: string }

export function AllFoldersGlossarySyncPanel() {
  const queryClient = useQueryClient();
  const [includeCards, setIncludeCards] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusRevision, setStatusRevision] = useState(0);

  useEffect(() => {
    const bump = () => setStatusRevision((value) => value + 1);
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
  }, []);

  const foldersQuery = useQuery({
    queryKey: ["glossary-sync-personal-folders"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Você precisa estar autenticado.");
      const { data, error } = await supabase
        .from("folders")
        .select("id, title")
        .eq("owner_id", user.id)
        .is("class_id", null)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FolderRow[];
    },
    staleTime: 60_000,
  });

  const syncAll = async () => {
    const folders = foldersQuery.data ?? [];
    if (busy || folders.length === 0) return;
    setBusy(true);
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    for (const folder of folders) {
      try {
        const report = await syncFolderGlossary(folder.id, includeCards);
        inserted += report.inserted;
        skipped += report.skipped;
      } catch {
        failed += 1;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ACCOUNT_GLOSSARY_QUERY_KEY });
    setBusy(false);
    setStatusRevision((value) => value + 1);
    if (failed > 0) toast.error(`${failed} pasta(s) falharam; ${inserted} entrada(s) foram adicionadas nas demais.`);
    else toast.success(`Todas as pastas foram sincronizadas: ${inserted} nova(s), ${skipped} já existente(s).`);
  };

  return (
    <Card className="p-4">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <FolderSync className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">Sincronizar pastas com esta caixa</p>
              <p className="text-sm text-muted-foreground">Sincronize uma pasta específica ou todas as pastas pessoais de uma vez.</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{foldersQuery.data?.length ?? 0} pasta(s)</span>
        </summary>

        <div className="mt-4 space-y-4 border-t pt-4">
          <div className="flex items-start gap-2 rounded-lg border p-3">
            <Checkbox id="all-folder-normal-cards" checked={includeCards} onCheckedChange={(value) => setIncludeCards(Boolean(value))} />
            <div>
              <Label htmlFor="all-folder-normal-cards">Também usar cards normais</Label>
              <p className="text-xs text-muted-foreground">Desligado por segurança. Ative somente quando frente e verso devem virar glossário.</p>
            </div>
          </div>

          <Button type="button" onClick={() => void syncAll()} disabled={busy || foldersQuery.isLoading || (foldersQuery.data?.length ?? 0) === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar todas as pastas
          </Button>

          <div className="space-y-2">
            {(foldersQuery.data ?? []).map((folder) => {
              // statusRevision forces a re-read after syncs complete.
              void statusRevision;
              const status = readFolderGlossarySyncStatus(folder.id);
              return (
                <div key={folder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{folder.title}</p>
                    <p className="text-xs text-muted-foreground">{status.lastSyncedAt ? `Sincronizada em ${new Date(status.lastSyncedAt).toLocaleDateString("pt-BR")}` : "Nunca sincronizada manualmente"}</p>
                  </div>
                  <FolderGlossarySyncDialog folderId={folder.id} folderTitle={folder.title} compact />
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </Card>
  );
}
