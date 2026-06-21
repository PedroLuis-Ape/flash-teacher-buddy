import { supabase } from "@/integrations/supabase/client";
import {
  glossaryEntryIdentity,
  normalizeGlossaryValue,
  type GlossaryTransferEntry,
} from "@/features/study/lib/glossaryTransfer";
import type { BulkGlossaryReport, BulkGlossaryRequest } from "./bulkGlossary";

interface ExistingGlossaryRow {
  id: string;
  list_id: string;
  original_text: string;
  translated_text: string;
  note: string | null;
  side: "A" | "B";
  is_active: boolean;
}

const QUERY_CHUNK = 100;
const INSERT_CHUNK = 250;

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function uniqueEntries(entries: readonly GlossaryTransferEntry[]): GlossaryTransferEntry[] {
  const byIdentity = new Map<string, GlossaryTransferEntry>();
  entries.forEach((entry) => byIdentity.set(glossaryEntryIdentity(entry), entry));
  return Array.from(byIdentity.values());
}

async function loadTargetListIds(request: BulkGlossaryRequest): Promise<string[]> {
  let query = supabase
    .from("lists")
    .select("id")
    .in("folder_id", request.folderIds)
    .is("deleted_at", null);
  if (request.turmaId) query = query.eq("class_id", request.turmaId);
  const { data, error } = await query;
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.id)));
}

async function loadExisting(listIds: readonly string[]): Promise<ExistingGlossaryRow[]> {
  const rows: ExistingGlossaryRow[] = [];
  for (const listChunk of chunks(listIds, QUERY_CHUNK)) {
    const { data, error } = await supabase
      .from("list_glossary")
      .select("id, list_id, original_text, translated_text, note, side, is_active")
      .in("list_id", listChunk);
    if (error) throw error;
    rows.push(...((data ?? []) as ExistingGlossaryRow[]));
  }
  return rows;
}

async function buildPlan(request: BulkGlossaryRequest) {
  const entries = uniqueEntries(request.entries);
  const listIds = await loadTargetListIds(request);
  if (listIds.length === 0) throw new Error("As pastas selecionadas não possuem listas ativas.");
  const applications = entries.length * listIds.length;
  if (applications > 100000) throw new Error("A operação excede 100.000 aplicações. Divida o glossário ou selecione menos pastas.");

  const existing = await loadExisting(listIds);
  const exact = new Set(existing.map((row) => `${row.list_id}|${glossaryEntryIdentity(row)}`));
  const termLayers = new Set(existing.map((row) => `${row.list_id}|${row.side}|${normalizeGlossaryValue(row.original_text)}`));
  const inserts: Array<GlossaryTransferEntry & { list_id: string }> = [];
  let exactExisting = 0;
  let alternativeLayers = 0;

  for (const listId of listIds) {
    for (const entry of entries) {
      const identity = `${listId}|${glossaryEntryIdentity(entry)}`;
      if (exact.has(identity)) {
        exactExisting += 1;
        continue;
      }
      if (termLayers.has(`${listId}|${entry.side}|${normalizeGlossaryValue(entry.original_text)}`)) {
        alternativeLayers += 1;
      }
      inserts.push({ ...entry, list_id: listId });
    }
  }

  return { entries, listIds, applications, inserts, exactExisting, alternativeLayers };
}

function reportFromPlan(request: BulkGlossaryRequest, plan: Awaited<ReturnType<typeof buildPlan>>, dryRun: boolean, inserted = plan.inserts.length): BulkGlossaryReport {
  return {
    success: true,
    dry_run: dryRun,
    requires_confirmation: dryRun && plan.exactExisting > 0,
    selected_folders: new Set(request.folderIds).size,
    target_lists: plan.listIds.length,
    glossary_entries: plan.entries.length,
    planned_applications: plan.applications,
    inserted,
    updated: 0,
    skipped: plan.applications - inserted,
    exact_existing: plan.exactExisting,
    alternative_layers: plan.alternativeLayers,
  };
}

export async function previewBulkGlossaryImport(request: BulkGlossaryRequest): Promise<BulkGlossaryReport> {
  return reportFromPlan(request, await buildPlan(request), true);
}

export async function applyBulkGlossaryImport(request: BulkGlossaryRequest, confirmExisting: boolean): Promise<BulkGlossaryReport> {
  const plan = await buildPlan(request);
  if (plan.exactExisting > 0 && !confirmExisting) return reportFromPlan(request, plan, true);

  const insertedIds: string[] = [];
  try {
    for (const insertChunk of chunks(plan.inserts, INSERT_CHUNK)) {
      const { data, error } = await supabase
        .from("list_glossary")
        .insert(insertChunk as any)
        .select("id");
      if (error) throw error;
      insertedIds.push(...((data ?? []) as Array<{ id: string }>).map((row) => row.id));
    }
  } catch (error) {
    for (const idChunk of chunks(insertedIds, INSERT_CHUNK)) {
      await supabase.from("list_glossary").delete().in("id", idChunk);
    }
    throw error;
  }

  return reportFromPlan(request, plan, false, insertedIds.length);
}
