import { supabase } from "@/integrations/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { loadFolderGlossary } from "@/features/study/lib/folderGlossaryApi";
import {
  analyzeFolderGlossaryCoverageOffThread,
  type CoverageCardRow,
  type CoverageListRow,
  type FolderGlossaryCoverageReport,
} from "@/features/study/lib/folderGlossaryCoverage";
import type { AccountGlossaryEntry } from "@/features/study/lib/accountGlossaryTypes";
import type { FolderGlossaryEntry } from "@/features/study/lib/folderGlossaryTypes";

export const CLASS_GLOSSARY_FOLDER_MARKER = "ape-system:class-glossary:v1";
export const CLASS_GLOSSARY_QUERY_KEY = ["class-glossary"] as const;

const PENDING_CONTEXT_KEY = "ape:pending-class-glossary-context:v1";
const PENDING_CONTEXT_TTL_MS = 5 * 60 * 1000;
const QUERY_CHUNK_SIZE = 50;
const PAGE_SIZE = 1_000;

interface PendingClassContext {
  turmaId: string;
  expiresAt: number;
}

export interface ClassGlossaryStorageFolder {
  id: string;
  title: string;
  owner_id: string;
  class_id: string;
}

export interface ClassGlossaryListRow extends CoverageListRow {
  folder_id: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
}

interface ClassAssignmentRow {
  fonte_tipo: "lista" | "pasta" | "cardset";
  fonte_id: string;
}

