import { readFileSync, writeFileSync } from "node:fs";

function patchFile(path, patches) {
  let source = readFileSync(path, "utf8");
  for (const { label, search, replacement } of patches) {
    const count = source.split(search).length - 1;
    if (count !== 1) throw new Error(`${path}: ${label} expected once, found ${count}`);
    source = source.replace(search, replacement);
  }
  writeFileSync(path, source, "utf8");
}

patchFile("src/features/export/folderExport.ts", [
  {
    label: "pagination import",
    search: `import { supabase } from '@/integrations/supabase/client';\n`,
    replacement: `import { supabase } from '@/integrations/supabase/client';\nimport { fetchAllSupabaseRows } from '@/lib/fetchAllSupabaseRows';\n`,
  },
  {
    label: "folder export folders pagination",
    search: `async function loadFolders(folderIds: string[]): Promise<FolderRow[]> {\n  const { data, error } = await (supabase.from('folders') as any)\n    .select('id, title, description, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled')\n    .in('id', folderIds)\n    .is('deleted_at', null);\n\n  if (error) throw error;\n  return (data ?? []) as FolderRow[];\n}\n`,
    replacement: `async function loadFolders(folderIds: string[]): Promise<FolderRow[]> {\n  const result: FolderRow[] = [];\n  for (const ids of chunk(folderIds, QUERY_CHUNK_SIZE)) {\n    const rows = await fetchAllSupabaseRows<FolderRow>((from, to) =>\n      (supabase.from('folders') as any)\n        .select('id, title, description, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled')\n        .in('id', ids)\n        .is('deleted_at', null)\n        .order('id', { ascending: true })\n        .range(from, to),\n    );\n    result.push(...rows);\n  }\n  return result;\n}\n`,
  },
  {
    label: "folder export lists pagination",
    search: `async function loadLists(folderIds: string[]): Promise<ListRow[]> {\n  const result: ListRow[] = [];\n  for (const ids of chunk(folderIds, QUERY_CHUNK_SIZE)) {\n    const { data, error } = await (supabase.from('lists') as any)\n      .select('id, folder_id, title, description, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, primary_side, order_index, created_at')\n      .in('folder_id', ids)\n      .is('deleted_at', null)\n      .order('order_index', { ascending: true })\n      .order('created_at', { ascending: true });\n\n    if (error) throw error;\n    result.push(...((data ?? []) as ListRow[]));\n  }\n  return result;\n}\n`,
    replacement: `async function loadLists(folderIds: string[]): Promise<ListRow[]> {\n  const result: ListRow[] = [];\n  for (const ids of chunk(folderIds, QUERY_CHUNK_SIZE)) {\n    const rows = await fetchAllSupabaseRows<ListRow>((from, to) =>\n      (supabase.from('lists') as any)\n        .select('id, folder_id, title, description, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled, primary_side, order_index, created_at')\n        .in('folder_id', ids)\n        .is('deleted_at', null)\n        .order('order_index', { ascending: true })\n        .order('created_at', { ascending: true })\n        .order('id', { ascending: true })\n        .range(from, to),\n    );\n    result.push(...rows);\n  }\n  return result;\n}\n`,
  },
]);

console.log("Export pagination patch applied.");
