'use client';

import '@mantine/charts/styles.css';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LineChart } from '@mantine/charts';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconChartLine,
  IconClock,
  IconCurrencyDollar,
  IconLink,
  IconMessageCircle,
  IconRefresh,
  IconUsers,
} from '@tabler/icons-react';
import { formatRetryDelay } from '@/lib/shared';
import type {
  DashboardPayload,
  DashboardState,
  DashboardSummaryCard,
  DashboardWindow,
} from '../types';

type DashboardClientProps = {
  payload: DashboardPayload;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number, currencyCode: string | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not synced yet';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Not connected';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'connected':
    case 'active':
      return 'green';
    case 'error':
      return 'red';
    case 'needs_reauth':
      return 'yellow';
    default:
      return 'gray';
  }
}

function stateContent(state: DashboardState): {
  color: 'blue' | 'orange' | 'yellow' | 'teal';
  title: string;
  description: string;
} {
  switch (state) {
    case 'no_platform_selected':
      return {
        color: 'blue',
        title: 'Connect a platform to start this dashboard',
        description:
          'DeepVisor keeps this page focused on one selected ad account. Connect your platform first, then choose an ad account from the top bar.',
      };
    case 'platform_not_found_or_not_connected':
      return {
        color: 'orange',
        title: 'This platform connection needs attention',
        description:
          'The saved platform is disconnected or unavailable. Reconnect it from integrations to restore fresh account data.',
      };
    case 'no_ad_account_selected':
      return {
        color: 'yellow',
        title: 'Choose an ad account to load this view',
        description:
          'Use the top bar to pick the ad account you want to review. This dashboard stays scoped to that one account.',
      };
    case 'ad_account_selected_no_metrics':
      return {
        color: 'teal',
        title: 'This account is selected, but recent numbers are still coming in',
        description:
          'Refresh after the next sync to populate weekly and monthly performance blocks for this account.',
      };
    default:
      return {
        color: 'teal',
        title: 'Dashboard ready',
        description: 'Your selected ad account is loaded and ready to review.',
      };
  }
}

function comparisonText(card: DashboardSummaryCard, window: DashboardWindow): {
  label: string;
  color: string;
} {
  const comparisonWindow = window === '7d' ? 'previous 7 days' : 'previous 30 days';

  if (card.previousValue === null || card.changePercent === null) {
    return {
      label: `No comparison yet against the ${comparisonWindow}`,
      color: 'var(--mantine-color-gray-6)',
    };
  }

  if (Math.abs(card.changePercent) < 0.5) {
    return {
      label: `Holding steady vs the ${comparisonWindow}`,
      color: 'var(--mantine-color-gray-7)',
    };
  }

  if (card.changePercent > 0) {
    return {
      label: `Up ${formatPercent(card.changePercent)} vs the ${comparisonWindow}`,
      color: 'var(--mantine-color-green-7)',
    };
  }

  return {
    label: `Down ${formatPercent(card.changePercent)} vs the ${comparisonWindow}`,
    color: 'var(--mantine-color-red-7)',
  };
}

function cardIcon(key: DashboardSummaryCard['key']): typeof IconCurrencyDollar {
  switch (key) {
    case 'spend':
      return IconCurrencyDollar;
    case 'messages':
      return IconMessageCircle;
    case 'link_clicks':
      return IconLink;
    default:
      return IconUsers;
  }
}

function alertToneStyles(tone: DashboardPayload['alerts'][number]['tone']): {
  background: string;
  borderColor: string;
  accentColor: string;
} {
  switch (tone) {
    case 'red':
      return {
        background: 'var(--mantine-color-red-0)',
        borderColor: 'var(--mantine-color-red-2)',
        accentColor: 'var(--mantine-color-red-7)',
      };
    case 'yellow':
      return {
        background: 'var(--mantine-color-yellow-0)',
        borderColor: 'var(--mantine-color-yellow-2)',
        accentColor: 'var(--mantine-color-yellow-8)',
      };
    case 'blue':
      return {
        background: 'var(--mantine-color-blue-0)',
        borderColor: 'var(--mantine-color-blue-2)',
        accentColor: 'var(--mantine-color-blue-7)',
      };
    default:
      return {
        background: 'var(--mantine-color-teal-0)',
        borderColor: 'var(--mantine-color-teal-2)',
        accentColor: 'var(--mantine-color-teal-7)',
      };
  }
}

