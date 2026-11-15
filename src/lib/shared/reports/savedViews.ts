import { formatReportRange } from './labels';
/** /reports parameters a saved view may keep. Everything else (demo, section hashes, junk) is dropped. */
const KEYS = ['platform_integration_id', 'ad_account_id', 'campaign_id', 'adset_id', 'ad_id', 'scope', 'preset', 'date_from', 'date_to', 'range', 'group_by', 'compare'] as const;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const VALID: Partial<Record<typeof KEYS[number], RegExp>> = {
  preset: /^(7|30|90)$/, date_from: /^\d{4}-\d{2}-\d{2}$/, date_to: /^\d{4}-\d{2}-\d{2}$/,
  range: /^max$/, group_by: /^(day|week|month)$/, compare: /^(none|previous_period)$/,
  scope: /^(business|platform|ad_account|campaign|adset|ad)$/,
};
export const MAX_VIEW_NAME = 80;
export const MAX_VIEWS_PER_BUSINESS = 50;

/**
 * Sanitize a /reports query for saving. A rolling preset (7/30/90 days) is kept instead of the
 * concrete dates it resolved to, so "Last 30 days" stays "last 30 days" when reopened.
 */
export function normalizeSavedViewQuery(search: string, rollingPreset?: 7 | 30 | 90 | null): string {
  const input = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const out = new URLSearchParams();
  for (const key of KEYS) for (const value of input.getAll(key)) {
    if ((VALID[key] ?? ID).test(value)) out.append(key, value);
  }
  if (rollingPreset) { out.delete('date_from'); out.delete('date_to'); out.delete('range'); out.set('preset', String(rollingPreset)); }
  if (out.get('range') === 'max') { out.delete('preset'); out.delete('date_from'); out.delete('date_to'); out.delete('compare'); }
  else if (out.has('preset')) { out.delete('date_from'); out.delete('date_to'); }
  return out.toString();
}

export function normalizeSavedViewName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return trimmed && trimmed.length <= MAX_VIEW_NAME ? trimmed : null;
}

/** Plain-language range for a saved view row, e.g. "Rolling 30 days" or "Oct 1 – Oct 31". */
export function savedViewRangeLabel(query: string): string {
  const params = new URLSearchParams(query);
  if (params.get('range') === 'max') return 'All saved history';
  if (params.get('preset')) return `Rolling ${params.get('preset')} days`;
  const from = params.get('date_from'), to = params.get('date_to');
  return from && to ? formatReportRange(from, to) : 'Rolling 30 days';
}
