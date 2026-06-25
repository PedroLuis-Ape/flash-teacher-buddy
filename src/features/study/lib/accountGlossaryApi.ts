import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import type { GlossaryTransferEntry } from "./glossaryTransfer";
import type { AccountGlossaryEntry } from "./accountGlossaryTypes";

export async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Você precisa estar autenticado.");
  return data.user.id;
}

export async function loadOwnAccountGlossary(): Promise<AccountGlossaryEntry[]> {
  const ownerId = await currentUserId();
  return fetchAllSupabaseRows<AccountGlossaryEntry>((from, to) =>
    (supabase as any)
      .from("account_glossary")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

export async function loadAccountGlossaryForList(listId: string) {
  return fetchAllSupabaseRows<AccountGlossaryEntry>((from, to) =>
    (supabase as any)
      .rpc("get_account_glossary_for_list_v1", { _list_id: listId })
      .range(from, to),
  );
}

export async function importAccountGlossary(entries: GlossaryTransferEntry[], dryRun = false) {
  const { data, error } = await (supabase as any).rpc(
    "import_account_glossary_v1",
    { _entries: entries, _dry_run: dryRun },
  );
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function addAccountGlossaryEntry(entry: GlossaryTransferEntry) {
  const ownerId = await currentUserId();
  const { error } = await (supabase as any)
    .from("account_glossary")
    .insert({ ...entry, owner_id: ownerId });
  if (error) throw error;
}

export async function updateAccountGlossaryEntry(id: string, fields: Partial<GlossaryTransferEntry>) {
  const { error } = await (supabase as any)
    .from("account_glossary")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAccountGlossaryEntries(ids: string[]) {
  const chunkSize = 250;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const { error } = await (supabase as any)
      .from("account_glossary")
      .delete()
      .in("id", ids.slice(index, index + chunkSize));
    if (error) throw error;
  }
}
