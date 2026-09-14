import { describe, expect, it } from "vitest";
import { resolveStudySides } from "./resolveStudySides";
import {
  DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  applyStudySettingsPatch,
  isDirectionLockedByFlowMode,
  releaseMasteryRoundsConstraints,
  resolveEffectiveStudyDirection,
  studySettingsFromPreset,
  studySettingsSemanticOverride,
} from "./studySettingsSnapshotV3";
import { playTargetToLegacyWire } from "./studySessionContext";
import {
  DEFAULT_STUDY_PRESET,
  legacyPlayToTarget,
  normalizeStudyPreset,
} from "@/features/study/preferences/studyPreset";

const sideA = { text: "dog", lang: "en", label: "English" };
const sideB = { text: "cachorro", lang: "pt", label: "Português" };

const CONTINUOUS = {
  ...DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  studyFlowMode: "continuous" as const,
};

/** O que cada modo recebe: prompt/answer resolvidos pelo contrato canônico. */
function modeSides(direction: string, cardSeed = "card-1") {
  const { promptSide, answerSide } = resolveStudySides(sideA, sideB, direction, cardSeed);
  return { prompt: promptSide.text, answer: answerSide.text };
}

/** Play semântico: o que é falado, derivado SEMPRE de prompt/answer. */
function playedTexts(playTarget: "both" | "prompt" | "answer", direction: string, cardSeed = "card-1") {
  const { prompt, answer } = modeSides(direction, cardSeed);
  if (playTarget === "prompt") return [prompt];
  if (playTarget === "answer") return [answer];
  return [prompt, answer];
}

describe("autoridade única de lados (contrato V3)", () => {
  it("continuous + a-b: todos os modos usam A como pergunta e B como resposta", () => {
    const direction = resolveEffectiveStudyDirection("a-b", "continuous");
    ["card-1", "card-2", "card-3"].forEach((seed) => {
      expect(modeSides(direction, seed)).toEqual({ prompt: "dog", answer: "cachorro" });
    });
  });

  it("continuous + b-a: todos os modos usam B como pergunta e A como resposta", () => {
    const direction = resolveEffectiveStudyDirection("b-a", "continuous");
    ["card-1", "card-2", "card-3"].forEach((seed) => {
      expect(modeSides(direction, seed)).toEqual({ prompt: "cachorro", answer: "dog" });
    });
  });

  it("mastery_rounds com base a-b tem direção efetiva automática sem destruir a base", () => {
    expect(isDirectionLockedByFlowMode("mastery_rounds")).toBe(true);
    expect(resolveEffectiveStudyDirection("a-b", "mastery_rounds")).toBe("any");

    const base = normalizeStudyPreset({ ...DEFAULT_STUDY_PRESET, direction: "a-b", studyFlowMode: "mastery_rounds" });
    const effective = studySettingsFromPreset(base);
    expect(effective.direction).toBe("any");
    // A restrição NUNCA é persistida como escolha do usuário.
    expect(studySettingsSemanticOverride(effective, { direction: "any" }).direction).toBeUndefined();
    expect(base.direction).toBe("a-b");
  });

  it("sair do gamificado restaura a direção base a-b", () => {
    const inGamified = studySettingsFromPreset(
      normalizeStudyPreset({ ...DEFAULT_STUDY_PRESET, direction: "a-b", studyFlowMode: "mastery_rounds" }),
    );
    const leaving = applyStudySettingsPatch(inGamified, { studyFlowMode: "continuous" });
    const restored = releaseMasteryRoundsConstraints(leaving, { direction: "a-b", writeRewriteSide: "alternating" });
    expect(restored.direction).toBe("a-b");
  });

  it("Play 'somente pergunta' segue o promptSide, nunca um lado físico", () => {
    expect(playedTexts("prompt", "a-b")).toEqual(["dog"]);
    expect(playedTexts("prompt", "b-a")).toEqual(["cachorro"]);
  });

  it("Play 'somente resposta' segue o answerSide", () => {
    expect(playedTexts("answer", "a-b")).toEqual(["cachorro"]);
    expect(playedTexts("answer", "b-a")).toEqual(["dog"]);
  });

  it("Play 'pergunta + resposta' toca os dois na ordem correta", () => {
    expect(playedTexts("both", "a-b")).toEqual(["dog", "cachorro"]);
    expect(playedTexts("both", "b-a")).toEqual(["cachorro", "dog"]);
  });

  it("direction=any + play=prompt não cria idioma fixo falso: segue a pergunta do card", () => {
    const seeds = ["card-1", "card-2", "card-3", "card-4"];
    seeds.forEach((seed) => {
      const { prompt } = modeSides("any", seed);
      expect(playedTexts("prompt", "any", seed)).toEqual([prompt]);
    });
    // E realmente alterna: "any" é uma escolha de direção, não um conflito.
    const prompts = new Set(seeds.map((seed) => modeSides("any", seed).prompt));
    expect(prompts.size).toBe(2);
  });

  it("mudar áudio não muda direção e mudar direção não muda áudio", () => {
    const audio = applyStudySettingsPatch(CONTINUOUS, { playTarget: "answer" });
    expect(audio.direction).toBe(CONTINUOUS.direction);

    const direction = applyStudySettingsPatch(CONTINUOUS, { direction: "b-a" });
    expect(direction.playTarget).toBe(CONTINUOUS.playTarget);
  });

  it("migra o Play físico v2 para o alvo semântico usando a direção", () => {
    expect(legacyPlayToTarget("single", "a", "a-b")).toBe("prompt");
    expect(legacyPlayToTarget("single", "b", "a-b")).toBe("answer");
    expect(legacyPlayToTarget("single", "b", "b-a")).toBe("prompt");
    expect(legacyPlayToTarget("both", "b", "b-a")).toBe("both");
  });

  it("mantém a chave de escopo das sessões salvas byte-compatível (formato de fio v1)", () => {
    // Padrão histórico: playMode "both" + playSide "a".
    expect(playTargetToLegacyWire("both", "any")).toEqual({ playMode: "both", playSide: "a" });
    expect(playTargetToLegacyWire("prompt", "a-b")).toEqual({ playMode: "single", playSide: "a" });
    expect(playTargetToLegacyWire("answer", "a-b")).toEqual({ playMode: "single", playSide: "b" });
    expect(playTargetToLegacyWire("prompt", "b-a")).toEqual({ playMode: "single", playSide: "b" });
  });

  it("Foco Vermelho continua restaurando ordem e formato base", () => {
    const redFocus = applyStudySettingsPatch(CONTINUOUS, { redFocus: true });
    expect(redFocus.order).toBe("sequential");
    expect(redFocus.studyFlowMode).toBe("continuous");
    expect(studySettingsSemanticOverride(redFocus, { redFocus: true })).toEqual({});
  });

  it("Pronúncia usa o resolver canônico, sem sideB hardcoded", async () => {
    const { readFileSync } = await import("node:fs");
    const impl = readFileSync("src/features/study/components/PronunciationStudyView.impl.tsx", "utf8");
    expect(impl).toContain("resolveStudySides(");
    expect(impl).toContain("const speakSide = answerSide;");
    expect(impl).not.toContain("const speakSide = sideB;");
  });

  it("Play não é mais uma store global concorrente: só rótulos derivados", async () => {
    const { readFileSync } = await import("node:fs");
    const store = readFileSync("src/features/study/lib/playPresetRuntime.ts", "utf8");
    expect(store).not.toContain("playSide");
    expect(store).not.toContain("playMode");
    expect(store).toContain("labelA");
  });
});
