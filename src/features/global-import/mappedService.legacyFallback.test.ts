import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/global-import/mappedService.ts"), "utf8");

describe("mapped import service", () => {
  it("uses stable personal and classroom gateways", () => {
    expect(source).toContain("PERSONAL_IMPORT_RPC");
    expect(source).toContain("CLASSROOM_IMPORT_RPC");
    expect(source).toContain("getStableImportRpcName");
  });

  it("keeps compatibility and glossary transaction handling", () => {
    expect(source).toContain("LIVE_PERSONAL_COMPAT_RPC");
    expect(source).toContain("usedLiveV1Compatibility");
    expect(source).toContain("rollbackImportedBatch");
    expect(source).toContain("FOLDER_GLOSSARY_RPC");
  });
});
