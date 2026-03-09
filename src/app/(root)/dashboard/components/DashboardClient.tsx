'use client';

import '@mantine/charts/styles.css';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LineChart } from '@mantine/charts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
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
  IconRefresh,
  IconTarget,
  IconUsers,
} from '@tabler/icons-react';
import type { DashboardPayload, DashboardState } from '../types';

type DashboardClientProps = {
  payload: DashboardPayload;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
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

function statusColor(status: string | undefined): string {
  switch (status) {
    case 'connected':
      return 'green';
    case 'error':
      return 'red';
    case 'needs_reauth':
      return 'orange';
    default:
      return 'gray';
  }
}

function stateContent(state: DashboardState): {
  color: 'blue' | 'orange' | 'yellow' | 'teal' | 'red' | 'green';
  title: string;
  description: string;
} {
  switch (state) {
    case 'no_platform_selected':
      return {
        color: 'blue',
        title: 'Select an integration to unlock dashboard detail',
        description:
          'No platform integration is selected yet. Open integrations and connect one to start syncing business data.',
      };
    case 'platform_not_found_or_not_connected':
      return {
        color: 'orange',
        title: 'Selected integration is missing or disconnected',
        description:
          'The saved platform selection is stale or not connected. Reconnect it from integrations to restore live data.',
      };
    case 'no_ad_account_selected':
      return {
        color: 'yellow',
        title: 'Select an ad account for account-level analytics',
        description:
          'Your business rollup is available, but an ad account is not selected in the top bar yet.',
      };
    case 'ad_account_selected_no_metrics':
      return {
        color: 'teal',
        title: 'Ad account connected, metrics still populating',
        description:
          'The account is selected but no aggregated metrics are available yet. Run a refresh after the next sync window.',
      };
    default:
      return {
        color: 'green',
        title: 'Dashboard is live',
        description: 'Selected account metrics and business rollups are loaded from your connected integrations.',
      };
  }
}

export default function DashboardClient({ payload }: DashboardClientProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const stateMeta = stateContent(payload.state);
  const selectedMetrics = payload.adAccount?.aggregated_metrics ?? null;
  const businessTotals = payload.businessRollup.totals;

  const selectedSpendShare =
    selectedMetrics && businessTotals.spend > 0
      ? Math.min(100, (selectedMetrics.spend / businessTotals.spend) * 100)
      : 0;

  const selectedLeadShare =
    selectedMetrics && businessTotals.leads > 0
      ? Math.min(100, (selectedMetrics.leads / businessTotals.leads) * 100)
      : 0;

  const trendData = useMemo(
    () =>
      payload.trend.points
        .map((point) => {
          const rawDate = point.date_stop ?? point.date_start;
          const date = rawDate
            ? new Date(rawDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : null;

          if (!date) {
            return null;
          }

          return {
            date,
            Spend: Number(point.spend.toFixed(2)),
            Leads: Number(point.leads.toFixed(2)),
            Clicks: Number(point.clicks.toFixed(2)),
          };
        })
        .filter((point): point is { date: string; Spend: number; Leads: number; Clicks: number } =>
          Boolean(point)
        ),
    [payload.trend.points]
  );

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshFeedback(null);

    try {
      const response = await fetch('/api/integrations/refresh', { method: 'POST' });
      const result = (await response.json()) as {
        success?: boolean;
        refreshedCount?: number;
        failedCount?: number;
      };

      if (!response.ok || !result.success) {
        throw new Error('Refresh failed');
      }

      setRefreshFeedback({
        type: 'success',
        message: `Refresh completed: ${result.refreshedCount ?? 0} updated, ${result.failedCount ?? 0} failed.`,
      });
    } catch {
      setRefreshFeedback({
        type: 'error',
        message: 'Refresh failed. Check integration status and try again.',
      });
    } finally {
      setRefreshing(false);
    }
  }

  const kpiCards = [
    {
      label: 'Selected Spend',
      value: selectedMetrics ? formatCurrency(selectedMetrics.spend) : '—',
      helper: selectedMetrics ? 'Current selected account' : 'Select an account for detail',
      icon: IconCurrencyDollar,
      color: 'green',
    },
    {
      label: 'Selected Leads',
      value: selectedMetrics ? formatNumber(selectedMetrics.leads) : '—',
      helper: selectedMetrics ? `${formatNumber(selectedMetrics.messages)} messages` : 'No selected account',
      icon: IconUsers,
      color: 'blue',
    },
    {
      label: 'Selected Clicks',
      value: selectedMetrics ? formatNumber(selectedMetrics.clicks) : '—',
      helper: selectedMetrics
        ? `${formatNumber(selectedMetrics.link_clicks)} link clicks`
        : 'No selected account',
      icon: IconLink,
      color: 'cyan',
    },
    {
      label: 'Selected CTR',
      value: selectedMetrics ? formatPercent(selectedMetrics.ctr) : '—',
      helper: selectedMetrics ? 'Click-through performance' : 'No selected account',
      icon: IconTarget,
      color: 'violet',
    },
  ];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Card
          withBorder
          radius="lg"
          p="xl"
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(120deg, #0f172a 0%, #111827 50%, #0ea5e9 130%)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Group justify="space-between" align="flex-start" gap="xl">
            <Stack gap="sm" style={{ flex: 1 }}>
              <Group gap="xs">
                <Badge color="cyan" variant="light" size="lg">
                  {payload.business.name}
                </Badge>
                {payload.platform ? (
                  <Badge color={statusColor(payload.platform.status)} variant="light" size="lg">
                    {payload.platform.displayName} {payload.platform.status}
                  </Badge>
                ) : (
                  <Badge color="gray" variant="outline" size="lg">
                    No platform selected
                  </Badge>
                )}
                {payload.adAccount?.name ? (
                  <Badge color="teal" variant="light" size="lg">
                    {payload.adAccount.name}
                  </Badge>
                ) : null}
              </Group>

              <Title order={2} c="white">
                Executive Dashboard
              </Title>
              <Text c="gray.2">
                Business-scoped performance with account detail when available and inline fallback guidance when it is
                not.
              </Text>

              <Group gap="sm">
                <Button
                  component={Link}
                  href="/integration"
                  leftSection={<IconArrowUpRight size={16} />}
                  variant="white"
                  color="dark"
                >
                  Open integrations
                </Button>
                <Button
                  onClick={handleRefresh}
                  leftSection={<IconRefresh size={16} />}
                  loading={refreshing}
                  disabled={!payload.platform || payload.platform.status !== 'connected'}
                  variant="light"
                  color="blue"
                >
                  Refresh snapshot
                </Button>
              </Group>
            </Stack>

            <Stack gap={6} align="flex-end">
              <Group gap={6}>
                <IconClock size={14} color="var(--mantine-color-gray-3)" />
                <Text size="sm" c="gray.2">
                  Integration sync {formatDateTime(payload.platform?.lastSyncedAt ?? null)}
                </Text>
              </Group>
              <Text size="sm" c="gray.2">
                Account sync {formatDateTime(payload.adAccount?.last_synced ?? null)}
              </Text>
              {payload.platform?.lastError ? (
                <Badge color="red" variant="light">
                  {payload.platform.lastError}
                </Badge>
              ) : null}
            </Stack>
          </Group>
        </Card>

        <Alert color={stateMeta.color} title={stateMeta.title} icon={<IconAlertCircle size={16} />}>
          {stateMeta.description}
        </Alert>

        {refreshFeedback ? (
          <Alert color={refreshFeedback.type === 'success' ? 'green' : 'red'} icon={<IconRefresh size={16} />}>
            {refreshFeedback.message}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {kpiCards.map((card) => (
            <Card key={card.label} withBorder radius="lg" p="lg">
              <Group justify="space-between" mb="sm">
                <Badge color={card.color} variant="light">
                  {card.label}
                </Badge>
                <ThemeIcon variant="light" color={card.color} radius="xl">
                  <card.icon size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="xl">
                {card.value}
              </Text>
              <Text size="sm" c="dimmed">
                {card.helper}
              </Text>
            </Card>
          ))}
        </SimpleGrid>

        <Paper withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="sm">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Business Rollup
              </Text>
              <Text fw={700}>All ad accounts in this business</Text>
            </div>
            <Badge variant="light" color="gray">
              {payload.businessRollup.accountCount} accounts
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
            <Card withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Spend
              </Text>
              <Text fw={700}>{formatCurrency(businessTotals.spend)}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Leads
              </Text>
              <Text fw={700}>{formatNumber(businessTotals.leads)}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Clicks
              </Text>
              <Text fw={700}>{formatNumber(businessTotals.clicks)}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Last Business Sync
              </Text>
              <Text fw={700}>{formatDateTime(payload.businessRollup.lastSyncedAt)}</Text>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Text size="sm" fw={600} mb={6}>
                Selected account share of spend
              </Text>
              <Progress value={selectedSpendShare} size="lg" radius="xl" />
              <Text size="xs" c="dimmed" mt={6}>
                {selectedMetrics
                  ? `${formatPercent(selectedSpendShare)} of business spend`
                  : 'Select an account to compare against total spend'}
              </Text>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Text size="sm" fw={600} mb={6}>
                Selected account share of leads
              </Text>
              <Progress value={selectedLeadShare} size="lg" radius="xl" color="teal" />
              <Text size="xs" c="dimmed" mt={6}>
                {selectedMetrics
                  ? `${formatPercent(selectedLeadShare)} of business leads`
                  : 'Select an account to compare against total leads'}
              </Text>
            </Paper>
          </SimpleGrid>
        </Paper>

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="lg">
              <Paper withBorder radius="lg" p="lg">
                <Group justify="space-between" mb="sm">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Trend
                    </Text>
                    <Text fw={700}>30-day trajectory</Text>
                  </div>
                  <Badge color="blue" variant="light">
                    Window {payload.trend.defaultWindow}d
                  </Badge>
                </Group>

                {trendData.length > 0 ? (
                  <LineChart
                    h={280}
                    data={trendData}
                    dataKey="date"
                    withLegend
                    legendProps={{ verticalAlign: 'top', height: 36 }}
                    tooltipAnimationDuration={200}
                    curveType="linear"
                    gridAxis="xy"
                    series={[
                      { name: 'Spend', color: 'blue.6' },
                      { name: 'Leads', color: 'teal.6' },
                      { name: 'Clicks', color: 'violet.6' },
                    ]}
                  />
                ) : (
                  <Paper withBorder radius="md" p="lg">
                    <Text fw={600}>Trend data unavailable</Text>
                    <Text size="sm" c="dimmed">
                      Once daily metrics are synced for the selected account, this section will chart spend, leads, and
                      clicks for the last 30 days.
                    </Text>
                  </Paper>
                )}
              </Paper>

              <Paper withBorder radius="lg" p="lg">
                <Group justify="space-between" mb="sm">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Campaign Snapshot
                    </Text>
                    <Text fw={700}>Top campaigns by conversion signal</Text>
                  </div>
                  <Badge color="gray" variant="light">
                    {payload.campaignSnapshot.length} rows
                  </Badge>
                </Group>

                {payload.campaignSnapshot.length > 0 ? (
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Campaign</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Spend</Table.Th>
                        <Table.Th>Leads</Table.Th>
                        <Table.Th>Clicks</Table.Th>
                        <Table.Th>Cost / Result</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {payload.campaignSnapshot.map((campaign) => (
                        <Table.Tr key={campaign.campaignId}>
                          <Table.Td>{campaign.campaignName}</Table.Td>
                          <Table.Td>
                            <Badge color="gray" variant="light">
                              {campaign.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{formatCurrency(campaign.spend)}</Table.Td>
                          <Table.Td>{formatNumber(campaign.leads)}</Table.Td>
                          <Table.Td>{formatNumber(campaign.clicks)}</Table.Td>
                          <Table.Td>{formatCurrency(campaign.costPerResult)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Paper withBorder radius="md" p="lg">
                    <Text fw={600}>No campaign rows yet</Text>
                    <Text size="sm" c="dimmed">
                      Campaign-level highlights will appear here after enough synced delivery data is available.
                    </Text>
                  </Paper>
                )}
              </Paper>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              <Paper withBorder radius="lg" p="lg">
                <Group justify="space-between" mb="sm">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Health
                    </Text>
                    <Text fw={700}>Integration status</Text>
                  </div>
                  <ThemeIcon variant="light" color="blue" radius="xl">
                    <IconChartLine size={16} />
                  </ThemeIcon>
                </Group>

                <Stack gap={8}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Platform
                    </Text>
                    <Badge color={statusColor(payload.platform?.status)} variant="light">
                      {payload.platform?.status ?? 'not selected'}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Integration sync
                    </Text>
                    <Text size="sm">{formatDateTime(payload.platform?.lastSyncedAt ?? null)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Ad account sync
                    </Text>
                    <Text size="sm">{formatDateTime(payload.adAccount?.last_synced ?? null)}</Text>
                  </Group>
                  {payload.platform?.lastError ? (
                    <Alert color="red" icon={<IconAlertCircle size={14} />}>
                      {payload.platform.lastError}
                    </Alert>
                  ) : null}
                </Stack>
              </Paper>

              <Paper withBorder radius="lg" p="lg">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Actions
                </Text>
                <Text fw={700} mb="sm">
                  Next best steps
                </Text>
                <Stack>
                  <Button
                    component={Link}
                    href="/integration"
                    leftSection={<IconArrowUpRight size={16} />}
                    variant="light"
                    color="blue"
                    fullWidth
                  >
                    Manage integrations
                  </Button>
                  <Button
                    onClick={handleRefresh}
                    leftSection={<IconRefresh size={16} />}
                    loading={refreshing}
                    disabled={!payload.platform || payload.platform.status !== 'connected'}
                    variant="light"
                    color="teal"
                    fullWidth
                  >
                    Refresh integrations
                  </Button>
                  <Text size="xs" c="dimmed">
                    If no ad account is selected, choose one from the top bar to unlock account-level KPI and trend
                    views.
                  </Text>
                </Stack>
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
