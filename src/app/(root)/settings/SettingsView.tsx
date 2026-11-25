import type { ReactNode } from 'react';
import { Alert, Button } from '@mantine/core';
import { Bell, ChevronDown, Eye, Languages, MessageCircleQuestion, Plug, Store, TriangleAlert, UserRound } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import SpiderMascot from '@/components/brand/SpiderMascot';
import type { Locale } from '@/i18n/locales';
import type { NotificationPreference, ReportSubscriptionSetting } from '@/lib/server/intelligence/types';
import type { ArchivedReport } from '@/lib/server/intelligence/repositories/reportArchive';
import type { ResolvedFacts } from '@/lib/shared/agent/facts';
import AdFactsCard from './components/AdFactsCard';
import AlertSettings from './components/AlertSettings';
import AppearanceChoice from './components/AppearanceChoice';
import BusinessForm, { type BusinessValues } from './components/BusinessForm';
import DeleteAccount from './components/DeleteAccount';
import LanguageSettings from './components/LanguageSettings';
import ProfileForm from './components/ProfileForm';
import SectionCard from './components/SectionCard';
import classes from './SettingsSurface.module.css';

export type SettingsIntegration = {
  id: string;
  name: string;
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
  hasError: boolean;
};

/** Everything the page shows, already loaded and scoped to the signed-in person and business. */
export type SettingsData = {
  user: {
    first_name: string;
    last_name: string;
    phone_number: string | null;
    email: string;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  role: 'owner' | 'admin' | 'member';
  business: BusinessValues;
  businessLoadFailed: boolean;
  promotedServices: string[];
  savedLocale: Locale | null;
  adFacts: { facts: ResolvedFacts; accountCurrency: string | null } | null;
  /** Null while alert preferences are hidden because nothing honors them yet. */
  alertPreferences: { notification: NotificationPreference; report: ReportSubscriptionSetting } | null;
  unreadCount: number;
  integrations: SettingsIntegration[];
  lastSyncedAt: string | null;
  accountCount: number;
  selectedAdAccountName: string | null;
  archivedReports: ArchivedReport[];
};

type Formatters = ReturnType<typeof formatters>;

/** Dates, times and money in the person's language, never raw ISO strings. */
function formatters(locale: string) {
  const intl = locale === 'es' ? 'es-US' : 'en-US';
  const valid = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  return {
    day(value: string | null | undefined) {
      const date = valid(value);
      return date ? date.toLocaleDateString(intl, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    },
    /** "3 hours ago" / "hace 3 horas". */
    ago(value: string | null | undefined) {
      const date = valid(value);
      if (!date) return null;
      const seconds = Math.round((date.getTime() - Date.now()) / 1000);
      const rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
      const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86400], ['hour', 3600], ['minute', 60]];
      for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
      return rtf.format(0, 'minute');
    },
    money(value: number | null, currency: string | null) {
      if (value === null || !currency || currency.toUpperCase() === 'MIXED') return null;
      try { return new Intl.NumberFormat(intl, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
      catch { return null; }
    },
  };
}

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className={classes.facts}>
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

async function SavedReports({ reports, f }: { reports: ArchivedReport[]; f: Formatters }) {
  const t = await getTranslations('settingsPage');
  const range = (report: ArchivedReport) => {
    const start = f.day(report.dateFrom ?? report.dateTo);
    const end = f.day(report.dateTo ?? report.dateFrom);
    return start && end && start !== end ? `${start} – ${end}` : start ?? end;
  };
  return (
    <details className={classes.more}>
      <summary>{t('account.savedReports', { count: reports.length })}<ChevronDown size={18} aria-hidden="true" /></summary>
      <div className={classes.moreBody}>
        <ul className={classes.list}>
            {reports.map(report => {
              const spend = f.money(report.summary.spend, report.currencyCode);
              const meta = [
                range(report),
                report.adAccountName,
                spend && t('account.spent', { amount: spend }),
                report.summary.results !== null && t('account.results', { count: report.summary.results }),
              ].filter(Boolean).join(' · ');
              return (
                <li key={report.id} className={classes.listRow}>
                  <div className={classes.listText}>
                    <strong>{report.title}</strong>
                    {meta && <span>{meta}</span>}
                  </div>
                  <div className={classes.listActions}>
                    <Button component="a" href={report.viewerHref} variant="default" size="sm">{t('account.view')}</Button>
                    {report.downloadHref && <Button component="a" href={report.downloadHref} variant="subtle" size="sm">{t('account.download')}</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
      </div>
    </details>
  );
}

async function ConnectionDetails({ integrations, f }: { integrations: SettingsIntegration[]; f: Formatters }) {
  const t = await getTranslations('settingsPage');
  return (
    <details className={classes.more}>
      <summary>{t('account.details')}<ChevronDown size={18} aria-hidden="true" /></summary>
      <div className={classes.moreBody}>
        {integrations.length === 0 ? <p className={classes.hint}>{t('account.noConnections')}</p> : (
          <ul className={classes.list}>
            {integrations.map(item => {
              const connectedOn = f.day(item.connectedAt);
              const synced = f.ago(item.lastSyncedAt);
              const expires = f.day(item.tokenExpiresAt);
              const meta = [
                connectedOn && t('account.connectedOn', { date: connectedOn }),
                synced && t('account.lastSynced', { date: synced }),
                expires && t('account.expires', { date: expires }),
              ].filter(Boolean).join(' · ');
              return (
                <li key={item.id} className={classes.listRow}>
                  <div className={classes.listText}>
                    <strong>{item.name}</strong>
                    {meta && <span>{meta}</span>}
                    {item.hasError && <span className={classes.warnText}>{t('account.problem')}</span>}
                  </div>
                  <span className={`${classes.pill} ${item.connected ? classes.pillOk : classes.pillWarn}`}>
                    {item.connected ? t('account.statusConnected') : t('account.statusAttention')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

/**
 * Settings, with the profile inside it. Order follows what an owner reaches for: who I am, my
 * business, how it reads, what ads should know, alerts, then the account and, last, deleting.
 */
export default async function SettingsView({ data }: { data: SettingsData }) {
  const t = await getTranslations('settingsPage');
  const tAll = await getTranslations();
  const f = formatters(await getLocale());
  const canEdit = data.role === 'owner' || data.role === 'admin';
  const active = data.user.status?.toLowerCase() === 'active';

  // The one big number counts only what can be filled in on this card.
  const b = data.business;
  const checklist = [
    ['industry', b.industry], ['description', b.description], ['mainService', b.mainService],
    ['location', b.businessLocation], ['contact', b.preferredContactMethod], ['monthlyBudget', b.monthlyBudget],
    ['website', b.website], ['booking', b.bookingLink],
  ] as const;
  const missing = checklist.filter(([, value]) => !value.trim()).map(([key]) => t(`business.field.${key}`));
  const filled = checklist.length - missing.length;

  const connection = data.integrations.length === 0 ? 'none' : data.integrations.every(item => item.connected) ? 'ok' : 'attention';
  const syncedAgo = f.ago(data.lastSyncedAt);
  const accounts = t('account.accountsCount', { count: data.accountCount });

  const nav: Array<[string, string]> = [
    ['profile', t('nav.profile')],
    ['workspace', t('nav.business')],
    ['display', t('nav.display')],
    ['ad-facts', t('nav.ads')],
    ['alerts', t('nav.alerts')],
    ['account', t('nav.account')],
  ];

  return (
    <div className={`${classes.page} dv-app-page`}>
      <header className={classes.header}>
        <SpiderMascot state="idle" size={64} />
        <div className={classes.headerText}>
          <h1 className={classes.title}>{t('title')}</h1>
          <p className={classes.lead}>{t('lead')}</p>
          <p className={classes.reassure}><Eye size={16} aria-hidden="true" />{t('reassure')}</p>
        </div>
      </header>

      <div className={classes.layout}>
        <nav className={classes.nav} aria-label={t('navLabel')}>
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className={classes.navLink}>{label}</a>)}
        </nav>

        <div className={classes.stack}>
          <SectionCard
            id="profile"
            icon={<UserRound size={20} />}
            title={t('profile.title')}
            lead={t('profile.lead')}
            aside={<span className={`${classes.pill} ${active ? classes.pillOk : ''}`}>{active ? t('profile.statusActive') : t('profile.statusOther')}</span>}
          >
            <ProfileForm initial={data.user} />
            <Facts rows={[
              [t('profile.memberSince'), f.day(data.user.created_at) ?? t('account.notAvailable')],
              [t('profile.updated'), f.day(data.user.updated_at) ?? t('account.notAvailable')],
            ]} />
          </SectionCard>

          <SectionCard id="workspace" icon={<Store size={20} />} title={t('business.title')} lead={t('business.lead')}>
            <div className={classes.progress}>
              <p className={classes.progressNumber}>
                <strong>{t('business.filled', { count: filled, total: checklist.length })}</strong>
                <span>{t('business.filledLabel')}</span>
              </p>
              <div className={classes.track} aria-hidden="true">
                <div className={classes.fill} style={{ width: `${Math.round((filled / checklist.length) * 100)}%` }} />
              </div>
              <p className={classes.progressNote}>
                {missing.length === 0 ? t('business.allFilled') : t('business.missing', { fields: missing.join(', ') })}
              </p>
            </div>
            {data.businessLoadFailed && <Alert color="red" variant="light">{t('business.error')}</Alert>}
            <BusinessForm canEdit={canEdit} initial={b} promotedServices={data.promotedServices} />
          </SectionCard>

          <SectionCard id="display" icon={<Languages size={20} />} title={t('display.title')} lead={t('display.lead')}>
            <div className={classes.formStack}>
              <div className={classes.choice}>
                <span className={classes.choiceLabel}>{t('display.language')}</span>
                <LanguageSettings saved={data.savedLocale} />
              </div>
              <div className={classes.choice}>
                <span className={classes.choiceLabel} id="display-look">{t('display.look')}</span>
                <AppearanceChoice labelledBy="display-look" />
                <p className={classes.hint}>{t('display.lookHint')}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="ad-facts" icon={<MessageCircleQuestion size={20} />} title={t('ads.title')} lead={t('ads.lead')}>
            {data.adFacts
              ? <AdFactsCard facts={data.adFacts.facts} accountCurrency={data.adFacts.accountCurrency} canEdit={canEdit} />
              : <Alert color="gray" variant="light">{tAll('facts.unavailable')}</Alert>}
          </SectionCard>

          <SectionCard
            id="alerts"
            icon={<Bell size={20} />}
            title={t('alerts.title')}
            lead={data.alertPreferences ? t('alerts.lead') : t('alerts.leadSaved')}
          >
            {data.alertPreferences && <AlertSettings initialNotificationPreference={data.alertPreferences.notification} initialReportSubscription={data.alertPreferences.report} />}
            <div className={classes.inlineRow}>
              <span>{data.unreadCount > 0 ? t('alerts.unread', { count: data.unreadCount }) : t('alerts.noUnread')}</span>
              <Button component="a" href="/notifications" variant="subtle">{t('alerts.openMessages')}</Button>
            </div>
          </SectionCard>

          <SectionCard id="account" icon={<Plug size={20} />} title={t('account.title')} lead={t('account.lead')}>
            <div className={`${classes.status} ${connection === 'ok' ? classes.statusOk : classes.statusWarn}`}>
              <span className={classes.statusDot} aria-hidden="true" />
              <div className={classes.statusText}>
                <strong>{connection === 'ok' ? t('account.connected') : connection === 'attention' ? t('account.attention') : t('account.notConnected')}</strong>
                <span>
                  {connection === 'ok' ? (syncedAgo ? t('account.connectedHint', { when: syncedAgo }) : t('account.neverSynced'))
                    : connection === 'attention' ? t('account.attentionHint') : t('account.notConnectedHint')}
                </span>
              </div>
              {/* Healthy: a quiet link. Broken or missing: this becomes the card's main button. */}
              <Button component="a" href="/integration" variant={connection === 'ok' ? 'default' : 'filled'}>{t('account.manage')}</Button>
            </div>

            <Facts rows={[
              [t('account.role'), t(`account.roles.${data.role}`)],
              [t('account.accounts'), accounts],
              [t('account.following'), data.selectedAdAccountName ?? t('account.followingNone')],
            ]} />

            <div className={classes.actions} style={{ justifyContent: 'flex-start' }}>
              <Button component="a" href="/reports" variant="default">{t('account.reports')}</Button>
            </div>

            <div className={classes.moreGroup}>
              {/* Nothing creates new reports today, so the list only appears when older ones exist. */}
              {data.archivedReports.length > 0 && <SavedReports reports={data.archivedReports} f={f} />}
              <ConnectionDetails integrations={data.integrations} f={f} />
            </div>
          </SectionCard>

          <SectionCard id="delete-account" tone="danger" icon={<TriangleAlert size={20} />} title={t('danger.title')} lead={t('danger.lead')}>
            <DeleteAccount />
            <p className={classes.hint}>{t('danger.role')}</p>
          </SectionCard>

          <div className={classes.feedback}>
            <div>
              <strong>{t('feedback.title')}</strong>
              <span>{t('feedback.body')}</span>
            </div>
            <Button component="a" variant="default" href="mailto:info@deepvisor.com?subject=DeepVisor%20beta%20feedback">{t('feedback.send')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
