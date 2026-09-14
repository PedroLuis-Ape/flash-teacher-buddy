import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateEmbeddedListDialog, type EmbeddedSourceListOption } from "./CreateEmbeddedListDialog";
import { EmbeddedListManagerDialog } from "./EmbeddedListManagerDialog";

interface FolderEmbeddedListRow extends EmbeddedSourceListOption {
  description?: string | null;
  source_count?: number;
  system_kind?: "user" | "attention_points" | "reinforcement";
}

interface FolderEmbeddedListsPanelProps {
  folderId: string;
}

export function FolderEmbeddedListsPanel({ folderId }: FolderEmbeddedListsPanelProps) {
  const { user } = useAuthUser();
  const [lists, setLists] = useState<FolderEmbeddedListRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);

  const reload = useCallback(async () => {
    if (!user?.id) return;

    const { data: folder } = await supabase
      .from("folders")
      .select("owner_id,system_kind")
      .eq("id", folderId)
      .is("deleted_at", null)
      .maybeSingle();

    const ownerCanManage = Boolean(
      folder?.owner_id === user.id
      && folder?.system_kind !== "attention_points"
      && folder?.system_kind !== "reinforcement",
    );
    setCanManage(ownerCanManage);
    if (!ownerCanManage) return;

    try {
      const rows = await fetchAllSupabaseRows<FolderEmbeddedListRow>((from, to) =>
        (supabase as any)
          .rpc("get_lists_with_card_counts", { _folder_id: folderId })
          .range(from, to),
      );
      setLists(rows);
      setSchemaReady(rows.length === 0 || Object.prototype.hasOwnProperty.call(rows[0], "is_embedded"));
    } catch (error) {
      console.warn("Embedded-list panel unavailable:", error);
      setSchemaReady(false);
    }
  }, [folderId, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const embeddedLists = useMemo(() => lists.filter((list) => list.is_embedded), [lists]);

  if (!canManage) return null;

  if (!schemaReady) {
    return (
      <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
        Listas combinadas ficam disponíveis quando a migration de incorporação estiver aplicada.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3" data-testid="folder-embedded-lists-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Listas combinadas</p>
            <Badge variant="secondary">{embeddedLists.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Estude cards de várias listas juntos sem duplicar ou mover os originais.
          </p>
        </div>
        <CreateEmbeddedListDialog
          folderId={folderId}
          lists={lists}
          onCreated={async () => {
            await reload();
          }}
        />
      </div>

      {embeddedLists.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {embeddedLists.map((list) => (
            <div key={list.id} className="flex min-w-0 items-center gap-2 rounded-xl border bg-card p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{list.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {list.card_count ?? 0} {(list.card_count ?? 0) === 1 ? "card" : "cards"}
                  {typeof list.source_count === "number" ? ` · ${list.source_count} fonte(s)` : ""}
                </p>
              </div>
              <EmbeddedListManagerDialog
                listId={list.id}
                title={list.title}
                sourceLists={lists}
                onChanged={reload}
                trigger={(
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" title="Gerenciar cards incorporados" aria-label={`Gerenciar lista combinada ${list.title}`}>
                    <Link2 className="h-4 w-4" />
                  </Button>
                )}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
