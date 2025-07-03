'use client';

import { Grid, Group, Paper, Text, RingProgress, ThemeIcon } from '@mantine/core';
import { IconCurrencyDollar, IconEye, IconClick, IconPercentage } from '@tabler/icons-react';

interface CampaignStatsProps {
  totalCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgCTR: number;
}

export default function CampaignStats({
  totalCampaigns,
  totalSpend,
  totalImpressions,
  totalClicks,
  avgCTR
}: CampaignStatsProps) {
  return (
    <Grid>
      <Grid.Col span={3}>
        <Paper p="md" radius="md" withBorder>
          <Group justify="apart">
            <div>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Total Campaigns
              </Text>
              <Text fw={700} size="xl">
                {totalCampaigns}
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="xl">
              <IconClick size={24} />
            </ThemeIcon>
          </Group>
        </Paper>
      </Grid.Col>

      <Grid.Col span={3}>
        <Paper p="md" radius="md" withBorder>
          <Group justify="apart">
            <div>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Total Spend
              </Text>
              <Text fw={700} size="xl">
                ${totalSpend.toFixed(2)}
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" size={48} radius="xl">
              <IconCurrencyDollar size={24} />
            </ThemeIcon>
          </Group>
        </Paper>
      </Grid.Col>

      <Grid.Col span={3}>
        <Paper p="md" radius="md" withBorder>
          <Group justify="apart">
            <div>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Impressions
              </Text>
              <Text fw={700} size="xl">
                {totalImpressions.toLocaleString()}
              </Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="xl">
              <IconEye size={24} />
            </ThemeIcon>
          </Group>
        </Paper>
      </Grid.Col>

      <Grid.Col span={3}>
        <Paper p="md" radius="md" withBorder>
          <Group justify="apart">
            <div>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Average CTR
              </Text>
              <Text fw={700} size="xl">
                {avgCTR.toFixed(2)}%
              </Text>
            </div>
            <RingProgress
              size={48}
              roundCaps
              thickness={4}
              sections={[{ value: Math.min(avgCTR * 5, 100), color: 'cyan' }]}
              label={
                <ThemeIcon color="cyan" variant="light" size={38} radius="xl">
                  <IconPercentage size={20} />
                </ThemeIcon>
              }
            />
          </Group>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}