import 'server-only';

export function createServerTimer(
  _namespace: 'context' | 'dashboard',
  _options?: {
    enabledEnvVar?: string;
  }
) {
  return {
    async measure<T>(_label: string, work: () => PromiseLike<T>): Promise<T> {
      return await work();
    },
    measureSync<T>(_label: string, work: () => T): T {
      return work();
    },
    finish(_label = 'total') {
      // Timing output is intentionally disabled for now.
    },
  };
}
