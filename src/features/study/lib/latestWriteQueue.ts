export interface LatestWriteQueue<T> {
  enqueue(value: T): Promise<void>;
  invalidate(): void;
  drain(): Promise<void>;
}

/**
 * Serializes writes while coalescing work that has not started yet. A write
 * already in flight is allowed to finish, but every newer queued value runs
 * after it, so an older response can never be the final persisted state.
 */
export function createLatestWriteQueue<T>(
  write: (value: T) => PromiseLike<void> | void,
): LatestWriteQueue<T> {
  let chain: Promise<void> = Promise.resolve();
  let generation = 0;
  let latestToken = 0;

  return {
    enqueue(value: T): Promise<void> {
      const token = ++latestToken;
      const currentGeneration = generation;
      const task = chain.then(async () => {
        if (token !== latestToken || currentGeneration !== generation) return;
        await write(value);
      });
      // Keep the queue alive after a failed attempt while preserving the
      // rejection for the caller that owns this specific write.
      chain = task.catch(() => undefined);
      return task;
    },
    invalidate(): void {
      generation += 1;
      latestToken += 1;
    },
    drain(): Promise<void> {
      return chain;
    },
  };
}
