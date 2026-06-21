import { describe, expect, it } from "vitest";
import {
  glossaryServiceMessage,
  isMissingGlossaryRpcError,
  isMissingGlossaryTableError,
} from "./glossaryServiceError";

describe("glossary service diagnostics", () => {
  it("recognizes a stale PostgREST function cache", () => {
    const error = {
      code: "PGRST202",
      message: "Could not find the function public.import_account_glossary_v1(_dry_run, _entries) in the schema cache",
    };

    expect(isMissingGlossaryRpcError(error)).toBe(true);
    expect(glossaryServiceMessage(error, "importar")).toContain("função de importação");
  });

  it("distinguishes a missing account glossary table", () => {
    const error = {
      code: "PGRST205",
      message: "Could not find the table public.account_glossary in the schema cache",
    };

    expect(isMissingGlossaryTableError(error)).toBe(true);
    expect(glossaryServiceMessage(error, "sincronizar")).toContain("projetos diferentes");
  });

  it("translates authentication failures", () => {
    expect(glossaryServiceMessage({ code: "42501", message: "permission denied" }, "sincronizar"))
      .toContain("permissão");
  });
});
