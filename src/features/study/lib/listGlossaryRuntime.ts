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

function describeEmptyRpc(label: string): string {
  return `${label}: retornou 0 entradas; validando diretamente a pasta`;
}

function describeIncomplete(label: string, received: number, expected: number): string {
  return `${label}: carregou somente ${received} de ${expected} entradas ativas; tentando outra fonte`;
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

async function loadExpectedActiveCount(folderId: string): Promise<number | null> {
  const response = await (supabase as any).rpc("get_folder_glossary_summary_v2", {
    _folder_id: folderId,
  });
  if (response.error) return null;

  const row = Array.isArray(response.data) ? response.data[0] : response.data;
  const value = Number(row?.active_count);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function loadRpcGlossary(
  functionName: "get_folder_glossary_for_list_v2" | "get_folder_glossary_for_list_v1",
  listId: string,
): Promise<AccountGlossaryEntry[]> {
  return fetchAllSupabaseRows<AccountGlossaryEntry>((from, to) =>
    (supabase as any)
      .rpc(functionName, { _list_id: listId })
      .range(from, to),
  );
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

function hasCompleteCount(rows: AccountGlossaryEntry[], expectedActiveCount: number | null): boolean {
  return expectedActiveCount === null || rows.length >= expectedActiveCount;
}

/**
 * Canonical read path used by study screens.
 *
 * Every RPC result is paginated and checked against the folder summary. A
 * non-empty but truncated response must not be accepted, otherwise the audit
 * can report full coverage while the game receives only part of the glossary.
 *
 * Permission failures remain fatal and are never disguised as an empty glossary.
 */
export async function loadListGlossaryRuntime(listId: string): Promise<ListGlossaryRuntimeResult> {
  const folderId = await loadFolderId(listId);
  const expectedActiveCount = await loadExpectedActiveCount(folderId);
  const failures: string[] = [];

  try {
    const rows = await loadRpcGlossary("get_folder_glossary_for_list_v2", listId);
    if (rows.length > 0 && hasCompleteCount(rows, expectedActiveCount)) {
      return { folderId, glossary: rows, source: "rpc-v2" };
    }
    failures.push(rows.length === 0
      ? describeEmptyRpc("RPC v2")
      : describeIncomplete("RPC v2", rows.length, expectedActiveCount as number));
  } catch (error) {
    if (isPermissionError(error)) throw error;
    failures.push(describeFailure("RPC v2", error));
  }

  try {
    const rows = await loadRpcGlossary("get_folder_glossary_for_list_v1", listId);
    if (rows.length > 0 && hasCompleteCount(rows, expectedActiveCount)) {
      return {
        folderId,
        glossary: rows,
        source: "rpc-v1",
        recoveredFrom: failures,
      };
    }
    failures.push(rows.length === 0
      ? describeEmptyRpc("RPC v1")
      : describeIncomplete("RPC v1", rows.length, expectedActiveCount as number));
  } catch (error) {
    if (isPermissionError(error)) throw error;
    failures.push(describeFailure("RPC v1", error));
  }

  try {
    const rows = await loadDirectFolderGlossary(folderId);
    if (!hasCompleteCount(rows, expectedActiveCount)) {
      throw new Error(describeIncomplete("leitura direta", rows.length, expectedActiveCount as number));
    }
    return {
      folderId,
      glossary: rows,
      source: "direct",
      recoveredFrom: failures,
    };
  } catch (directError) {
    if (isPermissionError(directError)) throw directError;
    failures.push(describeFailure("leitura direta", directError));
    throw new Error(
      "O glossário da pasta existe, mas não pôde ser carregado por inteiro no estudo. "
      + "Nenhum dado foi apagado. Detalhes: "
      + failures.join(" | "),
    );
  }
}
