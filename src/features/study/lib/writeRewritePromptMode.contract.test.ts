import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDY_PRESET,
  diffStudyPreset,
  normalizeStudyPreset,
  normalizeStudyPresetOverride,
} from "@/features/study/preferences/studyPreset";
import { mapGlobalPreferenceRow, toGlobalPreferenceRow } from "@/features/study/preferences/studyPreferenceRepository";
import {
  buildLegacyRewriteCardIdentity,
  buildRewriteCardIdentity,
  DEFAULT_WRITE_SESSION_SETTINGS,
} from "./writeActivityMode";
import { createRewriteFlowState, submitRewriteAnswer } from "./writeRewriteFlow";
import {
  DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  applyStudySettingsPatch,
  normalizeStudySettingsSnapshotV3,
  studySettingsToPresetOverride,
} from "./studySettingsSnapshotV3";

/**
 * Contrato de "Reescrever" (reescrita visual) x "Escrever o que ouviu" (ditado).
 *
 * As duas são atividades IRMÃS sobre os mesmos campos:
 *   writeActivityMode = "rewrite" + writeRewritePromptMode = "visible" | "listening"
 * e o ditado nunca é fase obrigatória da reescrita.
 */
describe("reescrever x escrever o que ouviu", () => {
  it("tem reescrita visual como default e mantém presets antigos válidos", () => {
    expect(DEFAULT_STUDY_PRESET.writeRewritePromptMode).toBe("visible");
    expect(DEFAULT_WRITE_SESSION_SETTINGS.writeRewritePromptMode).toBe("visible");
    // Preset antigo: "rewrite" sem o campo novo continua sendo reescrita visual.
    const legacy = normalizeStudyPreset({ writeActivityMode: "rewrite", writeRewriteSide: "b" });
    expect(legacy.writeActivityMode).toBe("rewrite");
    expect(legacy.writeRewriteSide).toBe("b");
    expect(legacy.writeRewritePromptMode).toBe("visible");
  });

  it("normaliza o override sem inventar valor", () => {
    expect(normalizeStudyPresetOverride({ writeRewritePromptMode: "listening" }))
      .toEqual({ writeRewritePromptMode: "listening" });
    expect(normalizeStudyPresetOverride({ writeRewritePromptMode: "invalido" })).toEqual({});
    const base = { ...DEFAULT_STUDY_PRESET, writeActivityMode: "rewrite" as const };
    const listening = normalizeStudyPreset({ ...base, writeRewritePromptMode: "listening" });
    expect(diffStudyPreset(listening, base)).toMatchObject({ writeRewritePromptMode: "listening" });
  });

  it("trata snapshots antigos como reescrita visual", () => {
    const legacy = normalizeStudySettingsSnapshotV3({
      version: 3,
      writeActivityMode: "rewrite",
      writeRewriteSide: "a",
    });
    expect(legacy.writeRewritePromptMode).toBe("visible");
    expect(DEFAULT_STUDY_SETTINGS_SNAPSHOT.writeRewritePromptMode).toBe("visible");
  });

  it("troca a modalidade sem perder o lado escolhido", () => {
    const base = {
      ...DEFAULT_STUDY_SETTINGS_SNAPSHOT,
      studyFlowMode: "continuous" as const,
      writeActivityMode: "rewrite" as const,
      writeRewriteSide: "a" as const,
      direction: "b-a" as const,
    };
    const listening = applyStudySettingsPatch(base, {
      writeActivityMode: "rewrite",
      writeRewritePromptMode: "listening",
    });
    expect(listening.writeRewritePromptMode).toBe("listening");
    expect(listening.writeRewriteSide).toBe("a");
    expect(studySettingsToPresetOverride(listening))
      .toMatchObject({ writeRewritePromptMode: "listening", writeRewriteSide: "a" });
    const visible = applyStudySettingsPatch(listening, {
      writeActivityMode: "rewrite",
      writeRewritePromptMode: "visible",
    });
    expect(visible.writeRewritePromptMode).toBe("visible");
    expect(visible.writeRewriteSide).toBe("a");
  });

  it("começa visível na reescrita visual e escondido no ditado", () => {
    // O alvo é montado desde o início: a fase nunca é LISTENING em "visible".
    expect(createRewriteFlowState("visible").phase).toBe("REWRITE");
    expect(createRewriteFlowState("listening").phase).toBe("LISTENING");
    // Default preserva o comportamento legado do motor (ditado).
    expect(createRewriteFlowState().phase).toBe("LISTENING");
  });

  it("não compartilha snapshot entre as duas modalidades", () => {
    expect(buildRewriteCardIdentity("card-1", "visible", "a")).toBe("card-1:rewrite-visible-a");
    expect(buildRewriteCardIdentity("card-1", "listening", "a")).toBe("card-1:rewrite-listening-a");
    expect(buildRewriteCardIdentity("card-1", "visible", "a"))
      .not.toBe(buildRewriteCardIdentity("card-1", "listening", "a"));
    // Formato legado continua identificável (era sempre ditado).
    expect(buildLegacyRewriteCardIdentity("card-1", "a")).toBe("card-1:rewrite-a");
  });

  it("mantém correção exata nas duas modalidades", () => {
    const accepted = submitRewriteAnswer(
      createRewriteFlowState("visible"),
      "Ela almoçou e voltou.",
      { accepted: true },
    );
    expect(accepted.phase).toBe("COMPLETED");
    const rejected = submitRewriteAnswer(
      createRewriteFlowState("visible"),
      "Ela almocou e voltou.",
      { accepted: false },
    );
    expect(rejected.phase).toBe("REWRITE");
    expect(rejected.submittedAnswer).toBe("Ela almocou e voltou.");
  });

  it("persiste a modalidade na coluna dedicada", () => {
    const preset = mapGlobalPreferenceRow({
      game_mode: "write",
      write_activity_mode: "rewrite",
      write_rewrite_side: "b",
      write_rewrite_prompt_mode: "listening",
      write_correction_mode: "hard",
    }, "write");
    expect(preset?.writeRewritePromptMode).toBe("listening");
    expect(toGlobalPreferenceRow("user-1", {
      ...DEFAULT_STUDY_PRESET,
      writeActivityMode: "rewrite",
      writeRewritePromptMode: "listening",
    }, "write")).toMatchObject({ write_rewrite_prompt_mode: "listening" });
  });
});

