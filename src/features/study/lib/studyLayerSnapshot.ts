/**
 * Persistência da camada visível dentro de um card com camadas.
 *
 * Complementa o `studySessionSnapshot` (que guarda o índice do deck) e o
 * `masterySessionSnapshot` (rodadas de domínio). Sem isso, ao fechar e reabrir
 * o app o usuário volta no card correto mas SEMPRE na camada 0, mesmo tendo
 * saído numa camada avançada.
 *
 * Chave = `${studySnapshotKey}:layer`, então a camada é escopada ao mesmo
 * usuário/lista/modo/direção do snapshot do deck. Se qualquer um desses
 * escopos muda, a persistência de camada é ignorada automaticamente.
 */

export interface StudyLayerSnapshot {
  version: 1;
  cardId: string;
  layerIdx: number;
  timestamp: number;
}

const SUFFIX = ":layer";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function studyLayerSnapshotKey(studySnapshotKey: string): string {
  return `${studySnapshotKey}${SUFFIX}`;
}

export function readStudyLayerSnapshot(
  studySnapshotKey: string,
  now: number = Date.now(),
): StudyLayerSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(studyLayerSnapshotKey(studySnapshotKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudyLayerSnapshot>;
    if (
      parsed.version !== 1
      || typeof parsed.cardId !== "string"
      || !parsed.cardId
      || !Number.isFinite(Number(parsed.layerIdx))
      || !Number.isFinite(Number(parsed.timestamp))
    ) {
      window.localStorage.removeItem(studyLayerSnapshotKey(studySnapshotKey));
      return null;
    }
    if (now - Number(parsed.timestamp) > MAX_AGE_MS) {
      window.localStorage.removeItem(studyLayerSnapshotKey(studySnapshotKey));
      return null;
    }
    return {
      version: 1,
      cardId: parsed.cardId,
      layerIdx: Math.max(0, Math.floor(Number(parsed.layerIdx))),
      timestamp: Number(parsed.timestamp),
    };
  } catch {
    return null;
  }
}

export function writeStudyLayerSnapshot(
  studySnapshotKey: string,
  cardId: string,
  layerIdx: number,
): void {
  if (typeof window === "undefined") return;
  if (!cardId) return;
  try {
    const payload: StudyLayerSnapshot = {
      version: 1,
      cardId,
      layerIdx: Math.max(0, Math.floor(layerIdx)),
      timestamp: Date.now(),
    };
    window.localStorage.setItem(
      studyLayerSnapshotKey(studySnapshotKey),
      JSON.stringify(payload),
    );
  } catch {
    // Storage indisponível — o snapshot do deck ainda garante o card certo.
  }
}

export function clearStudyLayerSnapshot(studySnapshotKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(studyLayerSnapshotKey(studySnapshotKey));
  } catch {
    // ignore
  }
}