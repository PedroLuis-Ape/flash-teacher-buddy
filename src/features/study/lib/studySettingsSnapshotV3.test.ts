import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  applyStudySettingsPatch,
  diffStudySettings,
  normalizeStudySettingsSnapshotV3,
  patchAffectsQueue,
  studySettingsToPresetOverride,
} from "./studySettingsSnapshotV3";

// No Modo gamificado a direção efetiva é sempre automática; os casos que
// escolhem um lado fixo rodam no formato extenso (continuous).
const BASE_CONTINUOUS = { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, studyFlowMode: "continuous" as const };

describe("contrato único de configurações v3", () => {
  it("cobre todos os campos ajustáveis na janela", () => {
    expect(Object.keys(DEFAULT_STUDY_SETTINGS_SNAPSHOT).sort()).toEqual([
      "direction", "fastMode", "order", "playTarget", "redFocus",
      "scope", "studyFlowMode", "version", "writeActivityMode",
      "writeCorrectionMode", "writeRewriteSide",
    ]);
  });

  it("migra snapshots v1 (subset, sem configuração de Play)", () => {
    const fallback = { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, playTarget: "answer" as const };
    expect(normalizeStudySettingsSnapshotV3({
      version: 1, subset: "favorites", direction: "b-a", order: "sequential",
      writeActivityMode: "rewrite", writeRewriteSide: "b", writeCorrectionMode: "flexible",
    }, fallback)).toMatchObject({
      // Reescrever: a direção é reparada a partir do lado persistido (b => a-b).
      version: 3, scope: "favorites", direction: "a-b", order: "sequential",
      playTarget: "answer", writeActivityMode: "rewrite", writeRewriteSide: "b",
    });
  });

  it("migra snapshots v2 (playMode/playSide físico) para playTarget semântico", () => {
    // Lado escolhido == lado da pergunta => somente pergunta.
    expect(normalizeStudySettingsSnapshotV3({
      version: 2, direction: "a-b", playMode: "single", playSide: "a",
    }).playTarget).toBe("prompt");
    // Lado escolhido == lado da resposta => somente resposta.
    expect(normalizeStudySettingsSnapshotV3({
      version: 2, direction: "a-b", playMode: "single", playSide: "b",
    }).playTarget).toBe("answer");
    // Direção invertida: o mesmo lado físico "b" agora é a pergunta.
    expect(normalizeStudySettingsSnapshotV3({
      version: 2, direction: "b-a", playMode: "single", playSide: "b",
    }).playTarget).toBe("prompt");
    expect(normalizeStudySettingsSnapshotV3({
      version: 2, direction: "b-a", playMode: "both", playSide: "b",
    }).playTarget).toBe("both");
  });

  it("descarta valores inválidos preservando o fallback", () => {
    expect(normalizeStudySettingsSnapshotV3({ direction: "xx", order: "zz", scope: "nope" }))
      .toMatchObject({
        direction: DEFAULT_STUDY_SETTINGS_SNAPSHOT.direction,
        order: DEFAULT_STUDY_SETTINGS_SNAPSHOT.order,
        scope: DEFAULT_STUDY_SETTINGS_SNAPSHOT.scope,
      });
  });

  it("classifica somente os campos que reconstroem a fila", () => {
    expect(patchAffectsQueue({ order: "sequential" })).toBe(true);
    expect(patchAffectsQueue({ scope: "favorites" })).toBe(true);
    expect(patchAffectsQueue({ redFocus: true })).toBe(true);
    expect(patchAffectsQueue({ studyFlowMode: "continuous" })).toBe(true);
    expect(patchAffectsQueue({ direction: "b-a" })).toBe(false);
    expect(patchAffectsQueue({ writeCorrectionMode: "hard" })).toBe(false);
    expect(patchAffectsQueue({ playTarget: "prompt", fastMode: true })).toBe(false);
  });

  it("força fila sequencial no Foco Vermelho", () => {
    expect(applyStudySettingsPatch(DEFAULT_STUDY_SETTINGS_SNAPSHOT, { redFocus: true }).order)
      .toBe("sequential");
  });

  it("exporta o override efêmero sem inventar campos", () => {
    const override = studySettingsToPresetOverride({
      ...DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      writeActivityMode: "rewrite",
      writeRewriteSide: "b",
      direction: "a-b",
    });
    expect(override).toMatchObject({ writeActivityMode: "rewrite", writeRewriteSide: "b", direction: "a-b" });
    expect("redFocus" in override).toBe(false);
  });

  it("computa apenas a diferença real entre dois snapshots", () => {
    expect(diffStudySettings(
      DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, scope: "favorites", playTarget: "answer" },
    )).toEqual({ scope: "favorites", playTarget: "answer" });
  });

  it("sincroniza direção e lado da reescrita numa única ação", () => {
    const DEFAULT_STUDY_SETTINGS_SNAPSHOT = {
      ...BASE_CONTINUOUS,
    };
    expect(applyStudySettingsPatch(DEFAULT_STUDY_SETTINGS_SNAPSHOT, { writeRewriteSide: "b" }))
      .toMatchObject({ writeRewriteSide: "b", direction: "a-b" });
    expect(applyStudySettingsPatch(DEFAULT_STUDY_SETTINGS_SNAPSHOT, { writeRewriteSide: "a" }))
      .toMatchObject({ writeRewriteSide: "a", direction: "b-a" });

    const rewrite = applyStudySettingsPatch(
      DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      { writeActivityMode: "rewrite", writeRewriteSide: "a" },
    );
    expect(applyStudySettingsPatch(rewrite, { direction: "a-b" }))
      .toMatchObject({ direction: "a-b", writeRewriteSide: "b" });
  });

  it("herda o lado ao entrar no modo Reescrever e repara snapshots dessincronizados", () => {
    const translate = { ...BASE_CONTINUOUS, direction: "b-a" as const };
    expect(applyStudySettingsPatch(translate, { writeActivityMode: "rewrite" }))
      .toMatchObject({ writeActivityMode: "rewrite", writeRewriteSide: "a", direction: "b-a" });

    expect(normalizeStudySettingsSnapshotV3({
      version: 2, studyFlowMode: "continuous", writeActivityMode: "rewrite",
      writeRewriteSide: "a", direction: "a-b",
    })).toMatchObject({ writeRewriteSide: "a", direction: "b-a" });
  });

  it("não sincroniza direção no modo Traduzir", () => {
    expect(applyStudySettingsPatch(BASE_CONTINUOUS, { direction: "b-a" }))
      .toMatchObject({ direction: "b-a", writeRewriteSide: BASE_CONTINUOUS.writeRewriteSide });
  });
});
