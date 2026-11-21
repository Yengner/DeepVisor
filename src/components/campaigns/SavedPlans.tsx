import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@mantine/core';
import { CalendarDays, FilePen } from 'lucide-react';
import { createServerClient } from '@/lib/server/supabase/server';
import classes from './SavedPlans.module.css';

type PlanRow = { id: string; adset_external_id: string; adset_name: string | null; currency_code: string; daily_budget: number | string; days: number; start_day: string; end_day: string; updated_at: string };
type DraftRow = { id: string; title: string | null; updated_at: string };

/**
 * "Saved plans" at the top of Campaigns: run-again plans (one per ad set) and new-ad drafts,
 * kept in DeepVisor only. Read with the person's own session (RLS), so only their business's
 * rows appear. Hidden when there is nothing saved or it cannot be read.
 */
export default async function SavedPlans({ businessId, adAccountId }: { businessId: string; adAccountId: string }) {
  const supabase = await createServerClient();
  const [plans, drafts] = await Promise.all([
    supabase.from('ad_set_plans').select('id, adset_external_id, adset_name, currency_code, daily_budget, days, start_day, end_day, updated_at')
      .eq('business_id', businessId).eq('ad_account_id', adAccountId).order('updated_at', { ascending: false }).limit(20),
    supabase.from('campaign_drafts').select('id, title, updated_at')
      .eq('business_id', businessId).eq('ad_account_id', adAccountId).eq('status', 'draft').order('updated_at', { ascending: false }).limit(20),
  ]);
  if (plans.error) console.error('Saved plans unavailable', { code: plans.error.code });
  if (drafts.error) console.error('Saved drafts unavailable', { code: drafts.error.code });
  const planRows = (plans.data ?? []) as PlanRow[];
  const draftRows = (drafts.data ?? []) as DraftRow[];
  if (planRows.length === 0 && draftRows.length === 0) return null;

  const t = await getTranslations('savedPlans');
  const intl = (await getLocale()) === 'es' ? 'es-US' : 'en-US';
  const money = (value: number, currency: string) => new Intl.NumberFormat(intl, {
    style: 'currency', currency, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2,
  }).format(value);
  const day = (value: string) => new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const changed = (value: string) => new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric' }).format(new Date(value));

  return (
    <section id="saved-plans" className={classes.section} aria-labelledby="saved-plans-title">
      <header className={classes.head}>
        <h2 id="saved-plans-title">{t('title')}</h2>
        <p>{t('lead')}</p>
      </header>
      <ul className={classes.list}>
        {planRows.map(plan => (
          <li key={plan.id} className={classes.row}>
            <span className={classes.icon} aria-hidden="true"><CalendarDays size={20} /></span>
            <div className={classes.text}>
              <span className={classes.kind}>{t('rerun')}</span>
              <strong>{plan.adset_name ?? plan.adset_external_id}</strong>
              <span>
                {t('plan', { budget: money(Number(plan.daily_budget), plan.currency_code), days: plan.days })}
                {' · '}{t('runs', { start: day(plan.start_day), end: day(plan.end_day) })}
              </span>
              <span className={classes.muted}>{t('changed', { date: changed(plan.updated_at) })}</span>
            </div>
            <Button component={Link} href={`/campaigns/rerun?adSet=${encodeURIComponent(plan.adset_external_id)}`} variant="default">{t('edit')}</Button>
          </li>
        ))}
        {draftRows.map(draft => (
          <li key={draft.id} className={classes.row}>
            <span className={classes.icon} aria-hidden="true"><FilePen size={20} /></span>
            <div className={classes.text}>
              <span className={classes.kind}>{t('newAd')}</span>
              <strong>{draft.title ?? t('newAd')}</strong>
              <span className={classes.muted}>{t('changed', { date: changed(draft.updated_at) })}</span>
            </div>
            <Button component={Link} href={`/campaigns/create?draft=${encodeURIComponent(draft.id)}`} variant="default">{t('open')}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
