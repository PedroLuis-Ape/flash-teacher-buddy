import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("embedded source lists contracts", () => {
  const api = read("src/features/library/embeddedLists.ts");
  const dialog = read("src/features/library/EmbeddedListDialogs.tsx");

  it("paginates the source-member RPC so sources after the Supabase row cap are not hidden", () => {
    expect(api).toContain("fetchAllSupabaseRows<EmbeddedListMember>");
    expect(api).toContain('rpc("get_embedded_list_members"');
    expect(api).toContain(".range(from, to)");
  });

  it("shows source lists as compact collapsible rows instead of expanding every card by default", () => {
    expect(dialog).toContain("Listas de origem");
    expect(dialog).toContain("<Collapsible");
    expect(dialog).toContain("<CollapsibleTrigger asChild>");
    expect(dialog).toContain("<CollapsibleContent>");
    expect(dialog).toContain('data-testid="embedded-source-list-groups"');
  });

  it("keeps long source titles readable and bounds each expanded member list", () => {
    expect(dialog).toContain("line-clamp-2 block whitespace-normal break-words");
    expect(dialog).toContain("max-h-72 divide-y overflow-y-auto");
  });

  it("keeps mobile actions touch friendly", () => {
    expect(dialog).toContain("min-h-[44px]");
    expect(dialog).toContain("min-w-[44px]");
  });
});
