/** Stable grouping preserves the existing ordering within active/inactive rows. */
export function activeDeliveryFirst<T extends { delivery?: boolean }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(Boolean(b.delivery)) - Number(Boolean(a.delivery)));
}

/** Default/fallback selection uses the same order as the campaign table. */
export function campaignTableSelection<T extends { id: string; delivery?: boolean }>(
  rows: T[], requestedId?: string | null,
): string | null {
  return requestedId && rows.some(row => row.id === requestedId)
    ? requestedId
    : activeDeliveryFirst(rows)[0]?.id ?? null;
}
