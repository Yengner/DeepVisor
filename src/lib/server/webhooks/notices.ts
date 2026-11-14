import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { asRecord } from '@/lib/shared/utils/format';
import type { FatigueNotice, MetaNotice } from '@/lib/shared/insights/model';

const DAY = 86_400_000;
/** Issue notices explain a current state for 30 days; a fatigue flag is kept for 14. */
export const ISSUE_NOTICE_DAYS = 30, FATIGUE_NOTICE_DAYS = 14;
export type AccountNotices = { issues: Map<string, MetaNotice>; fatigue: Map<string, FatigueNotice> };

/**
 * The latest verified webhook notice per object for this account. Deliveries are stored by Meta's
 * numeric account id, so the read is scoped through the business's own account row first.
 */
export async function readAccountNotices(business: string, account: string, now = Date.now()): Promise<AccountNotices> {
  const notices: AccountNotices = { issues: new Map(), fatigue: new Map() };
  if (process.env.DEEPVISOR_META_WEBHOOKS !== 'true') return notices;
  const db = createAdminClient();
  const owned = await db.from('ad_accounts').select('external_account_id').eq('id', account).eq('business_id', business).maybeSingle();
  if (owned.error) throw owned.error;
  const external = owned.data?.external_account_id?.replace(/^act_/, '');
  if (!external || !/^\d{1,20}$/.test(external)) return notices;
  const rows = await db.from('meta_webhook_events').select('field,object_id,detail,received_at').eq('external_account_id', external)
    .in('field', ['with_issues_ad_objects', 'creative_fatigue']).gte('received_at', new Date(now - ISSUE_NOTICE_DAYS * DAY).toISOString())
    .order('received_at', { ascending: false }).limit(500);
  if (rows.error) throw rows.error;
  for (const row of rows.data) {
    if (!row.object_id) continue;
    const detail = asRecord(row.detail), text = (key: string) => typeof detail[key] === 'string' ? detail[key] as string : null;
    if (row.field === 'with_issues_ad_objects') {
      if (!notices.issues.has(row.object_id)) notices.issues.set(row.object_id, { code: text('error_code'), summary: text('error_summary') ?? text('error_message') });
    } else if (Date.parse(row.received_at) >= now - FATIGUE_NOTICE_DAYS * DAY && !notices.fatigue.has(row.object_id)) {
      notices.fatigue.set(row.object_id, { level: text('creative_fatigue_level'), message: text('creative_fatigue_message') });
    }
  }
  return notices;
}
