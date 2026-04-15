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
  IconAlertTriangle,
  IconArrowUpRight,
  IconBell,
  IconChartBar,
  IconClock,
  IconDatabase,
  IconLock,
  IconPlug,
  IconTargetArrow,
  IconUser,
} from '@tabler/icons-react';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import {
  getTierLimits,
  getUserNotifications,
  getUserSubscriptionTier,
} from '@/lib/server/actions/user/settings';
import { getAdAccountData, getBusinessAdAccountsRollup, getPlatformDetails } from '@/lib/server/data';
import { createServerClient } from '@/lib/server/supabase/server';

type BusinessProfileSettings = {
  business_name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  monthly_budget: string | null;
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

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);
  const deltaMs = Date.now() - date.getTime();

  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return 'Recently updated';
  }

  const hours = Math.round(deltaMs / (60 * 60 * 1000));
  if (hours < 1) {
    return 'Within the last hour';
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

function statusColor(status: string | null | undefined): string {
  switch (String(status ?? '').toLowerCase()) {
    case 'connected':
    case 'active':
      return 'green';
    case 'error':
      return 'red';
    case 'needs_reauth':
      return 'yellow';
    case 'disconnected':
      return 'gray';
    default:
      return 'gray';
  }
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

function formatOrgType(value: string): string {
  if (value !== 'business') {
    return 'Partner';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinOrFallback(values: string[] | null | undefined, fallback: string): string {
  return values && values.length > 0 ? values.join(', ') : fallback;
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} ta="right">
        {value}
      </Text>
    </Group>
  );
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
  const { user, businessId, organizationName, organizationType, role, onboarding } =
    await getRequiredAppContext();
  const selection = await resolveCurrentSelection(businessId);

  const [
    businessProfileResult,
    integrationsResult,
    rollup,
    subscriptionTier,
    notificationsRaw,
    selectedPlatform,
    selectedAdAccount,
  ] = await Promise.all([
    supabase
      .from('business_profiles')
      .select(
        'business_name, industry, website, description, monthly_budget, ad_goals, preferred_platforms, updated_at'
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
  ]);

  const limits = await getTierLimits(subscriptionTier);

  const businessProfile = (businessProfileResult.data ?? {
    business_name: organizationName,
    industry: null,
    website: null,
    description: null,
    monthly_budget: null,
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
  const unreadCount = notifications.filter((notification) => !notification.read).length;
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

  return (
    <Container size="xl" pb="xl">
      <Stack gap="lg">
        <Card
          withBorder
          radius="lg"
          p="xl"
          className="app-platform-page-hero"
        >
          <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
            <Stack gap="sm" maw={720}>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" className="app-platform-page-badge">
                  Settings
                </Badge>
                <Badge color="cyan" variant="outline">
                  {organizationName}
                </Badge>
                <Badge color="green" variant="light">
                  {formatPlanTier(subscriptionTier)}
                </Badge>
              </Group>

              <div>
                <Text size="sm" fw={600} className="app-platform-page-kicker">
                  {formatOrgType(organizationType)} workspace
                </Text>
                <Title order={2} mt={4} className="app-platform-page-title">
                  Workspace controls and account context
                </Title>
                <Text size="md" maw={620} mt="xs" className="app-platform-page-copy">
                  Keep settings practical: who you are, what workspace DeepVisor is operating in,
                  what is connected, how data is flowing, and what limits apply.
                </Text>
              </div>

              <Group gap="xs" wrap="wrap">
                <Badge color="gray" variant="outline">
                  Role {formatStatusLabel(role)}
                </Badge>
                <Badge color="gray" variant="outline">
                  {accountUsageText}
                </Badge>
                <Badge color="gray" variant="outline">
                  {connectedIntegrationsCount} connected platform
                  {connectedIntegrationsCount === 1 ? '' : 's'}
                </Badge>
              </Group>
            </Stack>

            <Paper
              radius="lg"
              p="md"
              className="app-platform-page-hero-panel"
              style={{ minWidth: 320 }}
            >
              <Stack gap="sm">
                <InfoRow label="Current focus" value={focusLabel} />
                <InfoRow label="Last data sync" value={formatDateTime(rollup.lastSyncedAt)} />
                <InfoRow
                  label="Profile updated"
                  value={formatRelativeTime(businessProfile.updated_at)}
                />
                <Group gap="sm" mt="xs" wrap="wrap">
                  <Button
                    component="a"
                    href="/integration"
                    radius="xl"
                    variant="filled"
                    className="app-platform-page-action-primary"
                    size="xs"
                  >
                    Manage integrations
                  </Button>
                  <Button
                    component="a"
                    href="/reports"
                    radius="xl"
                    variant="default"
                    className="app-platform-page-action-secondary"
                    size="xs"
                  >
                    Open reports
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Group>
        </Card>

        <Group gap="xs" wrap="wrap">
          <Button component="a" href="#workspace" variant="subtle" size="xs">
            Workspace
          </Button>
          <Button component="a" href="#signals" variant="subtle" size="xs">
            Signals
          </Button>
          <Button component="a" href="#connections" variant="subtle" size="xs">
            Connections
          </Button>
          <Button component="a" href="#access" variant="subtle" size="xs">
            Access
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <SummaryCard
            icon={<IconUser size={18} />}
            color="blue"
            label="Account"
            title={`${user.first_name} ${user.last_name}`.trim()}
            detail={`${user.email}${user.phone_number ? ` · ${user.phone_number}` : ''}`}
          />
          <SummaryCard
            icon={<IconTargetArrow size={18} />}
            color="teal"
            label="Workspace"
            title={businessProfile.business_name}
            detail={`${profileSetupCount}/6 profile inputs filled${businessProfile.industry ? ` · ${businessProfile.industry}` : ''}`}
          />
          <SummaryCard
            icon={<IconLock size={18} />}
            color="grape"
            label="Plan"
            title={formatPlanTier(subscriptionTier)}
            detail={`${accountUsageText} · ${limits.maxPlatforms.length} supported platform types on this tier`}
          />
          <SummaryCard
            icon={<IconDatabase size={18} />}
            color="orange"
            label="Data"
            title={`${rollup.syncedAccountCount}/${Math.max(rollup.accountCount, 1)} synced accounts`}
            detail={
              rollup.accountCount > 0
                ? `Last workspace sync ${formatRelativeTime(rollup.lastSyncedAt)}`
                : 'No ad accounts connected yet'
            }
          />
        </SimpleGrid>

        <Card withBorder radius="lg" p="xl" id="workspace">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Workspace
              </Text>
              <Title order={3}>Identity and business profile</Title>
              <Text size="sm" c="dimmed" mt={4}>
                The practical settings DeepVisor uses to understand who is operating the
                workspace and what the business is trying to achieve.
              </Text>
            </div>
            <Badge color={onboarding.onboarding_completed ? 'green' : 'yellow'} variant="light">
              {onboarding.onboarding_completed ? 'Onboarding complete' : 'Onboarding in progress'}
            </Badge>
          </Group>

          {!onboarding.onboarding_completed ? (
            <Alert
              color="yellow"
              radius="md"
              icon={<IconAlertTriangle size={16} />}
              title="Business setup is still in progress"
              mb="md"
            >
              <Text size="sm">
                DeepVisor will keep getting better once the rest of onboarding is completed and the
                business profile fields are filled in more fully.
              </Text>
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="blue" radius="md">
                  <IconUser size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>You</Text>
                  <Text size="sm" c="dimmed">
                    Identity and access in this workspace
                  </Text>
                </div>
              </Group>
              <Stack gap="sm">
                <InfoRow
                  label="Name"
                  value={`${user.first_name} ${user.last_name}`.trim() || 'Not set'}
                />
                <InfoRow label="Email" value={user.email} />
                <InfoRow
                  label="Phone"
                  value={user.phone_number || 'Not added'}
                />
                <InfoRow label="Role" value={formatStatusLabel(role)} />
                <InfoRow label="Account status" value={formatStatusLabel(user.status)} />
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="teal" radius="md">
                  <IconChartBar size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Business profile</Text>
                  <Text size="sm" c="dimmed">
                    What DeepVisor knows about the business
                  </Text>
                </div>
              </Group>
              <Stack gap="sm">
                <InfoRow label="Business" value={businessProfile.business_name} />
                <InfoRow label="Industry" value={businessProfile.industry || 'Not set'} />
                <InfoRow label="Website" value={businessProfile.website || 'Not set'} />
                <InfoRow
                  label="Monthly budget"
                  value={businessProfile.monthly_budget || 'Not set'}
                />
                <InfoRow
                  label="Description"
                  value={businessProfile.description || 'Not set'}
                />
              </Stack>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md" mb="xs">
                Goals
              </Text>
              <Group gap="xs" wrap="wrap">
                {(businessProfile.ad_goals ?? []).length > 0 ? (
                  businessProfile.ad_goals?.map((goal) => (
                    <Badge key={goal} color="blue" variant="light">
                      {goal.replace(/_/g, ' ')}
                    </Badge>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">
                    No goals saved yet.
                  </Text>
                )}
              </Group>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md" mb="xs">
                Preferred platforms
              </Text>
              <Group gap="xs" wrap="wrap">
                {(businessProfile.preferred_platforms ?? []).length > 0 ? (
                  businessProfile.preferred_platforms?.map((platform) => (
                    <Badge key={platform} color="cyan" variant="light">
                      {platform}
                    </Badge>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">
                    No preferred platforms saved yet.
                  </Text>
                )}
              </Group>
            </Paper>
          </SimpleGrid>
        </Card>

        <Card withBorder radius="lg" p="xl" id="signals">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Signals
              </Text>
              <Title order={3}>Notifications and operating context</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Settings should clarify how DeepVisor is communicating with you, not bury you in
                toggles that do not matter yet.
              </Text>
            </div>
            <Badge color={unreadCount > 0 ? 'blue' : 'gray'} variant="light">
              {unreadCount} unread
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="blue" radius="md">
                  <IconBell size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Recent notifications</Text>
                  <Text size="sm" c="dimmed">
                    The latest system messages and guardrail signals
                  </Text>
                </div>
              </Group>

              <Stack gap="sm">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <Paper key={notification.id} withBorder radius="md" p="sm">
                      <Group justify="space-between" align="flex-start" gap="md">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Group gap="xs" mb={4} wrap="wrap">
                            {!notification.read ? (
                              <Badge color="blue" variant="light">
                                Unread
                              </Badge>
                            ) : null}
                            {notification.type ? (
                              <Badge color="gray" variant="outline">
                                {notification.type}
                              </Badge>
                            ) : null}
                          </Group>
                          <Text fw={700} size="sm">
                            {notification.title}
                          </Text>
                          <Text size="sm" c="dimmed" mt={4}>
                            {notification.message}
                          </Text>
                        </div>
                        <Text size="xs" c="dimmed">
                          {formatRelativeTime(notification.createdAt)}
                        </Text>
                      </Group>
                    </Paper>
                  ))
                ) : (
                  <Paper withBorder radius="md" p="sm">
                    <Text fw={700} size="sm">
                      No recent notifications
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      DeepVisor will surface sync issues, notable shifts, and important account
                      signals here as they occur.
                    </Text>
                  </Paper>
                )}
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="teal" radius="md">
                  <IconTargetArrow size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>How this workspace operates</Text>
                  <Text size="sm" c="dimmed">
                    The role of each major page in the product
                  </Text>
                </div>
              </Group>

              <Stack gap="sm">
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">
                    Dashboard
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Use Dashboard for the daily operating read on the selected account.
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">
                    Reports
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Use Reports when you want the explanation layer: what got stronger, what got
                    weaker, and what changed over time.
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">
                    Calendar
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Use Calendar when you want to approve or manage the queued work DeepVisor wants
                    to execute next.
                  </Text>
                </Paper>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Card>

        <Card withBorder radius="lg" p="xl" id="connections">
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
              color="blue"
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
              color="teal"
              label="Ad Accounts"
              title={String(rollup.accountCount)}
              detail={`${rollup.activeAccountCount} active · ${rollup.syncedAccountCount} synced`}
            />
            <SummaryCard
              icon={<IconClock size={18} />}
              color="grape"
              label="Latest sync"
              title={formatRelativeTime(rollup.lastSyncedAt)}
              detail={rollup.lastSyncedAt ? formatDateTime(rollup.lastSyncedAt) : 'Waiting for first sync'}
            />
            <SummaryCard
              icon={<IconTargetArrow size={18} />}
              color="orange"
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
                        <Badge color={statusColor(integration.status)} variant="light">
                          {formatStatusLabel(integration.status)}
                        </Badge>
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
                          Last error: {integration.lastError}
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
                  Connect Meta first so Dashboard, Reports, and Calendar have a real account to work
                  from.
                </Text>
              </Paper>
            )}
          </Stack>
        </Card>

        <Card withBorder radius="lg" p="xl" id="access">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Access
              </Text>
              <Title order={3}>Plan, permissions, and data actions</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Keep this page honest about what is available now: your workspace role, current
                plan boundaries, and the safest actions for data review.
              </Text>
            </div>
            <Badge color="green" variant="light">
              {formatPlanTier(subscriptionTier)}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="grape" radius="md">
                  <IconLock size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Plan and permissions</Text>
                  <Text size="sm" c="dimmed">
                    Limits that define how this workspace can operate
                  </Text>
                </div>
              </Group>

              <Stack gap="sm">
                <InfoRow label="Plan tier" value={formatPlanTier(subscriptionTier)} />
                <InfoRow label="Workspace role" value={formatStatusLabel(role)} />
                <InfoRow label="Organization type" value={formatOrgType(organizationType)} />
                <InfoRow
                  label="Max ad accounts"
                  value={unlimitedAccounts ? 'Unlimited' : String(limits.maxAdAccounts)}
                />
                <InfoRow
                  label="Multiple accounts"
                  value={limits.allowMultipleAccounts ? 'Allowed' : 'Single account only'}
                />
                <InfoRow
                  label="Supported platforms"
                  value={joinOrFallback(
                    limits.maxPlatforms.map((platform) => formatStatusLabel(platform)),
                    'None'
                  )}
                />
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="orange" radius="md">
                  <IconDatabase size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Data and privacy</Text>
                  <Text size="sm" c="dimmed">
                    The realistic actions available from the current product surface
                  </Text>
                </div>
              </Group>

              <Stack gap="sm">
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">
                    Report exports
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Use Reports to export the current account or workspace view as CSV or PDF.
                  </Text>
                  <Button
                    component="a"
                    href="/reports"
                    size="xs"
                    radius="xl"
                    variant="light"
                    color="blue"
                    mt="md"
                  >
                    Open reports
                  </Button>
                </Paper>

                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">
                    Integration review
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Verify permissions, reconnect platforms, or confirm which account DeepVisor
                    should follow.
                  </Text>
                  <Button
                    component="a"
                    href="/integration"
                    size="xs"
                    radius="xl"
                    variant="light"
                    color="gray"
                    mt="md"
                  >
                    Open integrations
                  </Button>
                </Paper>

                <Alert
                  icon={<IconAlertTriangle size={16} />}
                  title="Danger zone"
                  color="red"
                  variant="light"
                  radius="md"
                >
                  Workspace deletion is not self-serve yet. Disconnect integrations first and use
                  support-led deletion if that workflow is needed later.
                </Alert>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Card>
      </Stack>
    </Container>
  );
}
