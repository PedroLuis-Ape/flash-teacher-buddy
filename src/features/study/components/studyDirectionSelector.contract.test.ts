import { describe, expect, it } from "vitest";
import {
  buildStudyDirectionOptions,
  formatStudyDirection,
} from "@/features/study/lib/studyDirectionSelector";

describe("study direction selector contract", () => {
  const labels = { labelA: "English", labelB: "Português" };

  it("uses semantic origin-to-destination labels for every canonical direction", () => {
    expect(buildStudyDirectionOptions(labels)).toEqual([
      { value: "a-b", label: "English → Português", description: "Mostra English primeiro" },
      { value: "b-a", label: "Português → English", description: "Mostra Português primeiro" },
      { value: "any", label: "Misturar os lados", description: "Alterna automaticamente o lado inicial" },
    ]);
  });

  it("formats the same summary used by every surface", () => {
    expect(formatStudyDirection("a-b", labels)).toBe("English → Português");
    expect(formatStudyDirection("b-a", labels)).toBe("Português → English");
    expect(formatStudyDirection("any", labels)).toBe("Misturar os lados");
    expect(formatStudyDirection("any", labels, { locked: true })).toBe("Direção automática no modo gamificado");
  });

  it("keeps custom labels intact", () => {
    expect(buildStudyDirectionOptions({ labelA: "Termo", labelB: "Definição" })[0].label)
      .toBe("Termo → Definição");
  });
});
