/**
 * Records where each business-profile value came from, stored in
 * `business_profiles.field_sources` as `{ [column]: { source, updated_at } }`.
 * Only `user` is written today; the other sources are reserved for later
 * lookup/suggestion phases so they need no schema change. Pure: no I/O.
 */

export const FIELD_SOURCES = ['user', 'default', 'google_places', 'website_ai', 'meta_page'] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];

export type FieldSourceEntry = {
  source: FieldSource;
  updated_at: string;
};

export type FieldSourceMap = Record<string, FieldSourceEntry>;

function isFieldSource(value: unknown): value is FieldSource {
  return typeof value === 'string' && (FIELD_SOURCES as readonly string[]).includes(value);
}

/** Keeps only well-formed entries from a stored jsonb value. */
export function parseFieldSources(value: unknown): FieldSourceMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const parsed: FieldSourceMap = {};
  for (const [column, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const { source, updated_at: updatedAt } = entry as Record<string, unknown>;
    if (isFieldSource(source) && typeof updatedAt === 'string') {
      parsed[column] = { source, updated_at: updatedAt };
    }
  }
  return parsed;
}

/** Returns a new map with `columns` stamped as coming from `source` at `now`. */
export function recordFieldSources(
  existing: unknown,
  columns: readonly string[],
  source: FieldSource,
  now: Date
): FieldSourceMap {
  const next = parseFieldSources(existing);
  const updatedAt = now.toISOString();
  for (const column of columns) {
    next[column] = { source, updated_at: updatedAt };
  }
  return next;
}
