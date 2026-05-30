import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UndoItemType = "folder" | "list" | "flashcard";

export interface UndoItem {
  id: string;
  type: UndoItemType;
  title?: string;
}

const TYPE_LABEL: Record<UndoItemType, string> = {
  folder: "Pasta",
  list: "Lista",
  flashcard: "Card",
};

const RPC_BY_TYPE: Record<UndoItemType, { name: string; param: string }> = {
  folder: { name: "restore_folder", param: "p_folder_id" },
  list: { name: "restore_list", param: "p_list_id" },
  flashcard: { name: "restore_flashcard", param: "p_flashcard_id" },
};

const UNDO_DURATION_MS = 120_000; // 2 minutes

async function restoreOne(item: UndoItem, userId: string): Promise<boolean> {
  const cfg = RPC_BY_TYPE[item.type];
  try {
    const { data, error } = await supabase.rpc(cfg.name as any, {
      [cfg.param]: item.id,
      p_user_id: userId,
    } as any);
    if (error) throw error;
    const result = data as any;
    if (result && result.success === false) return false;
    return true;
  } catch (err) {
    console.error(`[deleteUndo] failed to restore ${item.type}:`, err);
    return false;
  }
}

/**
 * Toast with "Desfazer" for a single soft-deleted item.
 * Lasts 2 minutes. Restores via the matching restore_* RPC.
 */
export function showUndoDeleteToast(
  item: UndoItem,
  onRestored?: () => void | Promise<void>,
): void {
  const label = TYPE_LABEL[item.type];
  const titlePart = item.title ? `: "${item.title}"` : "";
  toast(`${label} enviado para a lixeira${titlePart}.`, {
    duration: UNDO_DURATION_MS,
    action: {
      label: "Desfazer",
      onClick: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast.error("Sessão expirada. Restaure pela lixeira.");
            return;
          }
          const ok = await restoreOne(item, session.user.id);
          if (!ok) {
            toast.error("Não foi possível restaurar.");
            return;
          }
          toast.success("✅ Item restaurado!");
          await onRestored?.();
        } catch (err: any) {
          toast.error("Erro ao restaurar: " + (err?.message || ""));
        }
      },
    },
  });
}

/**
 * Toast with "Desfazer" for many recently soft-deleted items.
 * Restores in chunks to keep the UI responsive.
 */
export function showBulkUndoDeleteToast(
  items: UndoItem[],
  onRestored?: () => void | Promise<void>,
): void {
  if (!items || items.length === 0) return;
  const count = items.length;
  toast(`${count} ${count === 1 ? "item enviado" : "itens enviados"} para a lixeira.`, {
    duration: UNDO_DURATION_MS,
    action: {
      label: "Desfazer",
      onClick: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast.error("Sessão expirada. Restaure pela lixeira.");
            return;
          }
          const userId = session.user.id;
          const CHUNK = 25;
          let ok = 0;
          let fail = 0;
          const progressId = toast.loading(`Restaurando 0/${count}...`);
          for (let i = 0; i < items.length; i += CHUNK) {
            const chunk = items.slice(i, i + CHUNK);
            const results = await Promise.all(
              chunk.map((it) => restoreOne(it, userId)),
            );
            results.forEach((r) => (r ? ok++ : fail++));
            toast.loading(`Restaurando ${ok + fail}/${count}...`, { id: progressId });
            // yield to UI
            await new Promise((r) => setTimeout(r, 0));
          }
          toast.dismiss(progressId);
          if (fail === 0) {
            toast.success(`✅ ${ok} ${ok === 1 ? "item restaurado" : "itens restaurados"}!`);
          } else if (ok === 0) {
            toast.error(`❌ Não foi possível restaurar (${fail}).`);
          } else {
            toast.warning(`Restaurados: ${ok}. Falhas: ${fail}.`);
          }
          await onRestored?.();
        } catch (err: any) {
          toast.error("Erro ao restaurar: " + (err?.message || ""));
        }
      },
    },
  });
}