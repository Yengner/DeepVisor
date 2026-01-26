'use client';

import { Card, Group, Text, ThemeIcon, Badge, SimpleGrid } from '@mantine/core';
import {
  IconChartBar, IconCurrencyDollar, IconEye, IconClick,
  IconUsers, IconMessageCircle, IconPercentage,
  IconArrowAutofitRight
} from '@tabler/icons-react';

interface CampaignStatsProps {
  totalCampaigns: number;
  accountMetrics: {
    spend: number;
    impressions: number;
    clicks: number;
    link_clicks: number;
    reach: number;
    leads: number;
    messages: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  platformColor?: string;
}

export default function CampaignStats({
  totalCampaigns,
  accountMetrics,
  platformColor = 'blue'
}: CampaignStatsProps) {
  const totalResults = accountMetrics.leads + accountMetrics.messages;
  const costPerResult = totalResults > 0 ? accountMetrics.spend / totalResults : 0;

  const formatNumber = (num: number): string => {
    if (Number.isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number): string => `$${num.toFixed(2)}`;

  return (
    <Card withBorder radius="lg" p="md" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(14,165,233,0.02))' }}>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        <StatCard
          label="Campaigns"
          value={formatNumber(totalCampaigns)}
          helper="Active in this account"
          color={platformColor}
          icon={IconChartBar}
        />
        <StatCard
          label="Spend"
          value={formatCurrency(accountMetrics.spend)}
          helper="Total tracked"
          color="green"
          icon={IconCurrencyDollar}
        />
        <StatCard
          label="Results"
          value={formatNumber(totalResults)}
          helper={`${formatCurrency(costPerResult)} / result`}
          color="cyan"
          icon={IconMessageCircle}
        />
        <StatCard
          label="Reach"
          value={formatNumber(accountMetrics.reach)}
          helper="Unique viewers"
          color="blue"
          icon={IconUsers}
        />
        <StatCard
          label="Impressions"
          value={formatNumber(accountMetrics.impressions)}
          helper={`${formatCurrency(accountMetrics.cpm)} CPM`}
          color="violet"
          icon={IconEye}
        />
        <StatCard
          label="Clicks"
          value={formatNumber(accountMetrics.clicks)}
          helper={`${formatCurrency(accountMetrics.cpc)} CPC`}
          color="teal"
          icon={IconClick}
        />
        <StatCard
          label="Link clicks"
          value={formatNumber(accountMetrics.link_clicks)}
          helper="Deep link outs"
          color="indigo"
          icon={IconArrowAutofitRight}
        />
        <StatCard
          label="CTR"
          value={`${accountMetrics.ctr.toFixed(2)}%`}
          helper="Engagement rate"
          color="orange"
          icon={IconPercentage}
        />
      </SimpleGrid>
    </Card>
  );
}

function StatCard({
  label,
  value,
  helper,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}) {
  return (
    <Card withBorder radius="md" p="md" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="md" radius="md" color={color} variant="light">
            <Icon size={14} />
          </ThemeIcon>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {label}
          </Text>
        </Group>
        <Badge size="sm" variant="light" color={color}>
          Live
        </Badge>
      </Group>
      <Text fw={800} size="lg">
        {value}
      </Text>
      <Text size="sm" c="dimmed">
        {helper}
      </Text>
    </Card>
  );
}
