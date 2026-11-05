type PageQuery<T> = (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: unknown;
}>;

/**
 * Traverse inclusive PostgREST ranges. Callers retain authorization, filters and
 * stable ordering; a later page failure must never return a partial success.
 * Legacy repository reads treat null data as empty. Strict loaders opt into an
 * error, preserving their existing unavailable-state contract.
 */
export async function readAllPages<T>(
  read: PageQuery<T>,
  options: { nullDataError?: string } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await read(from, from + 499);
    if (error) throw error;
    if (!data && options.nullDataError) throw new Error(options.nullDataError);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

/** Existing Overview/exploration/organizer contract, including its error text. */
export function allPages<T>(read: PageQuery<T>): Promise<T[]> {
  return readAllPages(read, { nullDataError: 'Overview data unavailable' });
}

/** Keep ID filters bounded while fully traversing each batch. */
export async function readPagesByIds<T>(
  ids: string[],
  query: (ids: string[], from: number, to: number) => ReturnType<PageQuery<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    rows.push(...await allPages((from, to) => query(ids.slice(i, i + 100), from, to)));
  }
  return rows;
}
