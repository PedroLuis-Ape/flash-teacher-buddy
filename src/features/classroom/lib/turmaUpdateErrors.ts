export type TurmaUpdateErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_VISIBILITY'
  | 'MISSING_SCHEMA'
  | 'UPDATE_FAILED';

export interface TurmaUpdateErrorPayload {
  code?: TurmaUpdateErrorCode | string;
  error?: string;
  message?: string;
}

const messages: Record<TurmaUpdateErrorCode, string> = {
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente para atualizar a turma.',
  FORBIDDEN: 'Você não tem permissão para editar esta turma.',
  INVALID_VISIBILITY: 'A visibilidade enviada é inválida.',
  MISSING_SCHEMA: 'A publicação de turmas ainda não foi instalada no servidor.',
  UPDATE_FAILED: 'Não foi possível salvar as alterações da turma.',
};

export function getTurmaUpdateErrorMessage(
  payload: TurmaUpdateErrorPayload | null | undefined,
  fallback = 'Não foi possível atualizar a turma.',
) {
  const explicitMessage = payload?.error?.trim() || payload?.message?.trim();
  if (explicitMessage) return explicitMessage;

  const code = payload?.code as TurmaUpdateErrorCode | undefined;
  return code && messages[code] ? messages[code] : fallback;
}

export async function readTurmaUpdateFunctionError(error: unknown) {
  const invokeError = error as { message?: string; context?: Response } | null;
  let payload: TurmaUpdateErrorPayload | null = null;

  try {
    if (invokeError?.context) {
      payload = await invokeError.context.clone().json() as TurmaUpdateErrorPayload;
    }
  } catch {
    payload = null;
  }

  const genericInvokeMessage = 'Edge Function returned a non-2xx status code';
  const fallback = invokeError?.message && invokeError.message !== genericInvokeMessage
    ? invokeError.message
    : undefined;
  const normalized = new Error(getTurmaUpdateErrorMessage(payload, fallback));
  (normalized as Error & { code?: string }).code = payload?.code;
  return normalized;
}
