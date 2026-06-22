import { readFile, writeFile } from "node:fs/promises";

const filename = "src/lib/storeEngine.ts";
const source = await readFile(filename, "utf8");

const start = source.indexOf("// Allowed slugs for store");
const end = source.indexOf("/**\n * Fetch user's inventory", start);

if (start === -1 || end === -1) {
  if (source.includes('.eq(\'status\', \'published\')') && source.includes('.eq(\'type\', \'bundle\')')) {
    console.log("storeEngine.ts já está dinâmico.");
    process.exit(0);
  }
  throw new Error("Bloco esperado da whitelist não foi encontrado.");
}

const replacement = `/**
 * Fetch all valid published bundles from Supabase.
 * Package availability is controlled only by the database catalog.
 */
export async function getSkinsCaltalog(): Promise<SkinItem[]> {
  try {
    const { data, error } = await supabase
      .from('public_catalog')
      .select('*')
      .eq('is_active', true)
      .eq('approved', true)
      .eq('status', 'published')
      .eq('type', 'bundle')
      .not('avatar_final', 'is', null)
      .not('card_final', 'is', null)
      .order('price_pitecoin', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).filter((item: any) =>
      typeof item.avatar_final === 'string' && item.avatar_final.trim().length > 0 &&
      typeof item.card_final === 'string' && item.card_final.trim().length > 0
    ) as SkinItem[];
  } catch (error) {
    console.error('[StoreEngine] Error fetching catalog:', error);
    return [];
  }
}

`;

await writeFile(filename, source.slice(0, start) + replacement + source.slice(end), "utf8");
console.log("Whitelist removida e catálogo dinâmico aplicado.");
