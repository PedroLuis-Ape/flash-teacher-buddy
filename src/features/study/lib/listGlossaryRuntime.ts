import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import type { AccountGlossaryEntry } from "./accountGlossaryTypes";

export type ListGlossaryRuntimeSource = "rpc-v2" | "rpc-v1" | "direct";

export interface ListGlossaryRuntimeResult {
  folderId: string;
  glossary: AccountGlossaryEntry[];
  source: ListGlossaryRuntimeSource;
  recoveredFrom?: string[];
}

interface FolderGlossaryRuntimeRow {
  id: string;
  owner_id: string;
  original_text: string;
  primary_translation: string;
  alternative_translations?: string[] | null;
  note?: string | null;
  side: "A" | "B";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
}

function isPermissionError(error: unknown): boolean {
  const combined = `${errorCode(error)} ${errorMessage(error)}`;
  return /42501|401|403|jwt|permission denied|not authorized|não autorizado|sem permissão/iu.test(combined);
}

function describeFailure(label: string, error: unknown): string {
  const code = errorCode(error).trim();
  const message = errorMessage(error).trim() || "erro desconhecido";
  return code ? `${label} (${code}): ${message}` : `${label}: ${message}`;
}

function normalizeRpcRows(data: unknown): AccountGlossaryEntry[] {
  return Array.isArray(data) ? data as AccountGlossaryEntry[] : [];
}

function mapDirectRows(rows: FolderGlossaryRuntimeRow[]): AccountGlossaryEntry[] {
  return rows.map((entry) => ({
    id: entry.id,
    owner_id: entry.owner_id,
    original_text: entry.original_text,
    translated_text: [entry.primary_translation, ...(entry.alternative_translations ?? [])]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(", "),
    note: entry.note ?? null,
    side: entry.side,
    is_active: entry.is_active,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }));
}

async function loadFolderId(listId: string): Promise<string> {
  const { data, error } = await supabase
    .from("lists")
    .select("folder_id")
    .eq("id", listId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.folder_id) throw new Error("A lista não pertence a uma pasta válida.");
  return data.folder_id as string;
}

async function loadDirectFolderGlossary(folderId: string): Promise<AccountGlossaryEntry[]> {
  const rows = await fetchAllSupabaseRows<FolderGlossaryRuntimeRow>((from, to) =>
    (supabase as any)
      .from("folder_glossary")
      .select(
        "id, owner_id, original_text, primary_translation, alternative_translations, note, side, is_active, created_at, updated_at",
      )
      .eq("folder_id", folderId)
      .eq("is_active", true)
      .order("original_text", { ascending: true })
      .order("side", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  return mapDirectRows(rows);
}

/**
 * Canonical read path used by study screens.
 *
 * The folder glossary is never treated as empty merely because one RPC failed.
 * We try the current RPC, the compatible RPC, then a paginated RLS-protected
 * table read. Permission failures remain fatal and are never disguised as an
 * empty glossary.
 */
export async function loadListGlossaryRuntime(listId: string): Promise<ListGlossaryRuntimeResult> {
  const folderId = await loadFolderId(listId);
  const failures: string[] = [];

  const v2 = await (supabase as any).rpc("get_folder_glossary_for_list_v2", {
    _list_id: listId,
  });
  if (!v2.error) {
    return { folderId, glossary: normalizeRpcRows(v2.data), source: "rpc-v2" };
  }
  if (isPermissionError(v2.error)) throw v2.error;
  failures.push(describeFailure("RPC v2", v2.error));

  const v1 = await (supabase as any).rpc("get_folder_glossary_for_list_v1", {
    _list_id: listId,
  });
  if (!v1.error) {
    return {
      folderId,
      glossary: normalizeRpcRows(v1.data),
      source: "rpc-v1",
      recoveredFrom: failures,
    };
  }
  if (isPermissionError(v1.error)) throw v1.error;
  failures.push(describeFailure("RPC v1", v1.error));

  try {
    return {
      folderId,
      glossary: await loadDirectFolderGlossary(folderId),
      source: "direct",
      recoveredFrom: failures,
    };
  } catch (directError) {
    if (isPermissionError(directError)) throw directError;
    failures.push(describeFailure("leitura direta", directError));
    throw new Error(
      "O glossário da pasta existe, mas não pôde ser carregado no estudo. "
      + "Nenhum dado foi apagado. Detalhes: "
      + failures.join(" | "),
    );
  }
}