function alertActionLabel(alertId: string): string {
  if (alertId === 'sync-stale') {
    return 'Refresh now';
  }

  if (alertId === 'no-activity') {
    return 'View reports';
  }

  return 'Take action';
}

function formatCardValue(
  card: DashboardSummaryCard,
  currencyCode: string | null
): string {
  if (card.key === 'spend') {
    return formatCurrency(card.value, currencyCode);
  }

  return formatNumber(card.value);
}

const futureSections = [
  {
    title: 'Opportunities',
    description:
      'This area will surface plain-English recommendations based on account performance and alert signals.',
  },
  {
    title: 'Creative insights',
    description:
      'This area will later summarize what your active creatives are doing without turning the dashboard into a reporting maze.',
  },
];

export default function DashboardClient({ payload }: DashboardClientProps) {
  const [activeWindow, setActiveWindow] = useState<DashboardWindow>(payload.activeWindow);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const router = useRouter();

  const stateMeta = stateContent(payload.state);
  const summaryCards = payload.summaryByWindow[activeWindow];
  const trend = payload.trendByWindow[activeWindow];
  const hasReadyState = payload.state === 'ready';
  const activeAlert =
    hasReadyState
      ? payload.alerts.find((alert) => !dismissedAlertIds.includes(alert.id)) ?? null
      : null;
  const remainingAlertCount =
    hasReadyState && activeAlert
      ? payload.alerts.filter((alert) => !dismissedAlertIds.includes(alert.id)).length - 1
      : 0;

  const trendData = useMemo(
    () =>
      trend.points.map((point) => ({
        label: point.label,
        Spend: Number(point.spend.toFixed(2)),
        [trend.outcomeLabel]: Number(point.outcome.toFixed(2)),
      })),
    [trend]
  );

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshFeedback(null);

    try {
      const response = await fetch('/api/sync/refresh', { method: 'POST' });
      const result = (await response.json()) as {
        success?: boolean;
        refreshedCount?: number;
        failedCount?: number;
        message?: string;
        retryAfterMs?: number;
      };

      if (!response.ok || !result.success) {
        if (response.status === 429) {
          throw new Error(result.message || formatRetryDelay(result.retryAfterMs));
        }

        throw new Error(result.message || 'Refresh failed');
      }

      router.refresh();
      setRefreshFeedback({
        type: 'success',
        message: `Sync completed: ${result.refreshedCount ?? 0} updated, ${result.failedCount ?? 0} failed.`,
      });
    } catch (error) {
      setRefreshFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Sync failed. Check the integration status and try again.',
      });
    } finally {
      setRefreshing(false);
    }
  }

  function dismissAlert(alertId: string) {
    setDismissedAlertIds((current) =>
      current.includes(alertId) ? current : [...current, alertId]
    );
  }

  async function handleAlertAction(alertId: string) {
    if (alertId === 'sync-stale') {
      await handleRefresh();
      dismissAlert(alertId);
      return;
    }

    dismissAlert(alertId);
    router.push('/reports');
  }

  return (
    <Container size="lg" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="lg">
        <Paper
          withBorder
          radius="xl"
          p={{ base: 'lg', md: 'xl' }}
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderColor: 'var(--mantine-color-gray-3)',
          }}
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Stack gap="sm">
              <Group gap="xs">
                <Badge color={statusColor(payload.viewContext.platformStatus)} variant="light" size="lg">
                  {payload.viewContext.platformName ?? 'No platform selected'}
                </Badge>
                <Badge color="gray" variant="light" size="lg">
                  {payload.viewContext.adAccountName ?? 'No ad account selected'}
                </Badge>
              </Group>

              <div>
                <Text size="sm" c="dimmed" fw={600}>
                  {payload.viewContext.businessName}
                </Text>
                <Title order={1} size="h2" mt={4}>
                  Weekly account overview
                </Title>
                <Text size="md" c="dimmed" maw={560} mt={8}>
                  A simple view of what changed in your selected ad account, what needs attention, and what to review next.
                </Text>
              </div>

              <Group gap="xs">
                <Badge color={statusColor(payload.viewContext.platformStatus)} variant="outline">
                  Platform {formatStatusLabel(payload.viewContext.platformStatus)}
                </Badge>
                <Badge color={statusColor(payload.viewContext.adAccountStatus)} variant="outline">
                  Account {formatStatusLabel(payload.viewContext.adAccountStatus)}
                </Badge>
              </Group>
            </Stack>

            <Stack gap="md" align="stretch">
              <Group justify="space-between" align="center">
                <Group gap={6}>
                  <ThemeIcon variant="light" color="blue" radius="xl">
                    <IconClock size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={600}>
                      Last synced
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatDateTime(payload.viewContext.lastSyncedAt)}
                    </Text>
                  </div>
                </Group>

                <SegmentedControl
                  size="md"
                  radius="xl"
                  value={activeWindow}
                  onChange={(value) => setActiveWindow(value as DashboardWindow)}
                  data={payload.windowOptions.map((window) => ({
                    label: window === '7d' ? '7D' : '30D',
                    value: window,
                  }))}
                />
              </Group>

              <Group gap="sm" wrap="wrap">
                <Button
                  onClick={handleRefresh}
                  leftSection={<IconRefresh size={16} />}
                  loading={refreshing}
                  disabled={!payload.viewContext.canRefresh}
                >
                  Refresh data
                </Button>
                <Button
                  component={Link}
                  href="/reports"
                  variant="light"
                  leftSection={<IconArrowUpRight size={16} />}
                >
                  View reports
                </Button>
              </Group>

              {payload.viewContext.platformError ? (
                <Text size="sm" c="red">
                  {payload.viewContext.platformError}
                </Text>
              ) : null}
            </Stack>
          </SimpleGrid>

          <Stack gap="sm" mt="xl">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              Quick alerts
            </Text>

            {!hasReadyState ? (
              <Alert color={stateMeta.color} title={stateMeta.title} radius="lg" icon={<IconAlertCircle size={16} />}>
                <Text size="sm">{stateMeta.description}</Text>
                <Group mt="md" gap="sm">
                  <Button component={Link} href="/integration" variant="light">
                    Manage integrations
                  </Button>
                  <Button
                    onClick={handleRefresh}
                    variant="subtle"
                    leftSection={<IconRefresh size={16} />}
                    loading={refreshing}
                    disabled={!payload.viewContext.canRefresh}
                  >
                    Refresh data
                  </Button>
                </Group>
              </Alert>
            ) : activeAlert ? (
              <Paper
                withBorder
                radius="lg"
                p="lg"
                style={alertToneStyles(activeAlert.tone)}
              >
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                  <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon
                      variant="light"
                      radius="xl"
                      color={activeAlert.tone}
                    >
                      <IconAlertCircle size={16} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>{activeAlert.title}</Text>
                      <Text size="sm" mt={4} c="dimmed">
                        {activeAlert.description}
                      </Text>
                      {remainingAlertCount > 0 ? (
                        <Text size="xs" mt={10} style={{ color: 'var(--mantine-color-gray-7)' }}>
                          {remainingAlertCount} more alert{remainingAlertCount === 1 ? '' : 's'} waiting after this one.
                        </Text>
                      ) : null}
                    </div>
                  </Group>

                  <Group gap="sm" wrap="wrap">
                    <Button
                      variant="light"
                      color={activeAlert.tone}
                      onClick={() => void handleAlertAction(activeAlert.id)}
                      loading={activeAlert.id === 'sync-stale' && refreshing}
                    >
                      {alertActionLabel(activeAlert.id)}
                    </Button>
                    <Button variant="subtle" color="gray" onClick={() => dismissAlert(activeAlert.id)}>
                      Okay
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ) : (
              <Paper withBorder radius="lg" p="lg" bg="var(--mantine-color-teal-0)">
                <Group gap="sm" align="flex-start">
                  <ThemeIcon color="teal" variant="light" radius="xl">
                    <IconChartLine size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>No urgent changes right now</Text>
                    <Text size="sm" c="dimmed">
                      This account looks stable this week. Use the trend and campaign cards below for a quick review.
                    </Text>
                  </div>
                </Group>
              </Paper>
            )}
          </Stack>
        </Paper>

        {refreshFeedback ? (
          <Alert
            color={refreshFeedback.type === 'success' ? 'green' : 'red'}
            icon={<IconRefresh size={16} />}
            radius="lg"
          >
            {refreshFeedback.message}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {summaryCards.map((card) => {
            const IconComponent = cardIcon(card.key);
            const helper = comparisonText(card, activeWindow);

            return (
              <Paper key={card.key} withBorder radius="xl" p="lg">
                <Group justify="space-between" align="flex-start" mb="md">
                  <div>
                    <Text size="sm" c="dimmed" fw={600}>
                      {card.label}
                    </Text>
                    <Text fw={800} size="2rem" lh={1.1} mt={8}>
                      {formatCardValue(card, payload.viewContext.currencyCode)}
                    </Text>
                  </div>
                  <ThemeIcon size={42} radius="xl" variant="light" color="blue">
                    <IconComponent size={20} />
                  </ThemeIcon>
                </Group>

                <Text size="sm" style={{ color: helper.color }}>
                  {helper.label}
                </Text>
              </Paper>
            );
          })}
        </SimpleGrid>

        <Paper withBorder radius="xl" p={{ base: 'lg', md: 'xl' }}>
          <Group justify="space-between" align="flex-end" mb="md">
            <div>
              <Text size="sm" c="dimmed" fw={600}>
                Trend
              </Text>
              <Title order={3}>
                {activeWindow === '7d' ? 'Weekly trend' : 'Monthly trend'}
              </Title>
              <Text size="sm" c="dimmed" mt={4}>
                Spend and {trend.outcomeLabel.toLowerCase()} for the selected ad account.
              </Text>
            </div>
            <Badge color="blue" variant="light" size="lg">
              {activeWindow === '7d' ? '7-day view' : '30-day view'}
            </Badge>
          </Group>

          {trendData.length > 0 ? (
            <LineChart
              h={300}
              data={trendData}
              dataKey="label"
              withLegend
              legendProps={{ verticalAlign: 'top', height: 36 }}
              curveType="linear"
              gridAxis="xy"
              series={[
                { name: 'Spend', color: 'blue.6' },
                { name: trend.outcomeLabel, color: 'teal.6' },
              ]}
            />
          ) : (
            <Paper withBorder radius="lg" p="lg" bg="var(--mantine-color-gray-0)">
              <Text fw={700}>Trend data will appear here after account activity is synced</Text>
              <Text size="sm" c="dimmed" mt={6}>
                Once this account has recent daily performance data, this chart will switch between weekly and monthly views.
              </Text>
            </Paper>
          )}
        </Paper>

        <Paper withBorder radius="xl" p={{ base: 'lg', md: 'xl' }}>
          <Group justify="space-between" align="flex-end" mb="md">
            <div>
              <Text size="sm" c="dimmed" fw={600}>
                Campaign review
              </Text>
              <Title order={3}>Top campaigns</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Keep the dashboard simple for now by comparing campaigns only.
              </Text>
            </div>
            <Badge color="gray" variant="light" size="lg">
              {payload.campaignPreview.length} shown
            </Badge>
          </Group>

          {payload.campaignPreview.length > 0 ? (
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {payload.campaignPreview.map((campaign) => (
                <Paper key={campaign.campaignId} withBorder radius="lg" p="lg" bg="var(--mantine-color-gray-0)">
                  <Group justify="space-between" align="flex-start" mb="sm">
                    <div>
                      <Text fw={700}>{campaign.campaignName}</Text>
                      <Text size="sm" c="dimmed" mt={4}>
                        Campaign performance snapshot
                      </Text>
                    </div>
                    <Badge color="gray" variant="light">
                      {formatStatusLabel(campaign.status)}
                    </Badge>
                  </Group>

                  <Stack gap={10} mt="md">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Spend
                      </Text>
                      <Text fw={700}>
                        {formatCurrency(campaign.spend, payload.viewContext.currencyCode)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {campaign.primaryOutcomeLabel}
                      </Text>
                      <Text fw={700}>{formatNumber(campaign.primaryOutcomeValue)}</Text>
                    </Group>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
          ) : (
            <Paper withBorder radius="lg" p="lg" bg="var(--mantine-color-gray-0)">
              <Text fw={700}>Campaign-level data is not ready yet</Text>
              <Text size="sm" c="dimmed" mt={6}>
                As soon as campaign performance is available for this account, the top campaigns will appear here.
              </Text>
            </Paper>
          )}
        </Paper>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {futureSections.map((section) => (
            <Paper
              key={section.title}
              withBorder
              radius="xl"
              p="lg"
              style={{
                background: 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',
                borderStyle: 'dashed',
              }}
            >
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={700}>{section.title}</Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    {section.description}
                  </Text>
                </div>
                <Badge color="gray" variant="light">
                  Coming soon
                </Badge>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
