import { useSyncExternalStore } from "react";

/**
 * Derivação READ-ONLY dos RÓTULOS dos lados (A/B) da lista em estudo.
 *
 * Esta store NÃO é fonte de verdade de comportamento. Ela existe apenas para
 * que a janela de configurações possa escrever "Responder em Português" usando
 * o rótulo real da lista. Toda decisão de lado (pergunta/resposta) e de Play
 * vive no contrato canônico (`StudySettingsSnapshotV3`), lido por props a
 * partir de Study/MixedStudy — ver [[04-DECISIONS]].
 */
type PlayPresetRuntimeSnapshot = {
  labelA: string;
  labelB: string;
};

let snapshot: PlayPresetRuntimeSnapshot = {
  labelA: "Lado A",
  labelB: "Lado B",
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setPlayPresetRuntime(
  partial: Partial<PlayPresetRuntimeSnapshot>,
): void {
  const next = { ...snapshot, ...partial };
  if (next.labelA === snapshot.labelA && next.labelB === snapshot.labelB) return;
  snapshot = next;
  emit();
}

export function getPlayPresetRuntime(): PlayPresetRuntimeSnapshot {
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayPresetRuntime(): PlayPresetRuntimeSnapshot {
  return useSyncExternalStore(subscribe, getPlayPresetRuntime, getPlayPresetRuntime);
}
