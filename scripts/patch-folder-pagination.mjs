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

patchFile("src/pages/Folder.tsx", [
  {
    label: "pagination import",
    search: `import { supabase } from "@/integrations/supabase/client";\n`,
    replacement: `import { supabase } from "@/integrations/supabase/client";\nimport { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";\n`,
  },
  {
    label: "folder lists pagination",
    search: `      // Use RPC to get lists with card counts in a single query (eliminates N+1)\n      if (session) {\n        const { data, error } = await supabase.rpc('get_lists_with_card_counts', { \n          _folder_id: id \n        });\n        if (error) throw error;\n        setLists((data as any[]) || []);\n      } else {\n        // Public portal access - use RPC with counts\n        const { data, error } = await supabase.rpc('get_portal_lists_with_counts', { \n          _folder_id: id \n        });\n        \n        if (error) {\n          console.error("Erro RPC get_portal_lists_with_counts:", error);\n        }\n        \n        setLists((data as any[]) || []);\n      }\n`,
    replacement: `      // Read every RPC page instead of accepting PostgREST's 1,000-row cap.\n      if (session) {\n        const data = await fetchAllSupabaseRows<ListType>((from, to) =>\n          (supabase as any)\n            .rpc('get_lists_with_card_counts', { _folder_id: id })\n            .range(from, to),\n        );\n        setLists(data);\n      } else {\n        const data = await fetchAllSupabaseRows<ListType>((from, to) =>\n          (supabase as any)\n            .rpc('get_portal_lists_with_counts', { _folder_id: id })\n            .range(from, to),\n        );\n        setLists(data);\n      }\n`,
  },
]);

patchFile("src/components/ListSequenceDialog.tsx", [
  {
    label: "pagination import",
    search: `import { supabase } from '@/integrations/supabase/client';\n`,
    replacement: `import { supabase } from '@/integrations/supabase/client';\nimport { fetchAllSupabaseRows } from '@/lib/fetchAllSupabaseRows';\n`,
  },
  {
    label: "sequence lists pagination",
    search: `      const { data, error } = await supabase\n        .from('lists')\n        .select('id, title, order_index, created_at')\n        .eq('folder_id', folderId)\n        .is('deleted_at', null);\n\n      if (error) throw error;\n      return { visible: true, lists: sortLists((data ?? []) as OrderedList[]) };\n`,
    replacement: `      const data = await fetchAllSupabaseRows<OrderedList>((from, to) =>\n        (supabase as any)\n          .from('lists')\n          .select('id, title, order_index, created_at')\n          .eq('folder_id', folderId)\n          .is('deleted_at', null)\n          .order('created_at', { ascending: true })\n          .order('id', { ascending: true })\n          .range(from, to),\n      );\n\n      return { visible: true, lists: sortLists(data) };\n`,
  },
]);

patchFile("src/features/study/lib/folderGlossarySyncApi.ts", [
  {
    label: "pagination import",
    search: `import { supabase } from "@/integrations/supabase/client";\n`,
    replacement: `import { supabase } from "@/integrations/supabase/client";\nimport { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";\n`,
  },
  {
    label: "sync list pagination",
    search: `  const { data: lists, error: listError } = await supabase\n    .from("lists")\n    .select("id")\n    .eq("folder_id", folderId)\n    .is("deleted_at", null)\n    .order("created_at", { ascending: true });\n  if (listError) throw listError;\n\n  const listIds = (lists ?? []).map((row) => row.id);\n`,
    replacement: `  const lists = await fetchAllSupabaseRows<{ id: string }>((from, to) =>\n    (supabase as any)\n      .from("lists")\n      .select("id")\n      .eq("folder_id", folderId)\n      .is("deleted_at", null)\n      .order("created_at", { ascending: true })\n      .order("id", { ascending: true })\n      .range(from, to),\n  );\n\n  const listIds = lists.map((row) => row.id);\n`,
  },
]);

console.log("Folder pagination patch applied.");
