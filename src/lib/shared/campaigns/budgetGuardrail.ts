/**
 * The most a draft may plan to spend, given the top of the business's saved monthly budget range:
 * 25% headroom per month covered (at least one month). One rule for the server (which refuses
 * drafts above it) and for screens that show the limit before the owner presses a button.
 */
export function profileSpendLimit(monthlyCap: number, durationDays: number): number {
  return monthlyCap * Math.max(1, durationDays / 30) * 1.25;
}
