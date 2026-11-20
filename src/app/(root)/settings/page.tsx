import SpiderMascot from '@/components/brand/SpiderMascot';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconUser,
  IconLanguage,
  IconMessageQuestion,
  IconPalette,
  IconArrowUpRight,
  IconBell,
  IconChartBar,
  IconClock,
  IconDownload,
  IconFileAnalytics,
  IconLock,
  IconPlug,
  IconTargetArrow,
} from '@tabler/icons-react';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import {
  getTierLimits,
  getUnreadUserNotificationIds,
  getUserNotifications,
  getUserSubscriptionTier,
} from '@/lib/server/actions/user/settings';
import {
  getNotificationPreference,
} from '@/lib/server/intelligence/repositories/notificationPreferences';
import {
  getReportSubscription,
} from '@/lib/server/intelligence/repositories/reportSubscriptions';
import {
  listArchivedReports,
  type ArchivedReport,
} from '@/lib/server/intelligence/repositories/reportArchive';
import { getAdAccountData, getBusinessAdAccountsRollup, getPlatformDetails } from '@/lib/server/data';
import { formatNotificationPreviewMessage } from '@/lib/shared';
import { createServerClient } from '@/lib/server/supabase/server';
import IntelligencePreferencesCard from './components/IntelligencePreferencesCard';
import CampaignDefaultsForm from './components/CampaignDefaultsForm';
import BusinessProfileForm from './components/BusinessProfileForm';
import AdFactsCard from './components/AdFactsCard';
import SectionCard from './components/SectionCard';
import ProfileForm from './components/ProfileForm';
import DeleteAccount from './components/DeleteAccount';
import AppearanceChoice from './components/AppearanceChoice';
import LanguageSettings from './components/LanguageSettings';
import { getTranslations } from 'next-intl/server';
import { isLocale } from '@/i18n/locales';
import { loadAdFacts } from '@/lib/server/agent/facts';
import { createAdminClient } from '@/lib/server/supabase/admin';
import classes from './SettingsSurface.module.css';
import Disclosure from '@/components/product/Disclosure';
import { ownerMessages } from '@/components/product/presentation';
import StatusBadge from '@/components/product/StatusBadge';

type BusinessProfileSettings = {
  business_name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  monthly_budget: string | null;
  booking_link: string | null;
  business_location: string | null;
  customer_radius: string | null;
  most_valuable_service: string | null;
  promoted_services: string[] | null;
  preferred_contact_method: string | null;
  ad_goals: string[] | null;
  preferred_platforms: string[] | null;
  updated_at: string;
};

type IntegrationJoin = {
  key: string;
  name: string;
} | null;

type IntegrationRow = {
  id: string;
  status: string;
  connected_at: string | null;
  disconnected_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  token_expires_at: string | null;
  updated_at: string;
  platforms: IntegrationJoin | IntegrationJoin[];
};

type IntegrationPreview = {
  id: string;
  name: string;
  key: string;
  status: string;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  tokenExpiresAt: string | null;
  updatedAt: string;
};

type NotificationPreview = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link: string | null;
  type: string | null;
};

