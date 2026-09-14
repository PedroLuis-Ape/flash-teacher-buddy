import { useCallback, useMemo } from "react";
import type { StudyPreset, StudyPresetOverride } from "@/features/study/preferences/studyPreset";
import { emitStudyFlowModeChanged } from "@/features/study/lib/studyFlowModePreference";
import { STUDY_RED_FOCUS_TRANSITION_EVENT } from "@/hooks/useStudyPreferences";
import {
  applyStudySettingsPatch,
  patchAffectsQueue,
  releaseRedFocusConstraints,
  studySettingsFromPreset,
  studySettingsSemanticOverride,
  studySettingsToPresetOverride,
  type StudySettingsPatchV3,
  type StudySettingsSnapshotV3,
} from "@/features/study/lib/studySettingsSnapshotV3";

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
  applyRuntime: (next: StudySettingsSnapshotV3, patch: StudySettingsPatchV3) => void;
  /**
   * Política explícita para campos que reconstroem a fila: salvar a sessão
   * anterior e reconciliar. Nunca reiniciar em silêncio.
   */
  onQueueAffectingChange?: (next: StudySettingsSnapshotV3, patch: StudySettingsPatchV3) => void;
  onFavoritesUnavailable?: () => void;
}

export interface StudySettingsController {
  settings: StudySettingsSnapshotV3;
  applyStudySettingsChange: (patch: StudySettingsPatchV3) => StudySettingsSnapshotV3;
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

  const applyStudySettingsChange = useCallback((patch: StudySettingsPatchV3) => {
    let requested = patch;
    if (requested.scope === "favorites" && !canUseFavorites) {
      onFavoritesUnavailable?.();
      requested = { ...requested, scope: "all" };
    }

    const patched = applyStudySettingsPatch(settings, requested);
    // Sair do Foco Vermelho devolve ordem e formato ao preset base: a restrição
    // é temporária e nunca substituiu a preferência do usuário.
    const next = settings.redFocus && requested.redFocus === false
      ? releaseRedFocusConstraints(patched, effectivePreset)
      : patched;
    const effectivePatch: StudySettingsPatchV3 = { ...requested };
    if (next.order !== settings.order) effectivePatch.order = next.order;
    if (next.studyFlowMode !== settings.studyFlowMode) effectivePatch.studyFlowMode = next.studyFlowMode;

    if (patchAffectsQueue(effectivePatch)) {
      onQueueAffectingChange?.(next, effectivePatch);
    }

    if (effectivePatch.redFocus !== undefined && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(STUDY_RED_FOCUS_TRANSITION_EVENT, {
        detail: { enabled: next.redFocus },
      }));
    }

    applyRuntime(next, effectivePatch);

    // Consumidores leves (ex.: gate de avanço) escutam a troca de formato.
    if (effectivePatch.studyFlowMode !== undefined) {
      emitStudyFlowModeChanged(next.studyFlowMode);
    }

    // A sessão em andamento acompanha o estado EFETIVO (que pode incluir a
    // restrição temporária do Foco Vermelho), mas o preset da lista/modo grava
    // somente as decisões que o usuário tomou nesta ação — nunca o snapshot
    // inteiro, e nunca uma restrição temporária.
    setSessionOverrides(studySettingsToPresetOverride(next));
    persistPreset(studySettingsSemanticOverride(next, requested));

    return next;
  }, [
    applyRuntime,
    canUseFavorites,
    effectivePreset,
    onFavoritesUnavailable,
    onQueueAffectingChange,
    persistPreset,
    setSessionOverrides,
    settings,
  ]);

  return { settings, applyStudySettingsChange };
}
