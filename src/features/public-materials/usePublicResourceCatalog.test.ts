import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: { rpc: rpcMock },
}));

import {
  fetchPublicResourceCatalog,
  parsePublicResourceCatalog,
} from "./usePublicResourceCatalog";

const validEmptyCatalog = {
  items: [],
  total: 0,
  has_more: false,
  facets: {
    levels: [],
    themes: [],
    resource_types: [],
  },
};

describe("parsePublicResourceCatalog", () => {
  it.each([
    ["null", null],
    ["array", []],
    ["items ausente", { ...validEmptyCatalog, items: undefined }],
    ["items com tipo incorreto", { ...validEmptyCatalog, items: {} }],
    ["total ausente", { ...validEmptyCatalog, total: undefined }],
    ["total com tipo incorreto", { ...validEmptyCatalog, total: "0" }],
    ["has_more ausente", { ...validEmptyCatalog, has_more: undefined }],
    ["has_more com tipo incorreto", { ...validEmptyCatalog, has_more: 0 }],
    ["facets ausente", { ...validEmptyCatalog, facets: undefined }],
    ["facets com tipo incorreto", { ...validEmptyCatalog, facets: [] }],
    [
      "faceta interna com tipo incorreto",
      { ...validEmptyCatalog, facets: { ...validEmptyCatalog.facets, themes: null } },
    ],
  ])("lança para levar payload %s ao estado de erro recuperável", (_label, payload) => {
    expect(() => parsePublicResourceCatalog(payload)).toThrow(
      "Resposta inválida de list_public_resources_v1",
    );
  });

  it("preserva o payload vazio válido para o estado sem curadoria", () => {
    expect(parsePublicResourceCatalog(validEmptyCatalog)).toEqual(validEmptyCatalog);
  });
});

describe("fetchPublicResourceCatalog", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("rejeita sucesso malformado para o React Query ativar o estado de erro", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(fetchPublicResourceCatalog({ locale: "pt-BR" })).rejects.toThrow(
      "Resposta inválida de list_public_resources_v1",
    );
  });

  it("entrega o vazio válido para a página ativar o estado sem curadoria", async () => {
    rpcMock.mockResolvedValue({ data: validEmptyCatalog, error: null });

    await expect(fetchPublicResourceCatalog({ locale: "pt-BR" })).resolves.toEqual(
      validEmptyCatalog,
    );
  });
});
