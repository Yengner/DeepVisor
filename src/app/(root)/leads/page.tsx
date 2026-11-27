import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import DesignSurface from '@/components/design/DesignSurface';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import WhatsAppCard from '@/components/whatsapp/WhatsAppCard';
import { normalizeWhatsAppNumber } from '@/lib/shared/whatsapp/setup';
import { isLeadPeriod, loadLeadLog, type LeadPeriod } from '@/lib/server/leads/service';
import CallLeadForm from './CallLeadForm';
import LeadList from './LeadList';
import classes from './Leads.module.css';

export async function generateMetadata() {
  const t = await getTranslations('leads');
  return { title: t('metaTitle') };
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ businessId, role }, t, locale, params] = await Promise.all([getRequiredAppContext(), getTranslations('leads'), getLocale(), searchParams]);
  const selection = await resolveCurrentSelection(businessId);
  const db = createAdminClient();
  const { data: account } = selection.selectedAdAccountId
    ? await db.from('ad_accounts').select('id, timezone, currency_code').eq('id', selection.selectedAdAccountId).eq('business_id', businessId).maybeSingle()
    : { data: null };
  if (!account?.timezone) {
    return <DesignSurface label="DeepVisor · Leads"><div className={classes.page}><p>{t.rich('selectAccount', { link: chunks => <Link href="/integration">{chunks}</Link> })}</p></div></DesignSurface>;
  }

  const period: LeadPeriod = isLeadPeriod(params.period) ? (Number(params.period) as LeadPeriod) : 7;
  const log = await loadLeadLog(db, { businessId, adAccountId: account.id, timezone: account.timezone, period });
  const canEdit = role === 'owner' || role === 'admin';
  const { data: profile } = await db.from('business_profiles').select('whatsapp_number').eq('id', businessId).maybeSingle();
  const intlLocale = locale === 'es' ? 'es-US' : 'en-US';
  const currency = account.currency_code;
  const money = (v: number | null) => v === null ? null : currency ? new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).format(v) : v.toFixed(2);
  const day = (d: string) => new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const duration = (minutes: number) => minutes < 60 ? t('minutes', { minutes }) : t('hours', { hours: Math.round(minutes / 60) });
  const { summary } = log;
  const coverageNote = log.coveredFrom !== log.periodStart;
  const adName = (id: string, name: string | null) => name ?? t('unnamedAd', { id });

  return (
    <DesignSurface label="DeepVisor · Leads">
      <div className={classes.page}>
        <header className={classes.header}>
          <div>
            <h1>{t('title')}</h1>
            <p>{t('intro')}</p>
          </div>
          <nav className={classes.periods} aria-label={t('period')}>
            {([7, 30] as const).map(p => (
              <Link key={p} href={`/leads?period=${p}`} aria-current={p === period ? 'page' : undefined}>{p === 7 ? t('last7') : t('last30')}</Link>
            ))}
          </nav>
        </header>

        {log.connection ? (
          <p className={classes.connection}>
            <span className={classes.dot} aria-hidden />
            {t('connected', { phone: log.connection.displayPhone ?? '' })}
            {log.connection.isTest && <span className={classes.badge}>{t('testNumber')}</span>}
            {coverageNote && <span className={classes.muted}>{t('coveredFrom', { date: day(log.coveredFrom) })}</span>}
            {log.connection.syncFailed && <span className={classes.warning} role="alert">{t('connect.syncFailed')}</span>}
          </p>
        ) : canEdit ? null : (
          <section className={classes.card} aria-labelledby="leads-connect">
            <h2 id="leads-connect">{t('notConnectedTitle')}</h2>
            <p>{t('notConnectedBody')}</p>
          </section>
        )}

        {canEdit && (
          <WhatsAppCard number={normalizeWhatsAppNumber(profile?.whatsapp_number)} trackingOn={Boolean(log.connection)} />
        )}

        <dl className={classes.kpis}>
          <div><dt>{t('kpi.fromAds')}</dt><dd>{summary.fromAds}</dd><span>{t('kpi.fromAdsHelp', { organic: summary.organic })}</span></div>
          <div><dt>{t('kpi.booked')}</dt><dd>{summary.booked}</dd><span>{t('kpi.bookedHelp', { fromAds: summary.bookedFromAds })}</span></div>
          <div>
            <dt>{t('kpi.costPerBooked')}</dt>
            <dd>{money(summary.costPerBooked) ?? '—'}</dd>
            <span>{summary.costPerBooked === null ? t('kpi.costPerBookedEmpty') : t('kpi.costPerBookedHelp', { spend: money(summary.spend) ?? '' })}</span>
          </div>
          <div><dt>{t('kpi.unmarked')}</dt><dd>{summary.unmarked}</dd><span>{t('kpi.unmarkedHelp')}</span></div>
          <div><dt>{t('kpi.reply')}</dt><dd>{summary.medianReplyMinutes === null ? '—' : duration(summary.medianReplyMinutes)}</dd>{summary.medianReplyMinutes === null && <span>{t('kpi.replyEmpty')}</span>}</div>
        </dl>

        {log.connection && (summary.metaConversations > 0 || summary.receivedFromAds > 0) && (
          <p className={classes.check}>
            {t('metaCheck', { meta: summary.metaConversations, received: summary.receivedFromAds })} <span className={classes.muted}>{t('metaCheckNote')}</span>
          </p>
        )}

        {summary.ads.length > 0 && (
          <section className={classes.card} aria-labelledby="leads-ads">
            <h2 id="leads-ads">{t('adsTitle')}</h2>
            <div className={classes.tableWrap}>
              <table className={classes.table}>
                <thead><tr><th scope="col">{t('col.ad')}</th><th scope="col">{t('col.leads')}</th><th scope="col">{t('col.booked')}</th><th scope="col">{t('col.spend')}</th><th scope="col">{t('col.costPerBooked')}</th></tr></thead>
                <tbody>
                  {summary.ads.map(ad => (
                    <tr key={ad.externalId}>
                      <th scope="row">{adName(ad.externalId, ad.name)}</th>
                      <td>{ad.leads}</td><td>{ad.booked}</td><td>{money(ad.spend)}</td><td>{money(ad.costPerBooked) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={classes.card} aria-labelledby="leads-list">
          <h2 id="leads-list">{t('listTitle')}</h2>
          {!canEdit && <p className={classes.muted}>{t('viewOnly')}</p>}
          <LeadList leads={log.leads} timezone={account.timezone} canEdit={canEdit} />
        </section>

        {canEdit && <CallLeadForm ads={log.adChoices.map(a => ({ value: a.externalId, label: adName(a.externalId, a.name) }))} />}
      </div>
    </DesignSurface>
  );
}
