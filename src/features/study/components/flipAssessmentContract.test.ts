import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Normaliza EOL: o checkout no Windows entrega CRLF e os contratos abaixo
 * comparam trechos multi-linha. Sem isso a suíte fica vermelha aqui e verde no
 * CI Linux — falso negativo de ambiente, não de comportamento.
 */
const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const impl = read("./FlipStudyView.impl.tsx");
const study = read("../../../pages/Study.tsx");
const shortcuts = read("../../../hooks/useKeyboardShortcuts.ts");
const deck = read("./StudyCardDeck.tsx");

describe("contrato de avaliação do Flip (extenso x gamificado)", () => {
  it("existe um único dono da decisão de avaliação, derivado do fluxo de estudo", () => {
    expect(impl).toContain('const assessmentEnabled = studyFlowMode === "mastery_rounds";');
    expect(impl).toContain('studyFlowMode?: "continuous" | "mastery_rounds";');
  });

  it("extenso não renderiza Sabia/Não Sabia", () => {
    expect(impl).toContain("const actionButtons = !assessmentEnabled ? null : (");
    expect(impl).toContain("{actionButtons && <div className=\"w-full animate-fade-in\">{actionButtons}</div>}");
  });

  it("extenso não executa scoring por teclado nem por Espaço", () => {
    expect(impl).toContain("if (!assessmentEnabled) {\n          handleFlip();\n          return;\n        }");
    const knew = impl.slice(impl.indexOf("const handleKnew = () => {"));
    expect(knew.startsWith("const handleKnew = () => {\n    if (!assessmentEnabled) return;")).toBe(true);
    const didnt = impl.slice(impl.indexOf("const handleDidntKnow = () => {"));
    expect(didnt.startsWith("const handleDidntKnow = () => {\n    if (!assessmentEnabled) return;")).toBe(true);
  });

  it("o Flip não é um segundo dono de next/prev no teclado", () => {
    expect(impl).not.toContain("normalizeKey(shortcuts.nextCard)");
    expect(impl).not.toContain("normalizeKey(shortcuts.prevCard)");
    expect(impl).toContain("DONO ÚNICO DE next/prev");
  });

  it("o roteador global ignora tecla já tratada por outro dono legítimo", () => {
    expect(shortcuts).toContain("if (e.defaultPrevented) return;");
  });

  it("no Flip extenso a seta para frente navega livremente; no gamificado não burla avaliação", () => {
    expect(study).toContain('const flipFreeNavigation = effectiveMode === "flip" && !masteryProgressActive;');
    expect(study).toContain("if (flipFreeNavigation) {\n          if (canGoNext) navigateNext();\n          return;\n        }");
    expect(study).toContain("if (currentCard) requestSkip();");
  });

  it("Study informa explicitamente o fluxo ao Flip", () => {
    expect(study).toContain('studyFlowMode={effectivePreset.studyFlowMode === "mastery_rounds" ? "mastery_rounds" : "continuous"}');
  });

  it("StudyCardDeck continua apenas preparando a animação (sem navegar)", () => {
    const capture = deck.slice(deck.indexOf("keydown"));
    expect(capture).toContain("prepareTransition");
    expect(capture).not.toContain("onNext(");
  });
});
