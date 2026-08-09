/**
 * Fonte única de rota para retomada de estudo.
 *
 * O botão da Home e o banner "Continuar" usam este helper — nenhum componente
 * deve remontar a rota manualmente. A sessionId viaja em parâmetro técnico da
 * URL (`resume_session`) porque location.state não sobrevive a refresh, PWA
 * reiniciada, aba descartada pelo sistema ou deep link.
 */
import { isSafeStudyResumePath } from "./studyResume";
import type { StudySettingsSnapshotV2 } from "./studySettingsSnapshotV2";

export const RESUME_SESSION_PARAM = "resume_session";

const BASE_ORIGIN = "https://www.apeeducation.org";
const UUID_RE = /^[0-9a-fA-F-]{8,64}$/;

export interface StudyResumeRouteInput {
  path: string;
  sessionId: string;
}

/** Remove o token transitorio antes de persistir o path no ponteiro local. */
export function canonicalizeStudyResumePath(path: string): string | null {
  if (!path || !isSafeStudyResumePath(path)) return null;
  const url = new URL(path, BASE_ORIGIN);
  url.searchParams.delete(RESUME_SESSION_PARAM);
  const canonical = `${url.pathname}${url.search}${url.hash}`;
  return isSafeStudyResumePath(canonical) ? canonical : null;
}

/** Devolve o path de estudo com `resume_session` aplicado, ou null se inseguro. */
export function buildStudyResumeRoute(input: StudyResumeRouteInput): string | null {
  if (!input?.path || !input.sessionId || !UUID_RE.test(input.sessionId)) return null;
  if (!isSafeStudyResumePath(input.path)) return null;
  const url = new URL(input.path, BASE_ORIGIN);
  url.searchParams.set(RESUME_SESSION_PARAM, input.sessionId);
  return `${url.pathname}${url.search}`;
}

/** Lê a sessão pedida a partir da query string da rota atual. */
export function parseRequestedResumeSessionId(
  search: string | URLSearchParams,
): string | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const value = params.get(RESUME_SESSION_PARAM);
  return value && UUID_RE.test(value) ? value : null;
}

/** Remove o parâmetro técnico da URL sem recarregar a página nem apagar o resto. */
export function stripResumeSessionParamFromUrl(win: Window = window): void {
  try {
    const url = new URL(win.location.href);
    if (!url.searchParams.has(RESUME_SESSION_PARAM)) return;
    url.searchParams.delete(RESUME_SESSION_PARAM);
    win.history.replaceState(win.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Sem history disponível a URL continua funcional; nada a fazer.
  }
}

/**
 * Reconstrói um path de estudo a partir de uma sessão remota, quando o ponteiro
 * local não existe (outro aparelho, cache limpo, PWA reinstalada).
 */
export function buildStudyPathFromRemoteSession(input: {
  listId: string;
  mode: string;
  settings?: Partial<StudySettingsSnapshotV2> | null;
}): string | null {
  if (!input.listId || !input.mode) return null;
  const url = new URL(`/list/${input.listId}/study`, BASE_ORIGIN);
  url.searchParams.set("mode", input.mode);
  const settings = input.settings ?? {};
  if (settings.direction) url.searchParams.set("dir", settings.direction);
  if (settings.order) url.searchParams.set("order", settings.order);
  if (settings.scope === "favorites") url.searchParams.set("favorites", "true");
  if (settings.fastMode) url.searchParams.set("fast", "true");
  const path = `${url.pathname}${url.search}`;
  return isSafeStudyResumePath(path) ? path : null;
}
