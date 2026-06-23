import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const listDetail = read("../../../pages/ListDetail.tsx");
const bulkImportDialog = read("../../../components/BulkImportDialog.tsx");

describe("common importer isolation", () => {
  it("keeps the existing list importer available", () => {
    expect(listDetail).toContain("<BulkImportDialog");
    expect(bulkImportDialog).toContain("onImported");
  });

  it("keeps manual layer merging available after normal-card import", () => {
    expect(listDetail).toContain("Mesclar em camadas");
    expect(listDetail).toContain("<MergeIntoLayersDialog");
  });
});
