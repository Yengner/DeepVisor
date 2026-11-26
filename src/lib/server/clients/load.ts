import 'server-only';
import { listUserBusinesses, type OrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { activeDeliveryKeys, deliveryStatuses } from '@/lib/server/campaigns/exploration/delivery';
import { openUrgentIssues } from '@/lib/server/insights/issues';
import { loadOverviewDaily, loadOverviewEntities } from '@/lib/server/dashboard/overview/load';
import { controlPerformance, type ControlPerformance } from '@/lib/server/dashboard/overview/controlModel';
import { accountNumber, adTimeline, attentionFor, compareByAttention, earliestEnd, showOnPortfolio, ENDING_SOON_DAYS, type AdTimeline, type Attention, type ServiceLevel } from '@/lib/shared/clients/model';
import { asRecord } from '@/lib/shared';
import { clientsDb, getOperator, type Operator } from './operator';

export type Engagement = {
  serviceLevel: ServiceLevel;
  monthlyFeeCents: number | null;
  currency: string;
  paidThrough: string | null;
  contentAddon: boolean;
  note: string | null;
};
export type LinkedAccount = { externalAccountId: string; name: string | null };
export type AdRun = AdTimeline & { id: string; name: string; campaign: string | null; ads: number };
export type BusinessAlert = { id: string; title: string; message: string; createdAt: string; link: string | null; read: boolean; daily?: { count: number; urgent: boolean } };

export type SyncedAccount = {
  accountId: string;
  externalAccountId: string;
  name: string | null;
  timezone: string;
  currency: string | null;
  lastSynced: string | null;
  today: string;
  runs: AdRun[];
  runningAds: number | null;
  performance: ControlPerformance | null;
  issues: string[];
  needsReconnect: boolean;
};

export type PortfolioBusiness = {
  businessId: string;
  name: string;
  location: string | null;
  isOwn: boolean;
  /** Fee and service records: only for client businesses of this operator. */
  engagement: Engagement | null;
  links: LinkedAccount[];
  synced: SyncedAccount | null;
  /** True when this business's saved account data could not be read. */
  failed: boolean;
  alerts: BusinessAlert[];
  unread: number;
  attention: Attention;
};

const localDay = (zone: string, now: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

type EntityRow = { id: string; external_id: string; parent_external_id: string | null; entity_level: string; name: string | null; status: string | null; raw: unknown };

function adRuns(rows: EntityRow[], now: string): AdRun[] {
  const statuses = deliveryStatuses(rows, now);
  const campaigns = new Map(rows.filter((row) => row.entity_level === 'campaign').map((row) => [row.external_id, row]));
  const ads = new Map<string, number>();
  for (const row of rows) if (row.entity_level === 'ad' && row.parent_external_id) ads.set(row.parent_external_id, (ads.get(row.parent_external_id) ?? 0) + 1);
  const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
  return rows.filter((row) => row.entity_level === 'adset').map((row) => {
    const campaign = row.parent_external_id ? campaigns.get(row.parent_external_id) : undefined;
    const raw = asRecord(row.raw), parent = asRecord(campaign?.raw);
    return {
      id: row.external_id,
      name: row.name ?? row.external_id,
      campaign: campaign?.name ?? null,
      ads: ads.get(row.external_id) ?? 0,
      ...adTimeline({
        delivery: statuses.get(`adset:${row.external_id}`) ?? null,
        start: text(raw.start_time),
        end: earliestEnd(text(raw.end_time), text(parent.stop_time)),
        now,
      }),
    };
  }).filter((run) => showOnPortfolio(run, now)).sort((a, b) => {
    // Running first, soonest end first; open-ended runs after dated ones.
    const rank = { running: 0, scheduled: 1, ended: 2, off: 3, unknown: 4 } as const;
    return rank[a.state] - rank[b.state] || (a.end ?? '9').localeCompare(b.end ?? '9');
  });
}

/** The business's connected primary Meta account and what DeepVisor has saved about it. */
async function loadSynced(businessId: string, now: string): Promise<SyncedAccount | null> {
  const db = createAdminClient();
  const integrations = await db.from('platform_integrations').select('platform_id,status,integration_details')
    .eq('business_id', businessId).in('status', ['connected', 'error', 'needs_reauth']).order('created_at', { ascending: true });
  if (integrations.error) throw integrations.error;
  const connection = integrations.data.find((row) => typeof asRecord(row.integration_details).primary_ad_account_external_id === 'string');
  if (!connection) return null;
  const external = asRecord(connection.integration_details).primary_ad_account_external_id as string;
  const account = await db.from('ad_accounts').select('id,name,timezone,currency_code,last_synced')
    .eq('business_id', businessId).eq('platform_id', connection.platform_id).eq('external_account_id', external).maybeSingle();
  if (account.error) throw account.error;
  if (!account.data) return null;
  const accountId = account.data.id;
  const zone = account.data.timezone || 'UTC';
  const today = localDay(zone, now);
  const [entities, issues, performance] = await Promise.all([
    readAllPages((from, to) => db.from('ad_entities').select('id,external_id,parent_external_id,entity_level,name,status,raw')
      .eq('business_id', businessId).eq('ad_account_id', accountId).order('id').range(from, to), { nullDataError: 'Hierarchy unavailable' }),
    openUrgentIssues(businessId, accountId),
    Promise.all([loadOverviewDaily(businessId, accountId, today), loadOverviewEntities(businessId, accountId)])
      .then(([rows, list]) => controlPerformance(rows, list, '7d', today, account.data!.currency_code))
      .catch(() => null),
  ]);
  const rows = entities as EntityRow[];
  return {
    accountId,
    externalAccountId: external,
    name: account.data.name,
    timezone: zone,
    currency: account.data.currency_code,
    lastSynced: account.data.last_synced,
    today,
    runs: adRuns(rows, now),
    runningAds: rows.some((row) => row.entity_level === 'ad')
      ? activeDeliveryKeys(rows, now).filter((key) => key.startsWith('ad:')).length : null,
    performance,
    issues: issues.map((issue) => issue.title),
    needsReconnect: connection.status !== 'connected',
  };
}

type EngagementRow = { business_id: string; service_level: ServiceLevel; monthly_fee_cents: number | null; currency: string; paid_through: string | null; content_addon: boolean; note: string | null };

/** Active client records of this operator, keyed by business. */
async function loadEngagements(operator: Operator): Promise<Map<string, Engagement>> {
  const { data, error } = await clientsDb().from('client_engagements')
    .select('business_id,service_level,monthly_fee_cents,currency,paid_through,content_addon,note')
    .eq('operator_organization_id', operator.organizationId).is('ended_at', null);
  if (error) throw new Error(error.message);
  return new Map((data as EngagementRow[]).map((row) => [row.business_id, {
    serviceLevel: row.service_level, monthlyFeeCents: row.monthly_fee_cents, currency: row.currency,
    paidThrough: row.paid_through, contentAddon: row.content_addon, note: row.note,
  }]));
}

async function loadLinks(businessIds: string[]): Promise<Array<LinkedAccount & { businessId: string }>> {
  if (!businessIds.length) return [];
  const { data, error } = await clientsDb().from('client_ad_accounts').select('external_account_id,business_id,name')
    .in('business_id', businessIds).order('linked_at');
  if (error) throw new Error(error.message);
  return (data as Array<{ external_account_id: string; business_id: string; name: string | null }>)
    .map((row) => ({ externalAccountId: row.external_account_id, businessId: row.business_id, name: row.name }));
}

async function loadAlerts(userId: string, businessIds: string[]) {
  const { data, error } = await createAdminClient().from('notifications')
    .select('id,business_id,title,message,created_at,link,read,source_type,payload_json')
    .eq('user_id', userId).in('business_id', businessIds).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}

function toAlert(row: Awaited<ReturnType<typeof loadAlerts>>[number]): BusinessAlert {
  const payload = asRecord(row.payload_json);
  const count = row.source_type === 'insights' && Array.isArray(payload.presentationIds) ? payload.presentationIds.length : 0;
  return {
    id: row.id, title: row.title, message: row.message, createdAt: row.created_at ?? '', link: row.link, read: Boolean(row.read),
    ...(count ? { daily: { count, urgent: payload.urgent === true } } : {}),
  };
}

export type Portfolio = {
  operator: Operator;
  businesses: PortfolioBusiness[];
  /** Accounts on the operator's connection that no business has yet. */
  unlinked: LinkedAccount[];
  now: string;
};

/**
 * Everything on "All businesses", from saved data only: no Meta request is made. Only businesses
 * the user is a member of are read. Null for anyone who isn't an operator.
 */
export async function loadPortfolio(userId: string): Promise<Portfolio | null> {
  const operator = await getOperator(userId);
  if (!operator) return null;
  const now = new Date().toISOString();
  const memberships: OrganizationBusinessContext[] = await listUserBusinesses(userId);
  const ids = memberships.map((business) => business.businessId);
  const [profiles, engagements, links, alerts, inventory] = await Promise.all([
    createAdminClient().from('business_profiles').select('id,business_name,business_location').in('id', ids),
    loadEngagements(operator),
    loadLinks(ids),
    loadAlerts(userId, ids),
    createAdminClient().from('ad_accounts').select('external_account_id,name').eq('business_id', operator.businessId).order('name'),
  ]);
  if (profiles.error) throw profiles.error;
  if (inventory.error) throw inventory.error;
  const profile = new Map(profiles.data.map((row) => [row.id, row]));
  // Only the operator's own business and its clients appear here.
  const shown = memberships.filter((business) => business.businessId === operator.businessId || engagements.has(business.businessId));

  const businesses = await Promise.all(shown.map(async (business): Promise<PortfolioBusiness> => {
    const mine = alerts.filter((row) => row.business_id === business.businessId);
    const own = links.filter((link) => link.businessId === business.businessId);
    let synced: SyncedAccount | null = null, failed = false;
    try {
      synced = await loadSynced(business.businessId, now);
    } catch (error) {
      console.error('Portfolio account data unavailable:', error);
      failed = true;
    }
    const endingSoon = synced?.runs.filter((run) => run.state === 'running' && run.daysLeft !== null && run.daysLeft <= ENDING_SOON_DAYS).length ?? 0;
    return {
      businessId: business.businessId,
      name: profile.get(business.businessId)?.business_name ?? business.organizationName,
      location: profile.get(business.businessId)?.business_location ?? null,
      isOwn: business.businessId === operator.businessId,
      engagement: engagements.get(business.businessId) ?? null,
      links: own,
      synced,
      failed,
      alerts: mine.slice(0, 3).map(toAlert),
      unread: mine.filter((row) => !row.read).length,
      // Unreadable data is treated like stale data, never as healthy.
      attention: failed ? 'stale' : attentionFor({
        synced: Boolean(synced), linkedAccounts: own.length, now,
        urgent: Boolean(synced && (synced.needsReconnect || synced.issues.length)),
        lastSynced: synced?.lastSynced ?? null, runningAds: synced?.runningAds ?? null, endingSoon,
      }),
    };
  }));

  const used = new Set(links.map((link) => link.externalAccountId));
  const ownPrimary = accountNumber(businesses.find((business) => business.isOwn)?.synced?.externalAccountId);
  const unlinked = inventory.data.flatMap((row) => {
    const number = accountNumber(row.external_account_id);
    return number && number !== ownPrimary && !used.has(number) ? [{ externalAccountId: number, name: row.name }] : [];
  });

  return { operator, businesses: businesses.sort(compareByAttention), unlinked, now };
}
