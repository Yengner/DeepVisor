'use client';

import { Group, Paper, Text, ThemeIcon, Badge, Divider, Tooltip, ScrollArea } from '@mantine/core';
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

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Paper p="xs" withBorder mb="xs">
      <ScrollArea scrollbarSize={6}>
        <Group gap="lg" wrap='nowrap' style={{ minWidth: 1000 }}>
          {/* OVERVIEW METRICS */}

          {/* Campaigns */}
          <Tooltip label="Total number of active campaigns in this account" withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color={platformColor} variant="light">
                <IconChartBar size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>Campaigns</Text>
                <Text fw={600}>{totalCampaigns}</Text>
              </div>
            </Group>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* Ad Spend */}
          <Tooltip label="Total amount spent on advertising across all campaigns" withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color="green" variant="light">
                <IconCurrencyDollar size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>Ad Spend</Text>
                <Text fw={600}>${accountMetrics.spend.toFixed(2)}</Text>
              </div>
            </Group>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* Impressions with CPM badge */}
          <Tooltip label={`${accountMetrics.impressions.toLocaleString()} total ad impressions - how many times your ads were shown`} withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color="violet" variant="light">
                <IconEye size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>Impressions</Text>
                <Group gap={5} align="center">
                  <Text fw={600}>{formatNumber(accountMetrics.impressions)}</Text>
                  <Badge size="xs" color="violet" variant="light">
                    ${accountMetrics.cpm.toFixed(2)} CPM
                  </Badge>
                </Group>
              </div>
            </Group>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* Reach */}
          <Tooltip label={`${accountMetrics.reach.toLocaleString()} unique users who saw your ads at least once`} withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color="blue" variant="light">
                <IconUsers size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>Reach</Text>
                <Text fw={600}>{formatNumber(accountMetrics.reach)}</Text>
              </div>
            </Group>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* Results */}
          <Tooltip label={`${totalResults.toLocaleString()} total conversions (${accountMetrics.leads} leads + ${accountMetrics.messages} messages)`} withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color="cyan" variant="light">
                <IconMessageCircle size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>Results</Text>
                <Group gap={5} align="center">
                  <Text fw={600}>{formatNumber(totalResults)}</Text>
                  <Badge size="xs" color="cyan" variant="light">
                    ${costPerResult.toFixed(2)}/result
                  </Badge>
                </Group>
              </div>
            </Group>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* PERFORMANCE METRICS */}

          {/* Clicks with CPC badge */}
          <Tooltip label={`${accountMetrics.clicks.toLocaleString()} total clicks on your ads (includes all click types)`} withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color="teal" variant="light">
                <IconClick size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>Clicks</Text>
                <Group gap={5} align="center">
                  <Text fw={600}>{formatNumber(accountMetrics.clicks)}</Text>
                  <Badge size="xs" color="teal" variant="light">
                    ${accountMetrics.cpc.toFixed(2)} CPC
                  </Badge>
                </Group>
              </div>
            </Group>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* Link Clicks */}
          <Tooltip label={`${accountMetrics.link_clicks.toLocaleString()} clicks specifically on links in your ads (subset of total clicks)`} withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color="indigo" variant="light">
                <IconArrowAutofitRight size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>Link Clicks</Text>
                <Text fw={600}>{formatNumber(accountMetrics.link_clicks)}</Text>
              </div>
            </Group>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* CTR */}
          <Tooltip label={`Click-through Rate: ${accountMetrics.ctr.toFixed(2)}% of people who saw your ads clicked on them`} withArrow>
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" color="orange" variant="light">
                <IconPercentage size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" mb={-5}>CTR</Text>
                <Text fw={600}>{accountMetrics.ctr.toFixed(2)}%</Text>
              </div>
            </Group>
          </Tooltip>
        </Group>
      </ScrollArea>
    </Paper>
  );
}