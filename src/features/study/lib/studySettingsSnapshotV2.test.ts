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

  it("migra snapshots v1 (subset, sem playMode/playSide)", () => {
    const fallback = { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, playMode: "single" as const, playSide: "b" as const };
    expect(normalizeStudySettingsSnapshotV2({
      version: 1, subset: "favorites", direction: "b-a", order: "sequential",
      writeActivityMode: "rewrite", writeRewriteSide: "b", writeCorrectionMode: "flexible",
    }, fallback)).toMatchObject({
      version: 2, scope: "favorites", direction: "b-a", order: "sequential",
      playMode: "single", playSide: "b", writeActivityMode: "rewrite", writeRewriteSide: "b",
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
