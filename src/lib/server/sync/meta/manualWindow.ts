export function manualMetaWindow(timezone: string | null, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const until = `${part('year')}-${part('month')}-${part('day')}`;
  const start = new Date(`${until}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { since: start.toISOString().slice(0, 10), until, backfillDays: 30 };
}
