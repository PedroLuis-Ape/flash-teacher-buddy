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

patchFile("src/hooks/useFavorites.ts", [
  {
    label: "pagination import",
    search: `import { supabase } from '@/integrations/supabase/client';\n`,
    replacement: `import { supabase } from '@/integrations/supabase/client';\nimport { fetchAllSupabaseRows } from '@/lib/fetchAllSupabaseRows';\n`,
  },
  {
    label: "scoped favorites pagination",
    search: `  const { data, error } = await (supabase as any).rpc('get_scoped_flashcard_favorites', {\n    p_list_id: scope.listId ?? null,\n    p_collection_id: scope.collectionId ?? null,\n    p_folder_id: scope.folderId ?? null,\n    p_institution_id: scope.institutionId ?? null,\n  });\n  if (error) throw error;\n  const seen = new Set<string>();\n  for (const row of (data ?? []) as Array<{ group_id: string }>) {\n`,
    replacement: `  const data = await fetchAllSupabaseRows<{ group_id: string }>((from, to) =>\n    (supabase as any)\n      .rpc('get_scoped_flashcard_favorites', {\n        p_list_id: scope.listId ?? null,\n        p_collection_id: scope.collectionId ?? null,\n        p_folder_id: scope.folderId ?? null,\n        p_institution_id: scope.institutionId ?? null,\n      })\n      .range(from, to),\n  );\n  const seen = new Set<string>();\n  for (const row of data) {\n`,
  },
  {
    label: "general favorites pagination",
    search: `    const { data, error } = await supabase\n      .from('user_favorites')\n      .select('resource_id')\n      .eq('user_id', userId)\n      .eq('resource_type', resourceType);\n\n    if (error) throw error;\n    return data?.map((favorite) => favorite.resource_id) ?? [];\n`,
    replacement: `    const data = await fetchAllSupabaseRows<{ resource_id: string }>((from, to) =>\n      (supabase as any)\n        .from('user_favorites')\n        .select('resource_id')\n        .eq('user_id', userId)\n        .eq('resource_type', resourceType)\n        .order('resource_id', { ascending: true })\n        .range(from, to),\n    );\n\n    return data.map((favorite) => favorite.resource_id);\n`,
  },
]);

patchFile("src/hooks/useRedList.ts", [
  {
    label: "pagination import",
    search: `import { supabase } from '@/integrations/supabase/client';\n`,
    replacement: `import { supabase } from '@/integrations/supabase/client';\nimport { fetchAllSupabaseRows } from '@/lib/fetchAllSupabaseRows';\n`,
  },
  {
    label: "global red list pagination",
    search: `    const { data, error } = await supabase\n      .from('user_red_list' as any)\n      .select('flashcard_id')\n      .eq('user_id', userId);\n\n    if (error) throw error;\n    return (data as any[])?.map((r: any) => r.flashcard_id) ?? [];\n`,
    replacement: `    const data = await fetchAllSupabaseRows<{ flashcard_id: string }>((from, to) =>\n      (supabase as any)\n        .from('user_red_list')\n        .select('flashcard_id')\n        .eq('user_id', userId)\n        .order('flashcard_id', { ascending: true })\n        .range(from, to),\n    );\n\n    return data.map((row) => row.flashcard_id);\n`,
  },
  {
    label: "scoped red list pagination",
    search: `  const { data, error } = await (supabase as any).rpc('get_scoped_flashcard_red_list', {\n    p_list_id: listScope,\n    p_collection_id: null,\n    p_folder_id: null,\n    p_institution_id: null,\n  });\n  if (error) throw error;\n  const seen = new Set<string>();\n  for (const row of (data ?? []) as Array<{ group_id: string }>) {\n`,
    replacement: `  const data = await fetchAllSupabaseRows<{ group_id: string }>((from, to) =>\n    (supabase as any)\n      .rpc('get_scoped_flashcard_red_list', {\n        p_list_id: listScope,\n        p_collection_id: null,\n        p_folder_id: null,\n        p_institution_id: null,\n      })\n      .range(from, to),\n  );\n  const seen = new Set<string>();\n  for (const row of data) {\n`,
  },
]);

console.log("Status pagination patch applied.");
