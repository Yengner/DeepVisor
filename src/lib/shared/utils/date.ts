/**
 * Converts Unix timestamps from Stripe API to JavaScript Date objects and formatted strings
 *
 * @param unixTimestamp - Unix timestamp in seconds.
 * @returns A bundle of formatted date variants, or `null` when the input is missing.
 */
export function formatStripeTimestamp(unixTimestamp: number | null | undefined) {
  if (!unixTimestamp) return null;
  
  // Convert seconds to milliseconds for JavaScript Date
  const date = new Date(unixTimestamp * 1000);
  
  return {
    // Raw date object
    date,
    
    // ISO string (for database storage)
    iso: date.toISOString(),
    
    // Human-readable format (e.g., "Jun 19, 2025")
    readable: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    
    // Date with time (e.g., "Jun 19, 2025, 2:30 PM")
    fullDateTime: date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }),
    
    // Relative time (e.g., "in 2 months" or "3 days ago")
    relative: getRelativeTimeString(date)
  };
}

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

/**
 * Returns a human-readable relative time string
 */
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0) {
    if (diffDays < 30) return `in ${diffDays} days`;
    if (diffDays < 365) return `in ${Math.round(diffDays / 30)} months`;
    return `in ${Math.round(diffDays / 365)} years`;
  } else {
    const absDiffDays = Math.abs(diffDays);
    if (absDiffDays < 30) return `${absDiffDays} days ago`;
    if (absDiffDays < 365) return `${Math.round(absDiffDays / 30)} months ago`;
    return `${Math.round(absDiffDays / 365)} years ago`;
  }
}
