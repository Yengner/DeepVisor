/** Bounded FIFO admission; callers retain their own ordering and error handling. */
export function limiter(concurrency: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(operation: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try { return await operation(); }
    finally { const next = waiting.shift(); if (next) next(); else active--; }
  };
}
export async function parallelTasks<T extends readonly (() => Promise<unknown>)[]>(tasks: T, concurrency = 3): Promise<{[K in keyof T]: Awaited<ReturnType<T[K]>>}> {
  const run = limiter(concurrency);
  // Settle all started work before returning a failure to the durable worker.
  let failed = false;
  const results = await Promise.allSettled(tasks.map(task => run(async () => {
    if (failed) return undefined;
    try { return await task(); } catch (error) { failed = true; throw error; }
  })));
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return results.map(result => (result as PromiseFulfilledResult<unknown>).value) as {[K in keyof T]: Awaited<ReturnType<T[K]>>};
}
