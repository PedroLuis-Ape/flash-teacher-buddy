import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// O repositorio nao tem ambiente DOM de teste (sem jsdom/testing-library), entao o
// contrato de comportamento das views e verificado por leitura de fonte, como nos
// demais contratos de estudo. A logica pura (idioma do lado, BCP-47, orientacao) e
// coberta por testes de funcao em resolveDeckOrientation/languages/resolveStudySides.
describe("contrato TTS do modo Pronuncia", () => {
  it("a pagina repassa ttsEnabled para a view de Pronuncia", () => {
    const study = read("src/pages/Study.tsx");
    const pronunciationBlock = study.slice(study.indexOf("<PronunciationStudyView"));
    expect(pronunciationBlock.slice(0, 1200)).toContain("ttsEnabled={effectiveStudySettings.ttsEnabled}");
  });

  it("a view nao fala quando o TTS esta desligado", () => {
    const impl = read("src/features/study/components/PronunciationStudyView.impl.tsx");
    expect(impl).toContain("ttsEnabled = true");
    expect(impl).toContain("if (!ttsEnabled) return;");
    expect(impl).toContain("speakOnHintClick={ttsEnabled}");
    expect(impl).toContain("disabled={!ttsEnabled}");
  });

  it("a voz segue o idioma do lado exibido", () => {
    const impl = read("src/features/study/components/PronunciationStudyView.impl.tsx");
    expect(impl).toContain("const speakSide = sideB;");
    expect(impl).toContain("const speakLang = toBCP47(speakSide.lang);");
    expect(impl).toContain("langOverride: speakLang");
  });
});

