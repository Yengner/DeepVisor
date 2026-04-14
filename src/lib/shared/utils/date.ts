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
 * Formats a Date as `YYYY-MM-DD`, which is the format used by reporting filters and rollups.
 *
 * @param date - JavaScript Date to serialize.
 * @returns An ISO-style day string without the time portion.
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the current day normalized to midnight UTC to avoid local timezone drift in queries.
 *
 * @returns A Date representing "today" at `00:00:00` UTC.
 */
export function getUtcToday(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Builds an inclusive trailing UTC date range ending today.
 *
 * @param days - Number of days to include in the window. Values below 1 are clamped to 1.
 * @returns An object containing `dateFrom` and `dateTo` in `YYYY-MM-DD` format.
 */
export function getTrailingUtcDateRange(days: number): {
  dateFrom: string;
  dateTo: string;
} {
  const safeDays = Math.max(1, Math.floor(days));
  const dateTo = getUtcToday();
  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - (safeDays - 1));

  return {
    dateFrom: toIsoDate(dateFrom),
    dateTo: toIsoDate(dateTo),
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
  return value
    ? new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
}

/**
 * Formats a timestamp with both date and time for metadata and detail views.
 *
 * @param value - Timestamp string to render.
 * @returns A human-readable datetime string, or a fallback label when missing.
 */
export function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Allows each surface to customize fallback labels while reusing the same relative-time logic.
 *
 * @property emptyLabel - Label returned when the input is missing.
 * @property invalidLabel - Optional override used when parsing fails.
 * @property futureLabel - Label returned when the timestamp is in the future.
 * @property justNowLabel - Label returned for near-zero age values.
 */
export interface RelativeTimeFormatOptions {
  emptyLabel?: string;
  invalidLabel?: string;
  futureLabel?: string;
  justNowLabel?: string;
}

/**
 * Converts a timestamp into compact relative copy like `12m ago`, `4h ago`, or `3d ago`.
 *
 * @param value - Date or date-like string to format.
 * @param options - Optional label overrides for empty, invalid, future, or near-zero values.
 * @returns A short relative-time label suitable for dashboards and cards.
 */
export function formatRelativeTime(
  value: string | Date | null | undefined,
  options: RelativeTimeFormatOptions = {}
): string {
  const {
    emptyLabel = 'Not available',
    invalidLabel,
    futureLabel = 'Recently updated',
    justNowLabel = 'Just now',
  } = options;

  if (!value) {
    return emptyLabel;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) {
    if (invalidLabel) {
      return invalidLabel;
    }

    return typeof value === 'string' ? value : emptyLabel;
  }

  const deltaMs = Date.now() - timestamp;
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return futureLabel;
  }

  const minutes = Math.round(deltaMs / (60 * 1000));
  if (minutes < 1) {
    return justNowLabel;
  }

  if (minutes < 60) {
    return minutes <= 1 ? justNowLabel : `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
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
