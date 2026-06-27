import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpecialImportInput } from "@/features/special-import/lib/csvImport";

const mappedService = readFileSync(join(process.cwd(), "src/features/global-import/mappedService.ts"), "utf8");
const atomicExecutor = readFileSync(join(process.cwd(), "src/features/global-import/atomicExecutor.ts"), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260627173000_atomic_super_import_v3.sql"), "utf8");

describe("atomic importer contract", () => {
  it("uses a single orchestration RPC for cards and folder glossaries", () => {
    expect(mappedService).toContain("executeAtomicSuperImport");
    expect(mappedService).not.toContain('"sync_folder_glossaries_from_super_import_v1"');
    expect(atomicExecutor).toContain('"execute_app_piteco_super_import_v3"');
    expect(atomicExecutor).toContain("_card_payload");
    expect(atomicExecutor).toContain("_glossary_payload");
  });

  it("keeps personal and classroom execution inside the same database transaction", () => {
    expect(migration).toContain("import_app_piteco_super_package_v2");
    expect(migration).toContain("import_app_piteco_super_package_to_class_v1");
    expect(migration).toContain("sync_folder_glossaries_from_super_import_v1");
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("routes Special Importer explanatory JSON through the shared resilient parser", () => {
    const parsed = parseSpecialImportInput(`Resposta da IA:\n\n\`\`\`json\n{
      "items": [{
        "flashcard_id": "f1c1ccbe-679a-4d55-8a3f-f84b01bc2194",
        "detailed_explanation": "Explicação",
      }],
    }\n\`\`\``);

    expect(parsed.items).toHaveLength(1);
    expect(parsed.repaired).toBe(true);
    expect(parsed.warnings).toContain("O JSON foi extraído do conteúdo recebido.");
  });
});
