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

patchFile("src/pages/ListDetail.tsx", [
  {
    label: "pagination import",
    search: `import { supabase } from "@/integrations/supabase/client";\n`,
    replacement: `import { supabase } from "@/integrations/supabase/client";\nimport { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";\n`,
  },
  {
    label: "all flashcards query",
    search: `      const { data: { session } } = await supabase.auth.getSession();\n      \n      if (!session) {\n        const { data, error } = await supabase.rpc('get_portal_flashcards', { \n          _list_id: id \n        });\n        if (error) throw error;\n        return data as Flashcard[];\n      }\n      \n      const { data, error } = await supabase\n        .from("flashcards")\n        .select("*")\n        .eq("list_id", id)\n        .is("deleted_at", null)\n        .order("created_at", { ascending: true })\n        .order("id", { ascending: true });\n      \n      if (error) throw error;\n      return data as Flashcard[];\n`,
    replacement: `      const { data: { session } } = await supabase.auth.getSession();\n\n      if (!session) {\n        return fetchAllSupabaseRows<Flashcard>((from, to) =>\n          (supabase as any)\n            .rpc('get_portal_flashcards', { _list_id: id })\n            .range(from, to),\n        );\n      }\n\n      return fetchAllSupabaseRows<Flashcard>((from, to) =>\n        (supabase as any)\n          .from("flashcards")\n          .select("*")\n          .eq("list_id", id)\n          .is("deleted_at", null)\n          .order("created_at", { ascending: true })\n          .order("id", { ascending: true })\n          .range(from, to),\n      );\n`,
  },
]);

patchFile("src/pages/Study.tsx", [
  {
    label: "pagination import",
    search: `import { supabase } from "@/integrations/supabase/client";\n`,
    replacement: `import { supabase } from "@/integrations/supabase/client";\nimport { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";\n`,
  },
  {
    label: "public cards pagination",
    search: `    if (isListRoute && !session) {\n      const { data, error } = await supabase.rpc('get_portal_flashcards', { \n        _list_id: resolvedId \n      });\n\n      if (error) {\n        console.error("Erro ao carregar flashcards:", error);\n        toast.error("Erro ao carregar flashcards");\n        setLoading(false);\n        return;\n      }\n\n      if (!data || data.length === 0) {\n        toast.error("Esta lista não possui flashcards");\n        setLoading(false);\n        return;\n      }\n\n      const grouped = prepareLayeredStudyDeck(data as any[]);\n      const shuffled = order === "random" ? shuffleArray([...grouped]) : grouped;\n      setFlashcards(shuffled as Flashcard[]);\n      setLoading(false);\n      return;\n    }\n`,
    replacement: `    if (isListRoute && !session) {\n      const data = await fetchAllSupabaseRows<Flashcard>((from, to) =>\n        (supabase as any)\n          .rpc('get_portal_flashcards', { _list_id: resolvedId })\n          .range(from, to),\n      );\n\n      if (data.length === 0) {\n        toast.error("Esta lista não possui flashcards");\n        setLoading(false);\n        return;\n      }\n\n      const grouped = prepareLayeredStudyDeck(data as any[]);\n      const shuffled = order === "random" ? shuffleArray([...grouped]) : grouped;\n      setFlashcards(shuffled as Flashcard[]);\n      setLoading(false);\n      return;\n    }\n`,
  },
  {
    label: "cards promise",
    search: `    const cardsPromise = supabase\n      .from("flashcards")\n      .select("*")\n      .eq(queryColumn, resolvedId)\n      .is("deleted_at", null);\n`,
    replacement: `    const cardsPromise = fetchAllSupabaseRows<Flashcard>((from, to) =>\n      (supabase as any)\n        .from("flashcards")\n        .select("*")\n        .eq(queryColumn, resolvedId)\n        .is("deleted_at", null)\n        .order("created_at", { ascending: true })\n        .order("id", { ascending: true })\n        .range(from, to),\n    );\n`,
  },
  {
    label: "cards result handling",
    search: `    const [cardsResult, listResult] = await Promise.all([cardsPromise, listPromise]);\n\n    if (cardsResult.error) {\n      toast.error("Erro ao carregar flashcards");\n      navigate(isListRoute ? \`/list/${'${resolvedId}'}\` : (isPublicRoute ? \`/portal/collection/${'${resolvedId}'}\` : "/"));\n      return;\n    }\n\n    if (!cardsResult.data || cardsResult.data.length === 0) {\n`,
    replacement: `    const [cardsData, listResult] = await Promise.all([cardsPromise, listPromise]);\n\n    if (cardsData.length === 0) {\n`,
  },
  {
    label: "cards data use",
    search: `    const studyableCards = prepareLayeredStudyDeck(cardsResult.data as any[]);\n`,
    replacement: `    const studyableCards = prepareLayeredStudyDeck(cardsData as any[]);\n`,
  },
]);

console.log("Card pagination patch applied.");
