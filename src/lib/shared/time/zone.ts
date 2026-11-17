/** Account-timezone day helpers. Pure: no I/O. */

/** Calendar day (YYYY-MM-DD) of an instant in `zone`. */
export function dayIn(zone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** UTC instant of local midnight on `day` (YYYY-MM-DD) in `zone`, correct across DST changes. */
export function localMidnightUtc(day: string, zone: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const offset = (at: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(at)).map(p => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - at;
  };
  let at = guess - offset(guess);
  at = guess - offset(at);
  return new Date(at);
}
