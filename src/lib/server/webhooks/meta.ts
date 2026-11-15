import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { requestAccountEvents } from '@/lib/server/sync/resources/coordinator';
import type { ResourceResult } from '@/lib/server/sync/resources/coordinator';
import { targetedSimulationAllowed } from '@/lib/server/sync/automaticRefresh';
import { affectedObjects } from '@/lib/shared/webhooks/meta';
import type { MetaWebhookEvent } from '@/lib/shared/webhooks/meta';
import type { Json } from '@/lib/shared/types/supabase';

/** Server-only gate. Off by default: the endpoint answers 404 and nothing is stored. */
export const webhooksEnabled = () => process.env.DEEPVISOR_META_WEBHOOKS === 'true';
export const MAX_WEBHOOK_BYTES = 256 * 1024;

const equal = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
/** `X-Hub-Signature-256: sha256=<hex>` — HMAC-SHA256 of the raw body with the Meta app secret. */
export function verifySignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!match) return false;
  return equal(match[1].toLowerCase(), createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'));
}
/** Subscription handshake: returns the challenge to echo, or null to refuse. */
export function verifyChallenge(params: URLSearchParams, token: string | undefined): string | null {
  const challenge = params.get('hub.challenge'), given = params.get('hub.verify_token');
  if (!token || token.length < 16 || params.get('hub.mode') !== 'subscribe' || !given || !challenge || challenge.length > 200) return null;
  return equal(given, token) ? challenge : null;
}

export type IngestResult = {
  received: number; recorded: number; duplicates: number;
  /** Jobs to start now, and accounts whose demand is waiting behind other work. */
  jobs: Array<{ jobId: string; businessId: string }>;
  waiting: Array<{ adAccountId: string; businessId: string }>;
  outcomes: Array<{ externalAccountId: string; reason: string }>;
};

/**
 * Record verified deliveries once, then ask the existing queue for an events read for every
 * business whose selected account matches. No Meta request is made here.
 */
export async function ingestMetaWebhook(events: MetaWebhookEvent[]): Promise<IngestResult> {
  const db = createAdminClient();
  const result: IngestResult = { received: events.length, recorded: 0, duplicates: 0, jobs: [], waiting: [], outcomes: [] };
  const fresh = new Map<string, Array<{ id: string; event: MetaWebhookEvent }>>();
  // Rows whose demand has not reached the queue yet. If anything fails they are removed, so Meta's
  // retry of the same delivery is processed again instead of being discarded as a duplicate.
  const unqueued = new Set<string>();
  try {
    for (const event of events) {
      const recorded = await db.rpc('record_meta_webhook_event', {
        p_key: createHash('sha256').update(event.identity).digest('hex'), p_account: event.externalAccountId, p_field: event.field,
        p_object: event.objectId ?? undefined, p_level: event.level ?? undefined, p_detail: event.detail as Json, p_sent: event.sentAt ?? undefined,
      });
      if (recorded.error) throw recorded.error;
      if (!recorded.data) { result.duplicates++; continue; }
      result.recorded++;
      if (event.refresh) unqueued.add(recorded.data);
      fresh.set(event.externalAccountId, [...(fresh.get(event.externalAccountId) ?? []), { id: recorded.data, event }]);
    }
    for (const [external, items] of fresh) {
      const refresh = items.filter(item => item.event.refresh);
      if (!refresh.length) { result.outcomes.push({ externalAccountId: external, reason: 'stored_only' }); continue; }
      // The same Meta account may be selected by more than one business; each keeps its own scope.
      const accounts = await db.from('ad_accounts').select('id,business_id,platform_id,external_account_id').in('external_account_id', [external, `act_${external}`]).limit(50);
      if (accounts.error) throw accounts.error;
      let matched = 0;
      for (const account of accounts.data) {
        const integration = await db.from('platform_integrations').select('id').eq('business_id', account.business_id).eq('platform_id', account.platform_id)
          .in('status', ['connected', 'error']).is('disconnected_at', null).eq('integration_details->>primary_ad_account_external_id', account.external_account_id).limit(1).maybeSingle();
        if (integration.error) throw integration.error;
        if (!integration.data) continue;
        matched++;
        const outcome: ResourceResult = await requestAccountEvents({ businessId: account.business_id, integrationId: integration.data.id, adAccountId: account.id, allowSimulation: targetedSimulationAllowed() }, affectedObjects(refresh.map(item => item.event)));
        result.outcomes.push({ externalAccountId: external, reason: outcome.reason });
        if (outcome.jobId && outcome.reason === 'enqueued') result.jobs.push({ jobId: outcome.jobId, businessId: account.business_id });
        else if (outcome.reason === 'pending_followup') result.waiting.push({ adAccountId: account.id, businessId: account.business_id });
      }
      if (!matched) result.outcomes.push({ externalAccountId: external, reason: 'no_selected_account' });
      else {
        const updated = await db.from('meta_webhook_events').update({ matched_accounts: matched }).in('id', items.map(item => item.id));
        if (updated.error) throw updated.error;
      }
      for (const item of refresh) unqueued.delete(item.id);
    }
    return result;
  } catch (error) {
    if (unqueued.size) await db.from('meta_webhook_events').delete().in('id', [...unqueued]).then(() => undefined, () => undefined);
    throw error;
  }
}
