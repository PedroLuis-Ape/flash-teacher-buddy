/**
 * Onda 1 — utilitários puros de loteamento para a importação de explicações
 * de Especiais. Mantém a thread principal responsiva ao processar grandes
 * quantidades (centenas/milhares) sem introduzir Web Worker nesta entrega.
 *
 * NÃO altera contratos de banco. Apenas divide chamadas existentes em lotes.
 */

export const VALIDATE_LOOKUP_BATCH = 100;
export const APPLY_BATCH = 50;

export function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Cede o controle para o browser entre lotes — evita long tasks acima de ~200ms. */
export function yieldToMain(): Promise<void> {
  // scheduler.yield é a API nativa quando existe; cai para setTimeout(0).
  const anyScheduler = (globalThis as any).scheduler;
  if (anyScheduler && typeof anyScheduler.yield === "function") {
    return anyScheduler.yield();
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export interface BatchProgress {
  processed: number;
  total: number;
  batchIndex: number;
  batchCount: number;
}

/**
 * Executa `fn` em lotes sequenciais, com yield entre lotes e suporte a
 * cancelamento cooperativo via AbortSignal (somente ENTRE lotes — o lote em
 * andamento sempre é concluído).
 */
export async function runInBatches<T, R>(
  items: readonly T[],
  size: number,
  fn: (batch: T[], info: BatchProgress) => Promise<R>,
  opts?: { signal?: AbortSignal; onProgress?: (p: BatchProgress) => void }
): Promise<R[]> {
  const batches = chunk(items, size);
  const results: R[] = [];
  let processed = 0;
  for (let i = 0; i < batches.length; i++) {
    if (opts?.signal?.aborted) break;
    const batch = batches[i];
    const info: BatchProgress = {
      processed,
      total: items.length,
      batchIndex: i,
      batchCount: batches.length,
    };
    opts?.onProgress?.(info);
    const r = await fn(batch, info);
    results.push(r);
    processed += batch.length;
    opts?.onProgress?.({ ...info, processed });
    if (i < batches.length - 1) await yieldToMain();
  }
  return results;
}