/**
 * Resultado verificável de um salvamento de progresso.
 *
 * O fluxo explícito de "Salvar e sair" precisa distinguir uma confirmação
 * remota de um salvamento apenas local. Nunca fingimos sincronização remota.
 */
export type SaveProgressResult =
  | { status: "remote-confirmed"; sessionId: string; updatedAt: number }
  | { status: "local-only"; sessionId: string | null; updatedAt: number; reason: string }
  | { status: "failed"; reason: string };

export function isRemoteConfirmed(result: SaveProgressResult): boolean {
  return result.status === "remote-confirmed";
}

export function describeSaveProgressResult(result: SaveProgressResult): string {
  if (result.status === "remote-confirmed") return "Progresso salvo e sincronizado.";
  if (result.status === "local-only") return "Salvo apenas neste aparelho — sincronizaremos quando houver conexão.";
  return "Não foi possível salvar o progresso agora.";
}

/**
 * Aguarda o salvamento com um limite de tempo. O tempo esgotado não é uma
 * confirmação remota: o retorno degrada explicitamente para local-only.
 */
export async function awaitSaveProgress(
  run: () => Promise<SaveProgressResult>,
  timeoutMs = 3500,
): Promise<SaveProgressResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SaveProgressResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ status: "local-only", sessionId: null, updatedAt: Date.now(), reason: "remote-timeout" }),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([
      run().catch((error): SaveProgressResult => ({
        status: "failed",
        reason: error instanceof Error ? error.message : "save-progress-failed",
      })),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