type ReportArchiveGroup = {
  key: string;
  label: string;
  reports: ArchivedReport[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return 'Unscheduled';
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatReportWindow(report: ArchivedReport): string {
  if (!report.dateFrom && !report.dateTo) {
    return 'Window unavailable';
  }

  const start = formatDateOnly(report.dateFrom ?? report.dateTo);
  const end = formatDateOnly(report.dateTo ?? report.dateFrom);

  return start === end ? start : `${start} - ${end}`;
}

function formatCurrency(value: number | null, currencyCode: string | null): string {
  if (typeof value !== 'number') {
    return 'n/a';
  }

  if (currencyCode?.toUpperCase() === 'MIXED') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  }
}

function formatNumber(value: number | null): string {
  return typeof value === 'number' ? value.toLocaleString() : 'n/a';
}

function formatPercent(value: number | null): string {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'n/a';
}

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);
  const deltaMs = Date.now() - date.getTime();

  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return 'Recently updated';
  }

  const seconds = Math.max(1, Math.round(deltaMs / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 1) {
    return '1h ago';
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Not available';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPlanTier(value: string): string {
  switch (value) {
    case 'tier1':
      return 'Starter';
    case 'tier2':
      return 'Growth';
    case 'tier3':
      return 'Scale';
    case 'managed_service':
      return 'Managed Service';
    default:
      return 'Free';
  }
}

function firstPlatform(value: IntegrationJoin | IntegrationJoin[]): IntegrationJoin {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeNotification(value: unknown, index: number): NotificationPreview {
  const record = asRecord(value);

  return {
    id: asString(record.id) ?? `notification-${index}`,
    title: asString(record.title) ?? 'Notification',
    message: asString(record.message) ?? 'No additional message was provided.',
    createdAt: asString(record.created_at) ?? 'Recently',
    read: asBoolean(record.read),
    link: asString(record.link),
    type: asString(record.type),
  };
}

function groupArchivedReports(reports: ArchivedReport[]): ReportArchiveGroup[] {
  const groups = new Map<string, ReportArchiveGroup>();

  for (const report of reports) {
    const key = report.dateTo ?? report.generatedAt?.slice(0, 10) ?? 'unscheduled';
    const existing =
      groups.get(key) ??
      ({
        key,
        label: formatDateOnly(key),
        reports: [],
      } satisfies ReportArchiveGroup);

    existing.reports.push(report);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      reports: group.reports.sort(
        (left, right) =>
          left.title.localeCompare(right.title) ||
          left.levelLabel.localeCompare(right.levelLabel)
      ),
    }))
    .sort((left, right) => right.key.localeCompare(left.key));
}

function SummaryCard({
  icon,
  color,
  label,
  title,
  detail,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {label}
          </Text>
          <Text fw={700} mt={6}>
            {title}
          </Text>
        </div>
        <ThemeIcon variant="light" color={color} radius="md">
          {icon}
        </ThemeIcon>
      </Group>
      <Text size="sm" c="dimmed">
        {detail}
      </Text>
    </Card>
  );
}

