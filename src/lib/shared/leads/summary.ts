/**
 * Lead log arithmetic. Pure: callers pass leads and ad-level Meta numbers for the same window.
 *
 * - Unmarked leads are never counted as "didn't book"; spam is left out of lead counts.
 * - Costs use ad-level spend of the ads that brought leads or that Meta says started
 *   conversations, over the window the lead log actually covers (from the WhatsApp connection).
 * - "Meta counted" is Meta's messaging-conversations metric; it is shown next to what we
 *   received, not reconciled into it (Meta counts differently, e.g. Messenger and Instagram).
 */
export type LeadChannel = 'whatsapp' | 'call';
export type LeadSource = 'ad' | 'organic' | 'manual';
export type LeadOutcome = 'booked' | 'not_booked' | 'spam';

export interface LeadFact {
  channel: LeadChannel;
  source: LeadSource;
  adExternalId: string | null;
  outcome: LeadOutcome | null;
  firstMessageAt: string;
  firstReplyAt: string | null;
}
export interface AdNumbers {
  externalId: string;
  name: string | null;
  spend: number;
  /** Meta's messaging conversations started, summed over the covered days. */
  metaConversations: number;
}
export interface AdLeadRow {
  externalId: string;
  name: string | null;
  spend: number;
  metaConversations: number;
  leads: number;
  booked: number;
  costPerLead: number | null;
  costPerBooked: number | null;
}
export interface LeadSummary {
  leads: number;
  fromAds: number;
  organic: number;
  calls: number;
  booked: number;
  bookedFromAds: number;
  notBooked: number;
  spam: number;
  unmarked: number;
  /** WhatsApp leads from ads in the window, next to Meta's own count for the same ads and days. */
  receivedFromAds: number;
  metaConversations: number;
  spend: number;
  costPerLead: number | null;
  costPerBooked: number | null;
  /** Median minutes until the owner's first reply, WhatsApp leads only. */
  medianReplyMinutes: number | null;
  ads: AdLeadRow[];
}

const divide = (amount: number, count: number) => count > 0 ? Math.round((amount / count) * 100) / 100 : null;
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function replyMinutes(lead: Pick<LeadFact, 'firstMessageAt' | 'firstReplyAt'>): number | null {
  if (!lead.firstReplyAt) return null;
  const minutes = (Date.parse(lead.firstReplyAt) - Date.parse(lead.firstMessageAt)) / 60_000;
  return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : null;
}

export function summarizeLeads(leads: LeadFact[], ads: AdNumbers[]): LeadSummary {
  const real = leads.filter(l => l.outcome !== 'spam');
  const fromAds = real.filter(l => l.source === 'ad');
  const byAd = new Map<string, { leads: number; booked: number }>();
  for (const lead of fromAds) {
    const row = byAd.get(lead.adExternalId!) ?? { leads: 0, booked: 0 };
    row.leads++;
    if (lead.outcome === 'booked') row.booked++;
    byAd.set(lead.adExternalId!, row);
  }
  const numbers = new Map(ads.map(a => [a.externalId, a]));
  const ids = new Set([...byAd.keys(), ...ads.filter(a => a.metaConversations > 0).map(a => a.externalId)]);
  const rows: AdLeadRow[] = [...ids].map(id => {
    const n = numbers.get(id), counts = byAd.get(id) ?? { leads: 0, booked: 0 };
    const spend = n?.spend ?? 0;
    return {
      externalId: id, name: n?.name ?? null, spend, metaConversations: n?.metaConversations ?? 0,
      leads: counts.leads, booked: counts.booked, costPerLead: divide(spend, counts.leads), costPerBooked: divide(spend, counts.booked),
    };
  }).sort((a, b) => b.leads - a.leads || b.metaConversations - a.metaConversations || b.spend - a.spend);

  const spend = rows.reduce((sum, r) => sum + r.spend, 0);
  const bookedFromAds = fromAds.filter(l => l.outcome === 'booked').length;
  return {
    leads: real.length,
    fromAds: fromAds.length,
    organic: real.filter(l => l.source === 'organic').length,
    calls: real.filter(l => l.channel === 'call').length,
    booked: real.filter(l => l.outcome === 'booked').length,
    bookedFromAds,
    notBooked: real.filter(l => l.outcome === 'not_booked').length,
    spam: leads.length - real.length,
    unmarked: real.filter(l => l.outcome === null).length,
    receivedFromAds: fromAds.filter(l => l.channel === 'whatsapp').length,
    metaConversations: rows.reduce((sum, r) => sum + r.metaConversations, 0),
    spend: Math.round(spend * 100) / 100,
    costPerLead: divide(spend, fromAds.length),
    costPerBooked: divide(spend, bookedFromAds),
    medianReplyMinutes: median(real.filter(l => l.channel === 'whatsapp').map(replyMinutes).filter((m): m is number => m !== null)),
    ads: rows,
  };
}
