export class OperationTimeoutError extends Error {
  readonly code = "OPERATION_TIMEOUT";

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} excedeu o limite de ${timeoutMs}ms.`);
    this.name = "OperationTimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new OperationTimeoutError(operation, timeoutMs)), timeoutMs);
    promise.then(resolve, reject).finally(() => {
      if (timer) clearTimeout(timer);
    });
  });
}
