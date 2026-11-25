/**
 * Parses a timestamp-like string into milliseconds, returning `null` when parsing fails.
 *
 * @param value - ISO timestamp or date-like string to parse.
 * @returns The Unix timestamp in milliseconds, or `null` when the value is empty or invalid.
 */
export function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Formats a stored date string for compact UI display such as tables, labels, and chips.
 *
 * @param value - Optional date string to render.
 * @returns A short display date like `Apr 14, 2026`, or an empty string when missing.
 */
export function formatDisplayDate(value?: string | null): string {
  if (!value) return '';
  // A date-only value ("2026-10-28") is a calendar day. Parsing it as UTC midnight and
  // formatting in the local zone shifts it to the previous day west of UTC.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(dateOnly ? `${value}T12:00:00Z` : value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}
