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
      // Reescrever: a direção é reparada a partir do lado persistido (b => a-b).
      version: 2, scope: "favorites", direction: "a-b", order: "sequential",
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

  it("sincroniza direção e lado da reescrita numa única ação", () => {
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
    const translate = { ...DEFAULT_STUDY_SETTINGS_SNAPSHOT, direction: "b-a" as const };
    expect(applyStudySettingsPatch(translate, { writeActivityMode: "rewrite" }))
      .toMatchObject({ writeActivityMode: "rewrite", writeRewriteSide: "a", direction: "b-a" });

    expect(normalizeStudySettingsSnapshotV2({
      version: 2, writeActivityMode: "rewrite", writeRewriteSide: "a", direction: "a-b",
    })).toMatchObject({ writeRewriteSide: "a", direction: "b-a" });
  });

  it("não sincroniza direção no modo Traduzir", () => {
    expect(applyStudySettingsPatch(DEFAULT_STUDY_SETTINGS_SNAPSHOT, { direction: "b-a" }))
      .toMatchObject({ direction: "b-a", writeRewriteSide: DEFAULT_STUDY_SETTINGS_SNAPSHOT.writeRewriteSide });
  });
});