function chunk<T>(values: T[], size = QUERY_CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markPendingClassGlossaryContext(turmaId: string): void {
  if (!turmaId) return;
  readStorage()?.setItem(PENDING_CONTEXT_KEY, JSON.stringify({
    turmaId,
    expiresAt: Date.now() + PENDING_CONTEXT_TTL_MS,
  } satisfies PendingClassContext));
}

export function readPendingClassGlossaryContext(): string | null {
  const storage = readStorage();
  const raw = storage?.getItem(PENDING_CONTEXT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingClassContext;
    if (!parsed.turmaId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) {
      storage?.removeItem(PENDING_CONTEXT_KEY);
      return null;
    }
    return parsed.turmaId;
  } catch {
    storage?.removeItem(PENDING_CONTEXT_KEY);
    return null;
  }
}

export function clearPendingClassGlossaryContext(turmaId?: string): void {
  const storage = readStorage();
  if (!storage) return;
  if (!turmaId || readPendingClassGlossaryContext() === turmaId) {
    storage.removeItem(PENDING_CONTEXT_KEY);
  }
}

export async function findClassGlossaryStorageFolder(
  turmaId: string,
): Promise<ClassGlossaryStorageFolder | null> {
  const { data, error } = await (supabase as any)
    .from("folders")
    .select("id,title,owner_id,class_id")
    .eq("class_id", turmaId)
    .eq("description", CLASS_GLOSSARY_FOLDER_MARKER)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ClassGlossaryStorageFolder | null;
}

export async function ensureClassGlossaryStorageFolder(input: {
  turmaId: string;
  turmaTitle: string;
}): Promise<ClassGlossaryStorageFolder> {
  const existing = await findClassGlossaryStorageFolder(input.turmaId);
  if (existing) return existing;

  const [{ data: auth }, turmaResult] = await Promise.all([
    supabase.auth.getUser(),
    (supabase as any)
      .from("turmas")
      .select("id,nome,owner_teacher_id,ativo")
      .eq("id", input.turmaId)
      .maybeSingle(),
  ]);

  if (turmaResult.error) throw turmaResult.error;
  const turma = turmaResult.data as {
    owner_teacher_id?: string;
    ativo?: boolean;
  } | null;
  if (!auth.user || !turma?.owner_teacher_id || turma.ativo === false) {
    throw new Error("Turma inválida ou inativa.");
  }
  if (auth.user.id !== turma.owner_teacher_id) {
    throw new Error("Somente o professor responsável pode iniciar o glossário da turma.");
  }

  const title = `Glossário interno · ${input.turmaTitle.trim() || "Turma"}`;
  const { data, error } = await (supabase as any)
    .from("folders")
    .insert({
      owner_id: turma.owner_teacher_id,
      title,
      description: CLASS_GLOSSARY_FOLDER_MARKER,
      visibility: "class",
      class_id: input.turmaId,
    })
    .select("id,title,owner_id,class_id")
    .single();

  if (!error && data) return data as ClassGlossaryStorageFolder;

  // Uma segunda aba pode ter criado o contêiner entre a leitura e a inserção.
  const recovered = await findClassGlossaryStorageFolder(input.turmaId);
  if (recovered) return recovered;
  throw error ?? new Error("Não foi possível criar a caixa de glossário da turma.");
}

async function loadClassAssignments(turmaId: string): Promise<ClassAssignmentRow[]> {
  return fetchAllSupabaseRows<ClassAssignmentRow>((from, to) =>
    (supabase as any)
      .from("atribuicoes")
      .select("fonte_tipo,fonte_id")
      .eq("turma_id", turmaId)
      .range(from, to),
  );
}

async function fetchListsByIds(ids: string[]): Promise<ClassGlossaryListRow[]> {
  const rows: ClassGlossaryListRow[] = [];
  for (const group of chunk(ids)) {
    const { data, error } = await (supabase as any)
      .from("lists")
      .select("id,title,folder_id,labels_a,labels_b")
      .in("id", group)
      .is("deleted_at", null);
    if (error) throw error;
    rows.push(...((data ?? []) as ClassGlossaryListRow[]));
  }
  return rows;
}

async function fetchListsByFolderIds(ids: string[]): Promise<ClassGlossaryListRow[]> {
  const rows: ClassGlossaryListRow[] = [];
  for (const group of chunk(ids)) {
    const { data, error } = await (supabase as any)
      .from("lists")
      .select("id,title,folder_id,labels_a,labels_b")
      .in("folder_id", group)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    rows.push(...((data ?? []) as ClassGlossaryListRow[]));
  }
  return rows;
}

export async function loadClassGlossaryLists(
  turmaId: string,
): Promise<ClassGlossaryListRow[]> {
  const assignments = await loadClassAssignments(turmaId);
  const directListIds = Array.from(new Set(
    assignments.filter((item) => item.fonte_tipo === "lista").map((item) => item.fonte_id),
  ));
  const folderIds = Array.from(new Set(
    assignments.filter((item) => item.fonte_tipo === "pasta").map((item) => item.fonte_id),
  ));

  const [directLists, folderLists] = await Promise.all([
    directListIds.length > 0 ? fetchListsByIds(directListIds) : Promise.resolve([]),
    folderIds.length > 0 ? fetchListsByFolderIds(folderIds) : Promise.resolve([]),
  ]);

  const unique = new Map<string, ClassGlossaryListRow>();
  for (const list of [...directLists, ...folderLists]) unique.set(list.id, list);
  return Array.from(unique.values()).sort((left, right) => left.title.localeCompare(right.title));
}

export async function isListAssignedToClass(
  turmaId: string,
  listId: string,
): Promise<boolean> {
  const [{ data: list, error: listError }, assignments] = await Promise.all([
    (supabase as any)
      .from("lists")
      .select("id,folder_id")
      .eq("id", listId)
      .is("deleted_at", null)
      .maybeSingle(),
    loadClassAssignments(turmaId),
  ]);
  if (listError) throw listError;
  if (!list) return false;

  return assignments.some((item) =>
    (item.fonte_tipo === "lista" && item.fonte_id === listId)
    || (item.fonte_tipo === "pasta" && item.fonte_id === list.folder_id));
}

async function loadClassCards(listIds: string[]): Promise<CoverageCardRow[]> {
  const result: CoverageCardRow[] = [];
  for (const ids of chunk(listIds)) {
    let offset = 0;
    while (true) {
      const { data, error } = await (supabase as any)
        .from("flashcards")
        .select("id,list_id,term,translation")
        .in("list_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as CoverageCardRow[];
      result.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return result;
}

export async function loadClassGlossaryCoverage(input: {
  turmaId: string;
  storageFolderId: string;
  glossary: FolderGlossaryEntry[];
}): Promise<FolderGlossaryCoverageReport> {
  const lists = await loadClassGlossaryLists(input.turmaId);
  const cards = lists.length > 0 ? await loadClassCards(lists.map((list) => list.id)) : [];
  return analyzeFolderGlossaryCoverageOffThread({
    folderId: input.storageFolderId,
    lists: lists.map<CoverageListRow>((list) => ({ id: list.id, title: list.title })),
    cards,
    glossary: input.glossary,
  });
}

export async function loadClassGlossaryLabels(turmaId: string): Promise<{
  labelA: string;
  labelB: string;
}> {
  const first = (await loadClassGlossaryLists(turmaId))[0];
  return {
    labelA: first?.labels_a?.trim() || "Lado A",
    labelB: first?.labels_b?.trim() || "Lado B",
  };
}

export async function loadClassGlossaryForList(input: {
  turmaId: string;
  listId: string;
}): Promise<{
  glossary: AccountGlossaryEntry[];
  storageFolderId: string | null;
  assigned: boolean;
}> {
  const assigned = await isListAssignedToClass(input.turmaId, input.listId);
  if (!assigned) return { glossary: [], storageFolderId: null, assigned: false };

  const storage = await findClassGlossaryStorageFolder(input.turmaId);
  if (!storage) return { glossary: [], storageFolderId: null, assigned: true };

  const loaded = await loadFolderGlossary(storage.id);
  return {
    assigned: true,
    storageFolderId: storage.id,
    glossary: loaded.entries
      .filter((entry) => entry.is_active)
      .map<AccountGlossaryEntry>((entry) => ({
        id: entry.id,
        owner_id: entry.owner_id,
        original_text: entry.original_text,
        translated_text: [entry.primary_translation, ...(entry.alternative_translations ?? [])]
          .filter(Boolean)
          .join(", "),
        note: entry.note,
        side: entry.side,
        is_active: entry.is_active,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      })),
  };
}
