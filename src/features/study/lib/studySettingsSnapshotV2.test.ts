import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  applyStudySettingsPatch,
  diffStudySettings,
  normalizeStudySettingsSnapshotV2,
  patchAffectsQueue,
  studySettingsToPresetOverride,
} from "./studySettingsSnapshotV2";

describe("contrato único de configurações v2", () => {
  it("cobre todos os campos ajustáveis na janela", () => {
    expect(Object.keys(DEFAULT_STUDY_SETTINGS_SNAPSHOT).sort()).toEqual([
      "direction", "fastMode", "order", "playMode", "playSide", "redFocus",
      "scope", "studyFlowMode", "version", "writeActivityMode",
      "writeCorrectionMode", "writeRewriteSide",
    ]);
  });

  it("migra snapshots v1 e repara direção contraditória do Reescrever", () => {
    const fallback = { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, playMode: "single" as const, playSide: "b" as const };
    expect(normalizeStudySettingsSnapshotV2({
      version: 1, subset: "favorites", direction: "b-a", order: "sequential",
      writeActivityMode: "rewrite", writeRewriteSide: "b", writeCorrectionMode: "flexible",
    }, fallback)).toMatchObject({
      version: 2, scope: "favorites", direction: "a-b", order: "sequential",
      playMode: "single", playSide: "b", writeActivityMode: "rewrite", writeRewriteSide: "b",
    });
  });

  it("deriva o lado da direção quando snapshot antigo não possui writeRewriteSide", () => {
    expect(normalizeStudySettingsSnapshotV2({
      version: 1,
      direction: "b-a",
      writeActivityMode: "rewrite",
    })).toMatchObject({
      direction: "b-a",
      writeActivityMode: "rewrite",
      writeRewriteSide: "a",
    });
  });

  it("descarta valores inválidos preservando o fallback", () => {
    expect(normalizeStudySettingsSnapshotV2({ direction: "xx", order: "zz", scope: "nope" }))
      .toMatchObject({
        direction: DEFAULT_STUDY_SETTINGS_SNAPSHOT.direction,
        order: DEFAULT_STUDY_SETTINGS_SNAPSHOT.order,
        scope: DEFAULT_STUDY_SETTINGS_SNAPSHOT.scope,
      });
  });

  it("sincroniza lado B com direção a-b na mesma ação", () => {
    const current = {
      ...DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      writeActivityMode: "rewrite" as const,
      writeRewriteSide: "a" as const,
      direction: "b-a" as const,
    };
    expect(applyStudySettingsPatch(current, { writeRewriteSide: "b" })).toMatchObject({
      writeActivityMode: "rewrite",
      writeRewriteSide: "b",
      direction: "a-b",
    });
  });

  it("sincroniza direção b-a com lado A quando já está em Reescrever", () => {
    const current = {
      ...DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      writeActivityMode: "rewrite" as const,
      writeRewriteSide: "b" as const,
      direction: "a-b" as const,
    };
    expect(applyStudySettingsPatch(current, { direction: "b-a" })).toMatchObject({
      writeRewriteSide: "a",
      direction: "b-a",
    });
  });

  it("ao entrar em Reescrever deriva o alvo da direção atual", () => {
    const current = {
      ...DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      writeActivityMode: "translate" as const,
      direction: "a-b" as const,
      writeRewriteSide: "a" as const,
    };
    expect(applyStudySettingsPatch(current, { writeActivityMode: "rewrite" })).toMatchObject({
      writeActivityMode: "rewrite",
      writeRewriteSide: "b",
      direction: "a-b",
    });
  });

  it("não deixa writeRewriteSide interferir na direção durante Traduzir", () => {
    const current = {
      ...DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      writeActivityMode: "translate" as const,
      direction: "b-a" as const,
    };
    expect(applyStudySettingsPatch(current, { writeRewriteSide: "b" })).toMatchObject({
      writeActivityMode: "translate",
      writeRewriteSide: "b",
      direction: "b-a",
    });
  });

  it("classifica somente os campos que reconstroem a fila", () => {
    expect(patchAffectsQueue({ order: "sequential" })).toBe(true);
    expect(patchAffectsQueue({ scope: "favorites" })).toBe(true);
    expect(patchAffectsQueue({ redFocus: true })).toBe(true);
    expect(patchAffectsQueue({ studyFlowMode: "continuous" })).toBe(true);
    expect(patchAffectsQueue({ direction: "b-a" })).toBe(false);
    expect(patchAffectsQueue({ writeCorrectionMode: "hard" })).toBe(false);
    expect(patchAffectsQueue({ playMode: "single", playSide: "b", fastMode: true })).toBe(false);
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
      { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, scope: "favorites", playSide: "b" },
    )).toEqual({ scope: "favorites", playSide: "b" });
  });
});
