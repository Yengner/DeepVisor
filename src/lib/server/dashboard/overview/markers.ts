/**
 * Chart change markers from recorded evidence only: Meta launch/start times of ads and ad
 * sets, and DeepVisor-observed lifecycle events (activated, paused, resumed, …). Budget and
 * targeting edits are not recorded anywhere yet, so they are never inferred. Pure: no I/O.
 */
export type ChartMarker = { day: string; label: string };
export type MarkerEntity = { entity_level: string; name: string | null; raw: unknown };
export type MarkerEvent = { kind: string; created_at: string };

const LIFECYCLE: Record<string, string> = {
  activated: "Ad launched",
  resumed: "Ad resumed",
  paused: "Ad paused",
  parent_paused: "Ad set or campaign paused",
  scheduled_end: "Schedule ended",
  archived: "Ad archived",
};

export function localDay(at: string, zone: string): string | null {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
  } catch {
    return null;
  }
}

export function chartMarkers(entities: MarkerEntity[], events: MarkerEvent[], since: string, until: string, zone: string): ChartMarker[] {
  const found = new Map<string, Set<string>>();
  const add = (at: unknown, label: string) => {
    const day = typeof at === "string" ? localDay(at, zone) : null;
    if (!day || day < since || day > until) return;
    found.set(day, (found.get(day) ?? new Set()).add(label));
  };
  for (const e of entities) {
    const raw = e.raw && typeof e.raw === "object" ? (e.raw as Record<string, unknown>) : {};
    if (e.entity_level === "ad") add(raw.created_time, "New ad");
    else if (e.entity_level === "adset") add(raw.start_time ?? raw.created_time, "Ad set started");
    else if (e.entity_level === "campaign") add(raw.start_time ?? raw.created_time, "Campaign started");
  }
  for (const event of events) if (LIFECYCLE[event.kind]) add(event.created_at, LIFECYCLE[event.kind]);
  return [...found]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, labels]) => ({ day, label: [...labels].join(", ") }));
}
