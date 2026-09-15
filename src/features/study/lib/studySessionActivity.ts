/**
 * Marca a ÚLTIMA INTERAÇÃO REAL do usuário em uma sessão de estudo.
 *
 * Único caminho autorizado a escrever `study_sessions.last_activity_*`: o RPC
 * `touch_study_session_activity_v1` (auth.uid, própria sessão, revisão
 * monotônica). Persistência, outbox, retry e reconciliação continuam gravando
 * `updated_at` e NUNCA passam por aqui — foi exatamente essa confusão que fazia
 * o card "Voltar para onde parou" ressuscitar uma lista antiga.
 */
export interface StudySessionActivityInput {
  sessionId: string;
  /** Revisão monotônica (ms do relógio local): resposta atrasada não volta. */
  revision: number;
  cardId?: string | null;
  cardIndex?: number | null;
  layerIndex?: number | null;
}

export interface StudySessionActivityClient {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildStudySessionActivityParams(
  input: StudySessionActivityInput,
): Record<string, unknown> | null {
  if (!input.sessionId || !UUID_RE.test(input.sessionId)) return null;
  if (!Number.isFinite(input.revision) || input.revision <= 0) return null;
  const cardId = typeof input.cardId === "string" && UUID_RE.test(input.cardId) ? input.cardId : null;
  return {
    p_session_id: input.sessionId,
    p_revision: Math.trunc(input.revision),
    p_card_id: cardId,
    p_card_index: Number.isFinite(input.cardIndex as number)
      ? Math.max(0, Math.trunc(input.cardIndex as number))
      : null,
    p_layer_index: Number.isFinite(input.layerIndex as number)
      ? Math.trunc(input.layerIndex as number)
      : null,
  };
}

export async function touchStudySessionActivity(
  input: StudySessionActivityInput,
  client?: StudySessionActivityClient,
): Promise<boolean> {
  const params = buildStudySessionActivityParams(input);
  if (!params) return false;
  try {
    const target = client
      ?? ((await import("@/integrations/supabase/client")).supabase as unknown as StudySessionActivityClient);
    const { error } = await target.rpc("touch_study_session_activity_v1", params);
    return !error;
  } catch {
    // Falha de rede não pode quebrar a sessão: o ponteiro local já respondeu e
    // a próxima atividade tenta de novo com revisão maior.
    return false;
  }
}
