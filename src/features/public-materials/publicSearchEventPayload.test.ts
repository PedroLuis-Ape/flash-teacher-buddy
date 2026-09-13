import { describe, expect, it } from "vitest";
import { buildPublicSearchEventPayload } from "@/features/public-materials/publicSearchEventPayload";

describe("buildPublicSearchEventPayload", () => {
  it("busca por texto nao conta como filtro", () => {
    expect(buildPublicSearchEventPayload({ resultCount: 4 })).toEqual({
      result_count: 4,
      has_filters: false,
    });
  });

  it("qualquer filtro real marca has_filters", () => {
    expect(buildPublicSearchEventPayload({ resultCount: 0, level: "A1" }).has_filters).toBe(true);
    expect(buildPublicSearchEventPayload({ resultCount: 0, theme: "viagem" }).has_filters).toBe(true);
    expect(buildPublicSearchEventPayload({ resultCount: 0, type: "frases" }).has_filters).toBe(true);
  });

  it("nunca carrega o termo digitado", () => {
    const payload = buildPublicSearchEventPayload({ resultCount: 1, level: "A1" });
    expect(Object.keys(payload).sort()).toEqual(["has_filters", "result_count"]);
  });
});