export default async function SettingsPage() {
  const supabase = await createServerClient();
  const { user, businessId, organizationName, role, onboarding } =
    await getRequiredAppContext();
  const selection = await resolveCurrentSelection(businessId);

  const [
    businessProfileResult,
    integrationsResult,
    rollup,
    subscriptionTier,
    notificationsRaw,
    unreadNotificationIds,
    selectedPlatform,
    selectedAdAccount,
    notificationPreference,
    reportSubscription,
    archivedReports,
  ] = await Promise.all([
    supabase
      .from('business_profiles')
      .select(
        'business_name, industry, website, description, monthly_budget, booking_link, business_location, customer_radius, most_valuable_service, promoted_services, preferred_contact_method, ad_goals, preferred_platforms, updated_at'
      )
      .eq('id', businessId)
      .maybeSingle(),
    supabase
      .from('platform_integrations')
      .select(
        'id, status, connected_at, disconnected_at, last_synced_at, last_error, token_expires_at, updated_at, platforms ( key, name )'
      )
      .eq('business_id', businessId)
      .order('created_at', { ascending: true }),
    getBusinessAdAccountsRollup(businessId),
    getUserSubscriptionTier(user.id),
    getUserNotifications(user.id, 5),
    getUnreadUserNotificationIds(user.id),
    selection.selectedPlatformId
      ? getPlatformDetails(selection.selectedPlatformId, businessId)
      : Promise.resolve(null),
    selection.selectedPlatformId && selection.selectedAdAccountId
      ? getAdAccountData(
          selection.selectedAdAccountId,
          selection.selectedPlatformId,
          businessId
        )
      : Promise.resolve(null),
    getNotificationPreference(supabase, {
      businessId,
      userId: user.id,
    }),
    getReportSubscription(supabase, {
      businessId,
      userId: user.id,
    }),
    listArchivedReports(supabase, {
      businessId,
      limit: 60,
    }),
  ]);

  const limits = await getTierLimits(subscriptionTier);
  const t = await getTranslations();
  const { data: localeRow } = await supabase.from('users').select('preferred_locale').eq('id', user.id).maybeSingle();
  const savedLocale = localeRow?.preferred_locale ?? null;
  // Owner answers plus what the selected account's ad sets show. Failure is shown, not hidden.
  const adFacts = await loadAdFacts(createAdminClient(), {
    businessId,
    adAccountId: selection.selectedAdAccountId,
  }).catch((error) => {
    console.error('Settings ad facts unavailable', { code: (error as { code?: string })?.code ?? (error as Error)?.message });
    return null;
  });

  const businessProfile = (businessProfileResult.data ?? {
    business_name: organizationName,
    industry: null,
    website: null,
    description: null,
    monthly_budget: null,
    booking_link: null,
    business_location: null,
    customer_radius: null,
    most_valuable_service: null,
    promoted_services: [],
    preferred_contact_method: null,
    ad_goals: [],
    preferred_platforms: [],
    updated_at: new Date().toISOString(),
  }) as BusinessProfileSettings;

  const integrations = ((integrationsResult.data ?? []) as IntegrationRow[]).map((row) => {
    const platform = firstPlatform(row.platforms);

    return {
      id: row.id,
      name: platform?.name ?? 'Unknown platform',
      key: platform?.key ?? 'platform',
      status: row.status,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at,
      lastSyncedAt: row.last_synced_at,
      lastError: row.last_error,
      tokenExpiresAt: row.token_expires_at,
      updatedAt: row.updated_at,
    } satisfies IntegrationPreview;
  });

  const notifications = notificationsRaw.map(normalizeNotification);
  const unreadCount = unreadNotificationIds.length;
  const connectedIntegrationsCount = integrations.filter(
    (integration) => String(integration.status).toLowerCase() === 'connected'
  ).length;
  const integrationsNeedingAttention = integrations.filter(
    (integration) => String(integration.status).toLowerCase() !== 'connected'
  ).length;
  const unlimitedAccounts = limits.maxAdAccounts >= 999;
  const accountUsageText = unlimitedAccounts
    ? `${rollup.accountCount} connected`
    : `${rollup.accountCount} of ${limits.maxAdAccounts} connected`;
  const focusLabel =
    selectedPlatform && selectedAdAccount
      ? `${selectedPlatform.displayName} · ${selectedAdAccount.name ?? 'Selected ad account'}`
      : selectedPlatform
        ? `${selectedPlatform.displayName} selected`
        : 'No active account focus selected';
  const profileSetupCount = [
    businessProfile.industry,
    businessProfile.website,
    businessProfile.description,
    businessProfile.monthly_budget,
    businessProfile.ad_goals?.length ? 'goals' : null,
    businessProfile.preferred_platforms?.length ? 'platforms' : null,
  ].filter(Boolean).length;
  const archivedReportGroups = groupArchivedReports(archivedReports);

  const profileTotal = 6;
  const goals = businessProfile.ad_goals ?? [];
  const preferredPlatforms = businessProfile.preferred_platforms ?? [];
  const canEdit = role === 'owner' || role === 'admin';
  const nav: Array<[string, string]> = [
    ['profile', t('settingsPage.nav.profile')],
    ['workspace', t('settingsPage.nav.business')],
    ['language', t('settingsPage.nav.language')],
    ['ad-facts', t('settingsPage.nav.ads')],
    ['signals', t('settingsPage.nav.alerts')],
    ['appearance', t('settingsPage.nav.look')],
    ['connections', t('settingsPage.nav.connections')],
    ['access', t('settingsPage.nav.account')],
  ];

  return (
    <Container size="xl" className={`${classes.page} dv-app-page`}>
      <header className={classes.header}>
        <SpiderMascot state="idle" size={64} />
        <div className={classes.headerText}>
          <h1 className={classes.title}>{t('settingsPage.title')}</h1>
          <p className={classes.lead}>{t('settingsPage.lead')}</p>
        </div>
      </header>

      <div className={classes.layout}>
        <nav className={classes.nav} aria-label={t('settingsPage.navLabel')}>
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={classes.navLink}>{label}</a>
          ))}
        </nav>

        <div className={classes.stack}>
          <SectionCard
            id="profile"
            icon={<IconUser size={22} />}
            title={t('settingsPage.profile.title')}
            lead={t('settingsPage.profile.lead')}
            aside={<span className={`${classes.pill} ${user.status?.toLowerCase() === 'active' ? classes.pillOk : ''} ${classes.capital}`}>{user.status?.toLowerCase() === 'active' ? t('settingsPage.profile.statusActive') : formatStatusLabel(user.status)}</span>}
          >
            <ProfileForm initial={user} />
            <dl className={classes.facts} style={{ margin: '22px 0 0' }}>
              <div><dt>{t('settingsPage.profile.memberSince')}</dt><dd>{formatDateOnly(user.created_at)}</dd></div>
              <div><dt>{t('settingsPage.profile.updated')}</dt><dd>{formatDateOnly(user.updated_at)}</dd></div>
            </dl>
          </SectionCard>

          <SectionCard
            id="workspace"
            icon={<IconBuildingStore size={22} />}
            title={t('settingsPage.business.title')}
            lead={t('settingsPage.business.lead')}
          >
            <div className={classes.progress}>
              <div className={classes.progressNumber}>
                <strong>{t('settingsPage.business.filled', { count: profileSetupCount, total: profileTotal })}</strong>
                <span>{t('settingsPage.business.filledLabel')}</span>
              </div>
              <div className={classes.track} role="presentation">
                <div className={classes.fill} style={{ width: `${Math.round((profileSetupCount / profileTotal) * 100)}%` }} />
              </div>
              {!onboarding.onboarding_completed && (
                <p className={classes.progressNote}>
                  <strong>{t('settingsPage.business.setupTitle')}.</strong> {t('settingsPage.business.setupBody')}
                </p>
              )}
            </div>

            <BusinessProfileForm
              showHeading={false}
              canEdit={canEdit}
              initial={{ businessName: businessProfile.business_name, industry: businessProfile.industry ?? '', website: businessProfile.website ?? '', monthlyBudget: businessProfile.monthly_budget ?? '', description: businessProfile.description ?? '' }}
            />

            <p className={classes.groupLabel}>{t('settingsPage.business.goals')}</p>
            {goals.length > 0 ? (
              <div className={classes.chips}>
                {goals.map((goal) => <span key={goal} className={classes.chip}>{goal.replace(/_/g, ' ')}</span>)}
              </div>
            ) : <p className={classes.empty}>{t('settingsPage.business.noGoals')}</p>}

            <p className={classes.groupLabel}>{t('settingsPage.business.platforms')}</p>
            {preferredPlatforms.length > 0 ? (
              <div className={classes.chips}>
                {preferredPlatforms.map((platform) => <span key={platform} className={classes.chip}>{platform}</span>)}
              </div>
            ) : <p className={classes.empty}>{t('settingsPage.business.noPlatforms')}</p>}

            <CampaignDefaultsForm
              canEdit={canEdit}
              initial={{
                businessLocation: businessProfile.business_location ?? '',
                customerRadius: businessProfile.customer_radius ?? '',
                mainService: businessProfile.most_valuable_service ?? '',
                promotedServices: businessProfile.promoted_services ?? [],
                preferredContactMethod: businessProfile.preferred_contact_method ?? '',
                bookingLink: businessProfile.booking_link ?? '',
              }}
            />
          </SectionCard>

          <SectionCard id="language" icon={<IconLanguage size={22} />} title={t('language.title')} lead={t('settingsPage.language.lead')}>
            <LanguageSettings saved={isLocale(savedLocale) ? savedLocale : null} />
          </SectionCard>

          <SectionCard id="ad-facts" icon={<IconMessageQuestion size={22} />} title={t('facts.title')} lead={t('facts.intro')}>
            {adFacts ? (
              <AdFactsCard
                facts={adFacts.facts}
                accountCurrency={adFacts.accountCurrency}
                canEdit={canEdit}
              />
            ) : (
              <Alert color="gray" variant="light">{t('facts.unavailable')}</Alert>
            )}
          </SectionCard>

          <SectionCard
            id="signals"
            icon={<IconBell size={22} />}
            title={t('settingsPage.alerts.title')}
            lead={t('settingsPage.alerts.lead')}
            aside={unreadCount > 0 ? <span className={classes.chip}>{t('settingsPage.alerts.unread', { count: unreadCount })}</span> : null}
          >
            <IntelligencePreferencesCard
              initialNotificationPreference={notificationPreference}
              initialReportSubscription={reportSubscription}
            />

            <hr className={classes.divider} />
            <h3 className={classes.subTitle}>{t('settingsPage.alerts.recent')}</h3>
            {notifications.length > 0 ? (
              <ul className={classes.messages}>
                {notifications.map((notification) => (
                  <li key={notification.id} className={classes.message}>
                    <div className={classes.messageTop}>
                      <strong>
                        {notification.title}
                        {!notification.read && <span className={classes.new}>{t('settingsPage.alerts.new')}</span>}
                      </strong>
                      <time>{formatRelativeTime(notification.createdAt)}</time>
                    </div>
                    <p title={notification.message}>{formatNotificationPreviewMessage(notification.message)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={classes.message}>
                <strong>{t('settingsPage.alerts.none')}</strong>
                <p>{t('settingsPage.alerts.noneHint')}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard id="appearance" icon={<IconPalette size={22} />} title={t('settingsPage.look.title')} lead={t('settingsPage.look.lead')}>
            <AppearanceChoice />
          </SectionCard>

          <SectionCard
            id="connections"
            icon={<IconPlug size={22} />}
            title={t('settingsPage.connections.title')}
            lead={t('settingsPage.connections.lead')}
            aside={<Button component="a" href="/integration" variant="light" leftSection={<IconArrowUpRight size={18} />}>{t('settingsPage.connections.manage')}</Button>}
          >
            <dl className={classes.facts} style={{ marginBottom: 0 }}>
              <div><dt>Platforms</dt><dd>{connectedIntegrationsCount}/{Math.max(integrations.length, 1)} connected{integrationsNeedingAttention > 0 ? ` · ${integrationsNeedingAttention} need attention` : ''}</dd></div>
              <div><dt>Ad accounts</dt><dd>{rollup.activeAccountCount} active · {rollup.syncedAccountCount} synced</dd></div>
              <div><dt>Latest sync</dt><dd>{rollup.lastSyncedAt ? formatDateTime(rollup.lastSyncedAt) : 'Not synced yet'}</dd></div>
              <div><dt>Following</dt><dd>{focusLabel}</dd></div>
            </dl>
          </SectionCard>

          <div className={classes.more}>
        <Disclosure title={t('settingsPage.connections.diagnostics')} id="connection-details">
        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Connections
              </Text>
              <Title order={3}>Integrations and data health</Title>
              <Text size="sm" c="dimmed" mt={4}>
                This is where you confirm DeepVisor has the right platform access and enough
                synced account data to produce useful outputs.
              </Text>
            </div>
            <Button
              component="a"
              href="/integration"
              variant="light"
              radius="xl"
              leftSection={<IconArrowUpRight size={16} />}
            >
              Manage integrations
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
            <SummaryCard
              icon={<IconPlug size={18} />}
              color="signal"
              label="Platforms"
              title={`${connectedIntegrationsCount}/${Math.max(integrations.length, 1)} connected`}
              detail={
                integrations.length > 0
                  ? `${integrationsNeedingAttention} needing attention`
                  : 'No platforms connected yet'
              }
            />
            <SummaryCard
              icon={<IconChartBar size={18} />}
              color="signal"
              label="Ad Accounts"
              title={String(rollup.accountCount)}
              detail={`${rollup.activeAccountCount} active · ${rollup.syncedAccountCount} synced`}
            />
            <SummaryCard
              icon={<IconClock size={18} />}
              color="signal"
              label="Latest sync"
              title={formatRelativeTime(rollup.lastSyncedAt)}
              detail={rollup.lastSyncedAt ? formatDateTime(rollup.lastSyncedAt) : 'Setting up'}
            />
            <SummaryCard
              icon={<IconTargetArrow size={18} />}
              color="signal"
              label="Current focus"
              title={selectedAdAccount?.name ?? selectedPlatform?.displayName ?? 'Not set'}
              detail={focusLabel}
            />
          </SimpleGrid>

          <Stack gap="sm">
            {integrations.length > 0 ? (
              integrations.map((integration) => (
                <Paper key={integration.id} withBorder radius="md" p="md">
                  <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <Group gap="xs" mb={6} wrap="wrap">
                        <StatusBadge status={integration.status}/>
                        <Badge color="gray" variant="outline">
                          {integration.name}
                        </Badge>
                      </Group>
                      <Text fw={700}>{integration.key}</Text>
                      <Text size="sm" c="dimmed" mt={6}>
                        Connected {formatDateTime(integration.connectedAt)} · last synced{' '}
                        {formatDateTime(integration.lastSyncedAt)}
                      </Text>
                      {integration.lastError ? (
                        <Text size="sm" c="dimmed" mt={6}>
                          {ownerMessages.connection}
                        </Text>
                      ) : null}
                    </div>

                    <Stack gap={6} align="flex-end">
                      <Text size="xs" c="dimmed">
                        Token expiry {formatDateTime(integration.tokenExpiresAt)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Updated {formatRelativeTime(integration.updatedAt)}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ))
            ) : (
              <Paper withBorder radius="md" p="md">
                <Text fw={700}>No platform integrations yet</Text>
                <Text size="sm" c="dimmed" mt={6}>
                  Connect Meta to make account performance available in Overview.
                </Text>
              </Paper>
            )}
          </Stack>
        </Card>

        </Disclosure>
          </div>
          <div className={classes.more}>
        <Disclosure title={t('settingsPage.connections.reports')} id="report-archive">
        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Report archive
              </Text>
              <Title order={3}>Saved weekly reports</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Completed report queue runs are stored here by reporting date, report name, and
                reporting level.
              </Text>
            </div>
            <Badge color={archivedReports.length > 0 ? 'signal' : 'gray'} variant="light">
              {archivedReports.length} saved
            </Badge>
          </Group>

          <Stack gap="md">
            {archivedReportGroups.length > 0 ? (
              archivedReportGroups.map((group) => (
                <Paper key={group.key} withBorder radius="md" p="md">
                  <Group justify="space-between" align="center" mb="sm" wrap="wrap">
                    <Group gap="sm">
                      <ThemeIcon variant="light" color="signal" radius="md">
                        <IconFileAnalytics size={16} />
                      </ThemeIcon>
                      <div>
                        <Text fw={700}>{group.label}</Text>
                        <Text size="xs" c="dimmed">
                          {group.reports.length} report
                          {group.reports.length === 1 ? '' : 's'} completed
                        </Text>
                      </div>
                    </Group>
                  </Group>

                  <Stack gap="xs">
                    {group.reports.map((report) => (
                      <Paper key={report.id} withBorder radius="md" p="sm">
                        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" mb={6} wrap="wrap">
                              <Badge color="signal" variant="light">
                                {report.levelLabel}
                              </Badge>
                              {report.adAccountName ? (
                                <Badge color="gray" variant="outline">
                                  {report.adAccountName}
                                </Badge>
                              ) : null}
                              <Badge color="gray" variant="outline">
                                {formatReportWindow(report)}
                              </Badge>
                              {report.storagePath ? (
                                <Badge color="signal" variant="light">
                                  PDF stored
                                </Badge>
                              ) : null}
                            </Group>
                            <Text fw={700} size="sm" lineClamp={1}>
                              {report.title}
                            </Text>
                            <Group gap="md" mt={6} wrap="wrap">
                              <Text size="xs" c="dimmed">
                                Spend {formatCurrency(report.summary.spend, report.currencyCode)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                Results {formatNumber(report.summary.results)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                CTR {formatPercent(report.summary.ctr)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                Cost/result{' '}
                                {formatCurrency(
                                  report.summary.costPerResult,
                                  report.currencyCode
                                )}
                              </Text>
                            </Group>
                          </div>

                          <Group gap="xs" wrap="wrap">
                            <Button
                              component="a"
                              href={report.viewerHref}
                              radius="xl"
                              size="xs"
                              variant="light"
                            >
                              View
                            </Button>
                            {report.downloadHref ? (
                              <Button
                                component="a"
                                href={report.downloadHref}
                                radius="xl"
                                size="xs"
                                variant="default"
                                leftSection={<IconDownload size={14} />}
                              >
                                Download
                              </Button>
                            ) : null}
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              ))
            ) : (
              <Paper withBorder radius="md" p="md">
                <Group gap="sm" align="flex-start">
                  <ThemeIcon variant="light" color="gray" radius="md">
                    <IconFileAnalytics size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>No saved weekly reports yet</Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      When a scheduled report queue runs, DeepVisor will save the generated report
                      here for in-app access.
                    </Text>
                  </div>
                </Group>
              </Paper>
            )}
          </Stack>
        </Card>

        </Disclosure>
          </div>

          <SectionCard id="access" icon={<IconLock size={22} />} title={t('settingsPage.account.title')} lead={t('settingsPage.account.lead')}>
            <dl className={classes.facts}>
              <div><dt>{t('settingsPage.account.plan')}</dt><dd>{formatPlanTier(subscriptionTier)}</dd></div>
              <div><dt>{t('settingsPage.account.role')}</dt><dd>{formatStatusLabel(role)}</dd></div>
              <div><dt>{t('settingsPage.account.accounts')}</dt><dd>{accountUsageText}</dd></div>
            </dl>
            <div className={classes.shortcuts}>
              <div className={classes.shortcut}>
                <strong>{t('settingsPage.account.reportsTitle')}</strong>
                <p>{t('settingsPage.account.reportsBody')}</p>
                <Button component="a" href="/reports" variant="light">{t('settingsPage.account.openReports')}</Button>
              </div>
              <div className={classes.shortcut}>
                <strong>{t('settingsPage.account.connectionsTitle')}</strong>
                <p>{t('settingsPage.account.connectionsBody')}</p>
                <Button component="a" href="/integration" variant="light">{t('settingsPage.account.openConnections')}</Button>
              </div>
            </div>
            <hr className={classes.divider} />
            <p className={classes.note} style={{ marginBottom: 16 }}><IconLock size={18} aria-hidden />{t('settingsPage.profile.roleNote')}</p>
            <div className={classes.danger}>
              <h3 className={classes.subTitle} style={{ color: 'var(--dv-urgent-text)' }}>{t('settingsPage.profile.danger')}</h3>
              <DeleteAccount />
            </div>
          </SectionCard>

          <div className={classes.feedback}>
            <div>
              <strong>{t('settingsPage.feedback.title')}</strong>
              <span>{t('settingsPage.feedback.body')}</span>
            </div>
            <Button component="a" variant="default" href="mailto:info@deepvisor.com?subject=DeepVisor%20beta%20feedback">{t('settingsPage.feedback.send')}</Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
