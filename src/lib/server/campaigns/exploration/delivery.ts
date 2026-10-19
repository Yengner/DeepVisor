type DeliveryEntity = {
  external_id: string;
  parent_external_id: string | null;
  entity_level: string;
  status: string | null;
  raw?: unknown;
};

/** Resolve the saved delivery chain, not configured status or historical spend. */
export function deliveryStatuses(entities: DeliveryEntity[], now: string = new Date().toISOString()) {
  const at = Date.parse(now);
  const byId = new Map(entities.map(entity => [`${entity.entity_level}:${entity.external_id}`, entity]));
  const chain = (entity: DeliveryEntity): string => {
    const status = entity.status?.trim().toUpperCase() || "UNKNOWN";
    const raw = entity.raw && typeof entity.raw === "object" ? entity.raw as Record<string, unknown> : {};
    const start = raw.start_time;
    if (status === "ACTIVE" && start != null && start !== "") {
      const startsAt = typeof start === "string" ? Date.parse(start) : NaN;
      if (!Number.isFinite(startsAt) || !Number.isFinite(at)) return "UNKNOWN";
      if (startsAt > at) return "SCHEDULED";
    }
    // Meta can retain ACTIVE after a campaign/ad-set schedule has ended.
    const end = raw.end_time ?? raw.stop_time;
    if (status === "ACTIVE" && end != null && end !== "") {
      const endsAt = typeof end === "string" ? Date.parse(end) : NaN;
      if (!Number.isFinite(endsAt) || !Number.isFinite(at)) return "UNKNOWN";
      if (endsAt <= at) return "COMPLETED";
    }
    if (status !== "ACTIVE" || entity.entity_level === "campaign") return status;
    const parentLevel = entity.entity_level === "ad" ? "adset" : "campaign";
    const parent = byId.get(`${parentLevel}:${entity.parent_external_id}`);
    if (!parent) return "UNKNOWN";
    const parentStatus = chain(parent);
    return parentStatus === "ACTIVE" ? "ACTIVE"
      : parentStatus === "COMPLETED" ? "COMPLETED"
      : parentStatus.includes("PAUSED") ? `${parentLevel.toUpperCase()}_PAUSED` : "INACTIVE";
  };
  const activeParents = new Set(entities.filter(entity => entity.entity_level === "ad" && chain(entity) === "ACTIVE")
    .map(entity => entity.parent_external_id));
  return new Map(entities.map(entity => [
    `${entity.entity_level}:${entity.external_id}`,
    entity.entity_level === "adset" && chain(entity) === "ACTIVE" && !activeParents.has(entity.external_id)
      ? "NO_ACTIVE_ADS" : chain(entity),
  ]));
}

/** Only entities on a complete active chain receive delivery emphasis. */
export function activeDeliveryKeys(entities: DeliveryEntity[], now?: string): string[] {
  const statuses = deliveryStatuses(entities, now);
  const byId = new Map(entities.map(entity => [`${entity.entity_level}:${entity.external_id}`, entity]));
  const keys = new Set<string>();
  for (const ad of entities) {
    if (ad.entity_level !== 'ad' || statuses.get(`ad:${ad.external_id}`) !== 'ACTIVE') continue;
    const adset = byId.get(`adset:${ad.parent_external_id}`);
    if (!adset) continue;
    keys.add(`ad:${ad.external_id}`);
    keys.add(`adset:${adset.external_id}`);
    keys.add(`campaign:${adset.parent_external_id}`);
  }
  return [...keys];
}
