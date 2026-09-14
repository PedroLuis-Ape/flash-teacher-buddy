import { describe, expect, it } from "vitest";
import { DEFAULT_STUDY_PRESET } from "@/features/study/preferences/studyPreset";
import {
  DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  applyStudySettingsConstraints,
  applyStudySettingsPatch,
  patchAffectsQueue,
  releaseRedFocusConstraints,
  studySettingsFromPreset,
  studySettingsSemanticOverride,
  type StudySettingsSnapshotV3,
} from "./studySettingsSnapshotV3";

function snapshot(overrides: Partial<StudySettingsSnapshotV3> = {}): StudySettingsSnapshotV3 {
  return { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, ...overrides };
}

/** Preferência base do usuário: gamificado + aleatório. */
const BASE_GAMIFIED = snapshot({ order: "random", studyFlowMode: "mastery_rounds" });
// No Modo gamificado a direção efetiva é sempre automática, então os casos que
// escolhem lado fixo (direção/reescrita) rodam no formato extenso.
const BASE = snapshot({ order: "random", studyFlowMode: "continuous" });

describe("Foco Vermelho — restrição temporária, não preferência", () => {
  it("enquanto ativo, o estado EFETIVO é fila sequencial no modo extenso", () => {
    const effective = applyStudySettingsPatch(BASE, { redFocus: true });
    expect(effective.redFocus).toBe(true);
    expect(effective.order).toBe("sequential");
    expect(effective.studyFlowMode).toBe("continuous");
  });

  it("o snapshot derivado do preset já sai com a restrição aplicada (UI e motor iguais)", () => {
    const settings = studySettingsFromPreset({ ...DEFAULT_STUDY_PRESET, order: "random", studyFlowMode: "mastery_rounds" }, { redFocus: true });
    expect(settings.order).toBe("sequential");
    expect(settings.studyFlowMode).toBe("continuous");
  });

  it("desligar restaura ordem e formato anteriores, sem guardar estado extra", () => {
    const on = applyStudySettingsPatch(BASE, { redFocus: true });
    const off = applyStudySettingsPatch(on, { redFocus: false });
    expect(off.redFocus).toBe(false);
    // O controlador libera a restrição usando o preset BASE (que nunca foi
    // sobrescrito pela restrição) — é isso que devolve random + gamificado.
    const released = releaseRedFocusConstraints(off, { order: "random", studyFlowMode: "mastery_rounds" });
    expect(released.order).toBe("random");
    expect(released.studyFlowMode).toBe("mastery_rounds");
    // E não mexe em nada se o Foco Vermelho continua ativo.
    expect(releaseRedFocusConstraints(on, { order: "random", studyFlowMode: "mastery_rounds" })).toBe(on);
  });

  it("ligar/desligar NÃO persiste order nem studyFlowMode (não sobrescreve o preset)", () => {
    const on = applyStudySettingsPatch(BASE, { redFocus: true });
    expect(studySettingsSemanticOverride(on, { redFocus: true })).toEqual({});

    const off = applyStudySettingsPatch(on, { redFocus: false });
    expect(studySettingsSemanticOverride(off, { redFocus: false })).toEqual({});
  });

  it("Foco Vermelho é categoria que reconstrói a fila", () => {
    expect(patchAffectsQueue({ redFocus: true })).toBe(true);
  });

  it("mesmo com a restrição ativa, o snapshot base não é mutado", () => {
    const constraints = applyStudySettingsConstraints(BASE);
    expect(constraints).toBe(BASE);
    const on = applyStudySettingsConstraints(snapshot({ redFocus: true, order: "random" }));
    expect(on.order).toBe("sequential");
  });
});

describe("Persistência por patch semântico", () => {
  it("mudar só a ordem persiste somente a ordem", () => {
    const next = applyStudySettingsPatch(BASE, { order: "sequential" });
    expect(studySettingsSemanticOverride(next, { order: "sequential" })).toEqual({ order: "sequential" });
  });

  it("mudar áudio/exibição não persiste direção e vice-versa", () => {
    const audio = applyStudySettingsPatch(BASE, { fastMode: true, playTarget: "prompt" });
    expect(studySettingsSemanticOverride(audio, { fastMode: true, playTarget: "prompt" })).toEqual({
      fastMode: true,
      playTarget: "prompt",
    });

    const direction = applyStudySettingsPatch(BASE, { direction: "b-a" });
    const override = studySettingsSemanticOverride(direction, { direction: "b-a" });
    expect(override.direction).toBe("b-a");
    expect(override.fastMode).toBeUndefined();
    expect(override.playTarget).toBeUndefined();
  });

  it("direção e lado da reescrita são uma decisão só e persistem juntos", () => {
    const rewrite = applyStudySettingsPatch(snapshot({ writeActivityMode: "rewrite", direction: "a-b" }), {
      writeRewriteSide: "b",
    });
    const override = studySettingsSemanticOverride(rewrite, { writeRewriteSide: "b" });
    expect(override.writeRewriteSide).toBe("b");
    expect(override.direction).toBe("a-b");
  });

  it("áudio e correção não reconstroem a fila; ordem, escopo, formato e Foco Vermelho sim", () => {
    expect(patchAffectsQueue({ fastMode: true })).toBe(false);
    expect(patchAffectsQueue({ playTarget: "answer" })).toBe(false);
    expect(patchAffectsQueue({ writeCorrectionMode: "hard" })).toBe(false);
    expect(patchAffectsQueue({ direction: "b-a" })).toBe(false);
    expect(patchAffectsQueue({ order: "random" })).toBe(true);
    expect(patchAffectsQueue({ scope: "favorites" })).toBe(true);
    expect(patchAffectsQueue({ studyFlowMode: "continuous" })).toBe(true);
  });

  it("o runtime recebe o snapshot efetivo completo, a persistência recebe só a decisão", () => {
    const next = applyStudySettingsPatch(BASE, { redFocus: true });
    expect(next.order).toBe("sequential");
    expect(studySettingsSemanticOverride(next, { redFocus: true })).toEqual({});
  });
});
