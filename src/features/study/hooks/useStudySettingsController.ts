import { useCallback, useLayoutEffect, useMemo } from "react";
import type { StudyPreset, StudyPresetOverride } from "@/features/study/preferences/studyPreset";
import { emitStudyFlowModeChanged } from "@/features/study/lib/studyFlowModePreference";
import { STUDY_RED_FOCUS_TRANSITION_EVENT } from "@/hooks/useStudyPreferences";
import { setWriteStudyRuntime } from "@/features/study/lib/writeStudyRuntime";
import {
  applyStudySettingsPatch,
  patchAffectsQueue,
  studySettingsFromPreset,
  studySettingsToPresetOverride,
  type StudySettingsPatchV2,
  type StudySettingsSnapshotV2,
} from "@/features/study/lib/studySettingsSnapshotV2";

export interface UseStudySettingsControllerInput {
  /**
   * Preset efetivo já resolvido (default → global do modo → preset da lista →
   * overrides da sessão restaurada). É a única fonte lida pela janela.
   */
  effectivePreset: StudyPreset;
  /** Estado de fila que não pertence ao preset remoto. */
  redFocus: boolean;
  canUseFavorites: boolean;
  /** Persiste no preset da lista/modo (ou global quando não há lista). */
  persistPreset: (override: StudyPresetOverride) => void;
  /** Mantém os overrides da sessão em andamento coerentes com a mudança. */
  setSessionOverrides: (override: StudyPresetOverride) => void;
  /** Aplica o valor imediatamente no runtime (engine, deck, áudio). */
  applyRuntime: (next: StudySettingsSnapshotV2, patch: StudySettingsPatchV2) => void;
  /**
   * Política explícita para campos que reconstroem a fila: salvar a sessão
   * anterior e reconciliar. Nunca reiniciar em silêncio.
   */
  onQueueAffectingChange?: (next: StudySettingsSnapshotV2, patch: StudySettingsPatchV2) => void;
  onFavoritesUnavailable?: () => void;
}

export interface StudySettingsController {
  settings: StudySettingsSnapshotV2;
  applyStudySettingsChange: (patch: StudySettingsPatchV2) => StudySettingsSnapshotV2;
}

/**
 * Fonte única de verdade das configurações da tela de estudo.
 *
 * Study/MixedStudy são donos deste controlador; GameSettingsModal e
 * WriteActivitySettings recebem `settings` + `applyStudySettingsChange` e não
 * hidratam preferências por conta própria.
 */
export function useStudySettingsController(
  input: UseStudySettingsControllerInput,
): StudySettingsController {
  const {
    effectivePreset,
    redFocus,
    canUseFavorites,
    persistPreset,
    setSessionOverrides,
    applyRuntime,
    onQueueAffectingChange,
    onFavoritesUnavailable,
  } = input;

  const settings = useMemo(
    () => studySettingsFromPreset(effectivePreset, { redFocus }),
    [effectivePreset, redFocus],
  );

  // The write card may remount for every card/layer. Mirror the already
  // resolved controller snapshot before paint so those remounts never open a
  // second preference hydration or fall back to another side.
  useLayoutEffect(() => {
    setWriteStudyRuntime({
      writeActivityMode: settings.writeActivityMode,
      writeRewriteSide: settings.writeRewriteSide,
      writeCorrectionMode: settings.writeCorrectionMode,
      studyFlowMode: settings.studyFlowMode,
    });
  }, [
    settings.studyFlowMode,
    settings.writeActivityMode,
    settings.writeCorrectionMode,
    settings.writeRewriteSide,
  ]);

  const applyStudySettingsChange = useCallback((patch: StudySettingsPatchV2) => {
    let requested = patch;
    if (requested.scope === "favorites" && !canUseFavorites) {
      onFavoritesUnavailable?.();
      requested = { ...requested, scope: "all" };
    }

    const next = applyStudySettingsPatch(settings, requested);
    const effectivePatch: StudySettingsPatchV2 = { ...requested };
    if (next.order !== settings.order) effectivePatch.order = next.order;
    if (next.direction !== settings.direction) effectivePatch.direction = next.direction;
    if (next.writeRewriteSide !== settings.writeRewriteSide) {
      effectivePatch.writeRewriteSide = next.writeRewriteSide;
    }

    if (patchAffectsQueue(effectivePatch)) {
      onQueueAffectingChange?.(next, effectivePatch);
    }

    if (effectivePatch.redFocus !== undefined && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(STUDY_RED_FOCUS_TRANSITION_EVENT, {
        detail: { enabled: next.redFocus },
      }));
    }

    // Keep the write runtime in the same atomic action as the controlled
    // settings patch. The layout effect above remains the hydration/restoration
    // safety net.
    setWriteStudyRuntime({
      writeActivityMode: next.writeActivityMode,
      writeRewriteSide: next.writeRewriteSide,
      writeCorrectionMode: next.writeCorrectionMode,
      studyFlowMode: next.studyFlowMode,
    });

    applyRuntime(next, effectivePatch);

    if (effectivePatch.studyFlowMode !== undefined) {
      emitStudyFlowModeChanged(next.studyFlowMode);
    }

    const presetOverride = studySettingsToPresetOverride(next);
    setSessionOverrides(presetOverride);
    persistPreset(presetOverride);

    return next;
  }, [
    applyRuntime,
    canUseFavorites,
    onFavoritesUnavailable,
    onQueueAffectingChange,
    persistPreset,
    setSessionOverrides,
    settings,
  ]);

  return { settings, applyStudySettingsChange };
}
