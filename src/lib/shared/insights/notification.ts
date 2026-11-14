/** The account-local calendar day an update was saved, used for daily notification bundles and history groups. */
export function presentationDay(createdAt: string, timezone: string | null): string {
  const date = new Date(createdAt);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone ?? undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export interface DailyBundle { day: string; presentationIds: string[]; urgent: boolean }

/**
 * One bell notification per account per day. Each new update joins the day's bundle; the bundle
 * stays urgent once any update in it needed attention, and links to the update itself when alone.
 */
export function dailyNotification(previous: DailyBundle | null, next: { id: string; urgent: boolean; day: string }) {
  const ids = [...new Set([...(previous?.presentationIds ?? []), next.id])];
  const urgent = Boolean(previous?.urgent) || next.urgent;
  const many = ids.length > 1;
  return {
    bundle: { day: next.day, presentationIds: ids, urgent } satisfies DailyBundle,
    title: many ? `${ids.length} advertising updates today` : 'Your advertising update',
    message: urgent
      ? many ? 'At least one of today’s updates needs your attention.' : 'An advertising update needs your attention.'
      : many ? 'Your catch-up and recent changes are ready.' : 'Your saved advertising catch-up is ready.',
    link: many ? `/insights?day=${next.day}` : `/insights?id=${next.id}`,
    severity: urgent ? 'warning' : 'info',
  };
}
