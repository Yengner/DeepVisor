import type { ReportCoverage } from './types';
import { isReportDate } from './dates';

/** Owner-facing labels for raw Meta enums, dimension values, dates and hours. Presentation only. */

const OBJECTIVES: Record<string, string> = {
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_APP_PROMOTION: 'App promotion',
  LEAD_GENERATION: 'Lead generation',
  CONVERSATIONS: 'Conversations',
  LINK_CLICKS: 'Link clicks',
  OFFSITE_CONVERSIONS: 'Website conversions',
  POST_ENGAGEMENT: 'Post engagement',
  REACH: 'Reach',
  IMPRESSIONS: 'Impressions',
  QUALITY_LEAD: 'Quality leads',
  LANDING_PAGE_VIEWS: 'Landing page views',
  THRUPLAY: 'ThruPlay',
};

/** Meta enum (e.g. OUTCOME_LEADS) → readable label; unknown values are sentence-cased. */
export function humanizeObjective(value?: string | null): string {
  if (!value || value.toUpperCase() === 'UNKNOWN') return '—';
  const key = value.toUpperCase();
  if (OBJECTIVES[key]) return OBJECTIVES[key];
  const words = key.replace(/^OUTCOME_/, '').toLowerCase().split('_').filter(Boolean).join(' ');
  return words ? words[0].toUpperCase() + words.slice(1) : '—';
}

/** Entity context line part: Meta enums (OUTCOME_LEADS) become words; names pass through. */
export function humanizeContext(value?: string | null): string | null {
  if (!value) return null;
  return /^[A-Z][A-Z0-9_]+$/.test(value) ? humanizeObjective(value) : value;
}

const sentence = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : value;

const PLATFORMS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger',
  audience_network: 'Audience Network', threads: 'Threads', whatsapp: 'WhatsApp',
};
const DEVICES: Record<string, string> = {
  iphone: 'iPhone', ipad: 'iPad', android_smartphone: 'Android phone', android_tablet: 'Android tablet',
  desktop: 'Desktop', ipod: 'iPod', other: 'Other devices',
};

let regionNames: Intl.DisplayNames | null | undefined;
function countryName(code: string): string {
  if (regionNames === undefined) {
    try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { regionNames = null; }
  }
  if (!regionNames || !/^[A-Z]{2}$/.test(code)) return code;
  try { return regionNames.of(code) ?? code; } catch { return code; }
}

/** One raw breakdown value → readable text. Unknown values stay recognisable rather than invented. */
function humanizePart(dimension: string, raw: string): string {
  const value = raw.trim();
  if (!value) return 'Unknown';
  const lower = value.toLowerCase();
  if (lower === 'unknown') return 'Unknown';
  if (dimension === 'country') return countryName(value.toUpperCase());
  if (dimension === 'publisher_platform') return PLATFORMS[lower] ?? sentence(lower.replaceAll('_', ' '));
  if (dimension === 'impression_device') return DEVICES[lower] ?? sentence(lower.replaceAll('_', ' '));
  if (dimension === 'platform_position') return sentence(lower.replaceAll('_', ' '));
  if (/^\d+-\d+$/.test(value)) return value.replace('-', '–');
  if (lower === 'female' || lower === 'male') return sentence(lower);
  return value;
}

/** Breakdown segment label ("45-54 · female" → "45–54 · Female", "US" → "United States"). */
export function segmentLabel(dimension: string, label: string): string {
  return label.split(' · ').map(part => humanizePart(dimension, part)).join(' · ');
}

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const DAY_NO_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function formatReportDay(iso: string | null | undefined, withYear = true): string {
  if (!iso || !isReportDate(iso)) return 'Unknown';
  return (withYear ? DAY : DAY_NO_YEAR).format(new Date(`${iso}T12:00:00Z`));
}

/** "Oct 14 – Nov 12, 2026", or with both years when they differ. */
export function formatReportRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to || !isReportDate(from) || !isReportDate(to)) return 'Unknown dates';
  if (from === to) return formatReportDay(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatReportDay(from, !sameYear)} – ${formatReportDay(to)}`;
}

/** Snapshot window ("2023-10-18 / 2026-11-13") → readable range; unknown windows are explicit. */
export function formatSnapshotWindow(window: string): string {
  const [from, to] = window.split(' / ');
  return from && to && isReportDate(from) && isReportDate(to) ? formatReportRange(from, to) : 'Dates unknown';
}

/** "America/New_York" → "New York time". */
export function formatTimezone(timezone: string | null | undefined): string {
  if (!timezone) return 'Timezone unknown';
  const city = timezone.split('/').at(-1)?.replaceAll('_', ' ');
  return city ? `${city} time` : timezone;
}

/** 0 → "12 AM", 15 → "3 PM". */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Compact axis label: 0 → "12a", 15 → "3p". */
export function formatHourShort(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
}

/**
 * Period coverage as one plain sentence. Partial coverage states how many days have saved
 * records and that the gaps are missing data, not zero.
 */
export function coverageSentence(coverage: ReportCoverage | undefined): string | null {
  if (!coverage || coverage.state === 'available') return null;
  if (coverage.state === 'error') return 'Saved performance data could not be loaded. Reload the report to try again.';
  if (coverage.state === 'empty') return 'No saved performance records for these dates.';
  if (coverage.state === 'unknown') return 'Coverage for these dates is unknown.';
  if (coverage.state === 'mixed') return 'Saved records come from different measurement windows.';
  const days = coverage.observedDays != null && coverage.expectedDays != null
    ? `${coverage.observedDays} of ${coverage.expectedDays} days`
    : 'Some days';
  return `${days} have saved records (${formatReportRange(coverage.dateFrom, coverage.dateTo)}). Days without records are gaps, not zero.`;
}
