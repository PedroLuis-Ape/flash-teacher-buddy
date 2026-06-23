interface TurmaCreateErrorPayload {
  error?: string;
  message?: string;
  code?: string;
}

export async function readTurmaCreateFunctionError(error: unknown): Promise<Error> {
  const invokeError = error as { message?: string; context?: Response } | null;
  let payload: TurmaCreateErrorPayload | null = null;

  try {
    if (invokeError?.context) {
      payload = await invokeError.context.clone().json() as TurmaCreateErrorPayload;
    }
  } catch {
    payload = null;
  }

  const genericInvokeMessage = 'Edge Function returned a non-2xx status code';
  const explicit = payload?.error?.trim() || payload?.message?.trim();
  const fallback = invokeError?.message && invokeError.message !== genericInvokeMessage
    ? invokeError.message
    : 'Não foi possível criar a turma.';

  const normalized = new Error(explicit || fallback);
  (normalized as Error & { code?: string }).code = payload?.code;
  return normalized;
}
