/** Monthly retention buckets do not record which days they contain. Never add
 * an overlapping daily bucket unless disjoint measurement coverage is provable. */
export function nonOverlappingHistory<T extends { day: string }>(monthly: T[], daily: T[]) {
  const dailyMonths = new Set(daily.map(row => row.day.slice(0, 7)));
  const ambiguous = [...new Set(monthly.map(row => row.day.slice(0, 7)).filter(month => dailyMonths.has(month)))];
  const ambiguousSet = new Set(ambiguous);
  return {
    rows: [...monthly, ...daily].filter(row => !ambiguousSet.has(row.day.slice(0, 7))),
    warnings: ambiguous.map(month => `${month}: trend totals unavailable because monthly and daily measurement coverage may overlap.`),
  };
}
