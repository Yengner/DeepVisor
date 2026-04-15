import {
  Alert,
  Avatar,
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
import type { Database } from '@/lib/shared/types/supabase';

type BusinessProfilePreview = Pick<
  Database['public']['Tables']['business_profiles']['Row'],
  | 'business_name'
  | 'industry'
  | 'website'
  | 'description'
  | 'monthly_budget'
  | 'ad_goals'
  | 'preferred_platforms'
  | 'created_at'
  | 'updated_at'
>;

type IntegrationJoin = {
  key: string;
  name: string;
} | null;

type IntegrationRow = {
  id: string;
  status: string;
  platforms: IntegrationJoin | IntegrationJoin[];
};

type NotificationPreview = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: string | null;
  link: string | null;
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

function normalizeNotification(value: unknown, index: number): NotificationPreview {
  const record = asRecord(value);

  return {
    id: asString(record.id) ?? `notification-${index}`,
    title: asString(record.title) ?? 'Notification',
    message: asString(record.message) ?? 'No additional message was provided.',
    createdAt: asString(record.created_at) ?? 'Recently',
    read: asBoolean(record.read),
    type: asString(record.type),
    link: asString(record.link),
  };
}

function firstPlatform(value: IntegrationJoin | IntegrationJoin[]): IntegrationJoin {
  return Array.isArray(value) ? value[0] ?? null : value;
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
    return 'Not available';
  }

  const date = new Date(value);
  const deltaMs = Date.now() - date.getTime();

  if (!Number.isFinite(deltaMs)) {
    return value;
  }

  if (deltaMs < 0) {
    return 'Recently updated';
  }

  const minutes = Math.round(deltaMs / (60 * 1000));
  if (minutes < 60) {
    return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
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

function formatOrgType(value: string): string {
  if (value !== 'business') {
    return 'Partner';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinOrFallback(values: string[] | null | undefined, fallback: string): string {
  return values && values.length > 0 ? values.join(', ') : fallback;
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

export default async function ProfilePage() {
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
        'business_name, industry, website, description, monthly_budget, ad_goals, preferred_platforms, created_at, updated_at'
      )
      .eq('id', businessId)
      .maybeSingle(),
    supabase
      .from('platform_integrations')
      .select('id, status, platforms ( key, name )')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true }),
    getBusinessAdAccountsRollup(businessId),
    getUserSubscriptionTier(user.id),
    getUserNotifications(user.id, 4),
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
    created_at: user.created_at ?? new Date().toISOString(),
    updated_at: user.updated_at ?? new Date().toISOString(),
  }) as BusinessProfilePreview;

  const integrations = ((integrationsResult.data ?? []) as IntegrationRow[]).map((row) => {
    const platform = firstPlatform(row.platforms);

    return {
      id: row.id,
      name: platform?.name ?? 'Unknown platform',
      key: platform?.key ?? 'platform',
      status: row.status,
    };
  });

  const notifications = notificationsRaw.map(normalizeNotification);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const connectedPlatformCount = integrations.filter(
    (integration) => String(integration.status).toLowerCase() === 'connected'
  ).length;

  const fullName = `${user.first_name} ${user.last_name}`.trim() || 'Your profile';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const focusLabel =
    selectedPlatform && selectedAdAccount
      ? `${selectedPlatform.displayName} · ${selectedAdAccount.name ?? 'Selected ad account'}`
      : selectedPlatform
        ? `${selectedPlatform.displayName} selected`
        : 'No active platform focus selected';

  const profileFieldCount = [
    user.first_name,
    user.last_name,
    user.email,
    user.phone_number,
    businessProfile.industry,
    businessProfile.website,
    businessProfile.description,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).length;

  const profileReadinessLabel =
    profileFieldCount >= 6 ? 'Strong profile context' : profileFieldCount >= 4 ? 'Good profile context' : 'Basic profile context';

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
            <Group gap="lg" align="flex-start" wrap="nowrap">
              <Avatar
                radius="xl"
                size={84}
                color="blue"
                styles={{ placeholder: { fontSize: 28, fontWeight: 700 } }}
              >
                {initials}
              </Avatar>

              <Stack gap="sm" maw={680}>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" className="app-platform-page-badge">
                    Profile
                  </Badge>
                  <Badge color="cyan" variant="outline">
                    {organizationName}
                  </Badge>
                  <Badge color="green" variant="light">
                    {formatPlanTier(subscriptionTier)}
                  </Badge>
                </Group>

                <div>
                  <Title order={2} className="app-platform-page-title">
                    {fullName}
                  </Title>
                  <Text size="sm" mt={4} fw={600} className="app-platform-page-kicker">
                    {formatStatusLabel(role)} · {formatOrgType(organizationType)} workspace
                  </Text>
                  <Text size="md" maw={620} mt="sm" className="app-platform-page-copy">
                    Your profile is the personal view of how you show up inside DeepVisor: who you
                    are, what business context is attached to you, what account DeepVisor is
                    focused on, and where to go next.
                  </Text>
                </div>

                <Group gap="xs" wrap="wrap">
                  <Badge color="gray" variant="outline">
                    {profileReadinessLabel}
                  </Badge>
                  <Badge color="gray" variant="outline">
                    {connectedPlatformCount} connected platform
                    {connectedPlatformCount === 1 ? '' : 's'}
                  </Badge>
                  <Badge color="gray" variant="outline">
                    {rollup.accountCount} ad account{rollup.accountCount === 1 ? '' : 's'}
                  </Badge>
                </Group>
              </Stack>
            </Group>

            <Paper
              radius="lg"
              p="md"
              className="app-platform-page-hero-panel"
              style={{ minWidth: 320 }}
            >
              <Stack gap="sm">
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Workspace" value={businessProfile.business_name} />
                <InfoRow label="Current focus" value={focusLabel} />
                <InfoRow label="Member since" value={formatDateTime(user.created_at)} />
                <Group gap="sm" mt="xs" wrap="wrap">
                  <Button
                    component="a"
                    href="/settings"
                    radius="xl"
                    variant="filled"
                    className="app-platform-page-action-primary"
                    size="xs"
                  >
                    Open settings
                  </Button>
                  <Button
                    component="a"
                    href="/calendar"
                    radius="xl"
                    variant="default"
                    className="app-platform-page-action-secondary"
                    size="xs"
                  >
                    Open calendar
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <SummaryCard
            icon={<IconUser size={18} />}
            color="blue"
            label="Identity"
            title={`${profileFieldCount}/7 details on file`}
            detail={profileReadinessLabel}
          />
          <SummaryCard
            icon={<IconTargetArrow size={18} />}
            color="teal"
            label="Workspace"
            title={businessProfile.business_name}
            detail={focusLabel}
          />
          <SummaryCard
            icon={<IconBell size={18} />}
            color="grape"
            label="Signals"
            title={
              unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'No unread notifications'
            }
            detail="Your recent alerts and notable account signals."
          />
          <SummaryCard
            icon={<IconDatabase size={18} />}
            color="orange"
            label="Access"
            title={`${rollup.syncedAccountCount}/${Math.max(rollup.accountCount, 1)} synced accounts`}
            detail={`${limits.maxPlatforms.length} supported platform types on ${formatPlanTier(subscriptionTier)}`}
          />
        </SimpleGrid>

        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                About You
              </Text>
              <Title order={3}>Identity and account presence</Title>
              <Text size="sm" c="dimmed" mt={4}>
                The core information attached to your user account and how DeepVisor recognizes
                you inside this workspace.
              </Text>
            </div>
            <Badge color={user.status === 'active' ? 'green' : 'gray'} variant="light">
              {formatStatusLabel(user.status)}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="blue" radius="md">
                  <IconUser size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Personal details</Text>
                  <Text size="sm" c="dimmed">
                    Read-only account identity for now
                  </Text>
                </div>
              </Group>
              <Stack gap="sm">
                <InfoRow label="Full name" value={fullName} />
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Phone" value={user.phone_number || 'Not added'} />
                <InfoRow label="Role" value={formatStatusLabel(role)} />
                <InfoRow label="Account status" value={formatStatusLabel(user.status)} />
                <InfoRow label="Created" value={formatDateTime(user.created_at)} />
                <InfoRow label="Last updated" value={formatRelativeTime(user.updated_at)} />
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="teal" radius="md">
                  <IconLock size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Account posture</Text>
                  <Text size="sm" c="dimmed">
                    What is strong, what is missing, and where to manage it
                  </Text>
                </div>
              </Group>
              <Stack gap="sm">
                <InfoRow label="Profile readiness" value={profileReadinessLabel} />
                <InfoRow
                  label="Business onboarding"
                  value={onboarding.onboarding_completed ? 'Completed' : 'In progress'}
                />
                <InfoRow label="Subscription tier" value={formatPlanTier(subscriptionTier)} />
                <InfoRow
                  label="Connected platforms"
                  value={`${connectedPlatformCount}/${Math.max(integrations.length, 1)}`}
                />
                <InfoRow
                  label="Account capacity"
                  value={
                    limits.maxAdAccounts >= 999
                      ? `${rollup.accountCount} connected of unlimited`
                      : `${rollup.accountCount} of ${limits.maxAdAccounts} connected`
                  }
                />
              </Stack>
              <Group gap="sm" mt="md" wrap="wrap">
                <Button component="a" href="/settings" size="xs" radius="xl" variant="light">
                  Manage settings
                </Button>
                <Button
                  component="a"
                  href="/integration"
                  size="xs"
                  radius="xl"
                  variant="subtle"
                  color="gray"
                >
                  Review integrations
                </Button>
              </Group>
            </Paper>
          </SimpleGrid>
        </Card>

        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Workspace Context
              </Text>
              <Title order={3}>Business, goals, and operating focus</Title>
              <Text size="sm" c="dimmed" mt={4}>
                This is the business context attached to your profile and the lens DeepVisor is
                currently using while it evaluates performance and next actions.
              </Text>
            </div>
            <Button
              component="a"
              href="/reports"
              variant="light"
              radius="xl"
              leftSection={<IconArrowUpRight size={16} />}
            >
              Open reports
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="teal" radius="md">
                  <IconChartBar size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Business profile</Text>
                  <Text size="sm" c="dimmed">
                    The business details powering DeepVisor context
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
                  label="Profile updated"
                  value={formatRelativeTime(businessProfile.updated_at)}
                />
              </Stack>

              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md" mb="xs">
                Description
              </Text>
              <Paper withBorder radius="md" p="sm" bg="gray.0">
                <Text size="sm" c={businessProfile.description ? 'dark' : 'dimmed'}>
                  {businessProfile.description || 'No business description has been saved yet.'}
                </Text>
              </Paper>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="orange" radius="md">
                  <IconTargetArrow size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Current operating context</Text>
                  <Text size="sm" c="dimmed">
                    What DeepVisor is focused on right now
                  </Text>
                </div>
              </Group>
              <Stack gap="sm">
                <InfoRow label="Organization type" value={formatOrgType(organizationType)} />
                <InfoRow label="Current focus" value={focusLabel} />
                <InfoRow
                  label="Selected platform"
                  value={selectedPlatform?.displayName ?? 'Not selected'}
                />
                <InfoRow
                  label="Selected ad account"
                  value={selectedAdAccount?.name ?? 'Not selected'}
                />
                <InfoRow
                  label="Last workspace sync"
                  value={formatRelativeTime(rollup.lastSyncedAt)}
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
                    No business goals saved yet.
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

        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Workflow
              </Text>
              <Title order={3}>Where you go for each kind of work</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Your profile should orient you quickly without turning into another settings
                screen. These are the three product surfaces that matter day to day.
              </Text>
            </div>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="blue" radius="md">
                  <IconChartBar size={16} />
                </ThemeIcon>
                <Text fw={700}>Dashboard</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Use Dashboard for the fastest read on the selected ad account and what needs
                attention today.
              </Text>
              <Button
                component="a"
                href="/dashboard"
                size="xs"
                radius="xl"
                variant="light"
                color="blue"
                mt="md"
              >
                Open dashboard
              </Button>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="teal" radius="md">
                  <IconDatabase size={16} />
                </ThemeIcon>
                <Text fw={700}>Reports</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Use Reports when you want the explanation layer: what got stronger, what got weaker,
                and what changed over time.
              </Text>
              <Button
                component="a"
                href="/reports"
                size="xs"
                radius="xl"
                variant="light"
                color="teal"
                mt="md"
              >
                Open reports
              </Button>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="orange" radius="md">
                  <IconPlug size={16} />
                </ThemeIcon>
                <Text fw={700}>Calendar</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Use Calendar when DeepVisor has queued work ready for approval, scheduling, or
                revision.
              </Text>
              <Button
                component="a"
                href="/calendar"
                size="xs"
                radius="xl"
                variant="light"
                color="orange"
                mt="md"
              >
                Open calendar
              </Button>
            </Paper>
          </SimpleGrid>
        </Card>

        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Signals
              </Text>
              <Title order={3}>Recent notifications and account health</Title>
              <Text size="sm" c="dimmed" mt={4}>
                A profile page should still show the latest important changes without forcing you
                into a full settings audit.
              </Text>
            </div>
            <Badge color={unreadCount > 0 ? 'blue' : 'gray'} variant="light">
              {unreadCount} unread
            </Badge>
          </Group>

          {!onboarding.onboarding_completed ? (
            <Alert
              color="yellow"
              radius="md"
              icon={<IconAlertTriangle size={16} />}
              title="Business onboarding is still in progress"
              mb="md"
            >
              Complete onboarding to give DeepVisor a stronger operating profile and better
              performance context.
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="grape" radius="md">
                  <IconBell size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Latest notifications</Text>
                  <Text size="sm" c="dimmed">
                    The most recent alerts tied to your account
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
                      Your alerts will appear here as account syncs, notable performance changes,
                      or workflow updates happen.
                    </Text>
                  </Paper>
                )}
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="orange" radius="md">
                  <IconClock size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Account health snapshot</Text>
                  <Text size="sm" c="dimmed">
                    What your profile is connected to right now
                  </Text>
                </div>
              </Group>

              <Stack gap="sm">
                <InfoRow
                  label="Connected platforms"
                  value={`${connectedPlatformCount}/${Math.max(integrations.length, 1)}`}
                />
                <InfoRow label="Ad accounts" value={String(rollup.accountCount)} />
                <InfoRow label="Active accounts" value={String(rollup.activeAccountCount)} />
                <InfoRow label="Synced accounts" value={String(rollup.syncedAccountCount)} />
                <InfoRow label="Latest data sync" value={formatDateTime(rollup.lastSyncedAt)} />
                <InfoRow
                  label="Supported platforms"
                  value={joinOrFallback(
                    limits.maxPlatforms.map((platform) => formatStatusLabel(platform)),
                    'None'
                  )}
                />
              </Stack>

              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md" mb="xs">
                Connected platforms
              </Text>
              <Group gap="xs" wrap="wrap">
                {integrations.length > 0 ? (
                  integrations.map((integration) => (
                    <Badge key={integration.id} color="gray" variant="light">
                      {integration.name} · {formatStatusLabel(integration.status)}
                    </Badge>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">
                    No platform integrations connected yet.
                  </Text>
                )}
              </Group>
            </Paper>
          </SimpleGrid>
        </Card>
      </Stack>
    </Container>
  );
}
