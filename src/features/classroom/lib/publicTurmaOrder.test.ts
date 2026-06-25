import { describe, expect, it } from "vitest";
import {
  movePublicTurmaToPosition,
  publicTurmaPositionLabel,
  sortPublicTurmasByOrder,
  sortTurmasForManagement,
} from "./publicTurmaOrder";

describe("public turma ordering", () => {
  it("respeita a ordem pública persistida", () => {
    const ordered = sortPublicTurmasByOrder([
      { id: "c", public: true, public_order_index: 3, created_at: "2026-01-03" },
      { id: "a", public: true, public_order_index: 1, created_at: "2026-01-01" },
      { id: "b", public: true, public_order_index: 2, created_at: "2026-01-02" },
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("mantém o comportamento anterior para turmas ainda não normalizadas", () => {
    const ordered = sortPublicTurmasByOrder([
      { id: "old", public: true, created_at: "2026-01-01" },
      { id: "new", public: true, created_at: "2026-02-01" },
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("mostra turmas públicas ordenadas antes das privadas na gestão", () => {
    const ordered = sortTurmasForManagement([
      { id: "private-new", public: false, created_at: "2026-03-01" },
      { id: "public-second", public: true, public_order_index: 2, created_at: "2026-01-01" },
      { id: "public-first", public: true, public_order_index: 1, created_at: "2026-01-02" },
    ]);

    expect(ordered.map((item) => item.id)).toEqual([
      "public-first",
      "public-second",
      "private-new",
    ]);
  });

  it("move uma turma para uma posição delimitada", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(movePublicTurmaToPosition(items, "c", 0).map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(movePublicTurmaToPosition(items, "a", 99).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("formata posições com três dígitos", () => {
    expect(publicTurmaPositionLabel(0)).toBe("001");
    expect(publicTurmaPositionLabel(11)).toBe("012");
  });
});
