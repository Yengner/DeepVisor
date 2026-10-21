/** Re-read the attribution lookback while retaining a longer gap after interrupted syncs. */
export function incrementalWindow(syncedThrough: string, until: string, lookbackDays: number) {
  const end = new Date(`${until}T00:00:00Z`);
  const lookback = new Date(end);
  lookback.setUTCDate(lookback.getUTCDate() - Math.max(1, lookbackDays) + 1);
  const since = [syncedThrough, lookback.toISOString().slice(0,10)].sort()[0];
  return { since, until, backfillDays: Math.floor((end.getTime() - Date.parse(`${since}T00:00:00Z`)) / 86400000) + 1 };
}
