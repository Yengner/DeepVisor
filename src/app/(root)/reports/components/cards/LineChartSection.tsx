"use client";

import { BarChart, LineChart } from "@mantine/charts";
import { Card, Grid, Group, Stack, Text } from "@mantine/core";
import type { ReportBreakdownChartPoint, ReportTimeSeriesPoint } from "@/lib/server/reports/types";

interface LineChartSectionProps {
  series: ReportTimeSeriesPoint[];
  breakdown: ReportBreakdownChartPoint[];
  breakdownTitle: string;
  currencyCode: string | null;
}

function formatCurrency(value: number, currencyCode: string | null) {
  if (!currencyCode || currencyCode === 'MIXED') {
    return value.toFixed(2);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export default function LineChartSection({
  series,
  breakdown,
  breakdownTitle,
  currencyCode,
}: LineChartSectionProps) {
  const trendData = series.map((point) => ({
    label: point.label,
    Spend: Number(point.spend.toFixed(2)),
    Results: point.conversion,
    Clicks: point.clicks,
  }));

  const breakdownData = breakdown.map((point) => ({
    label: point.label,
    Spend: Number(point.spend.toFixed(2)),
    Results: point.conversion,
  }));

  const hasTrendData = trendData.length > 0;
  const hasBreakdownData = breakdownData.length > 0;

  return (
    <Grid gutter="md">
      <Grid.Col span={{ base: 12, lg: 7 }}>
        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" mb="sm">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Trend
              </Text>
              <Text fw={700}>Performance over time</Text>
            </div>
          </Group>
          {hasTrendData ? (
            <LineChart
              h={320}
              data={trendData}
              dataKey="label"
              series={[
                { name: 'Spend', color: 'blue.6' },
                { name: 'Results', color: 'green.6' },
                { name: 'Clicks', color: 'orange.6' },
              ]}
              curveType="linear"
              withLegend
              valueFormatter={(value) => value.toLocaleString()}
            />
          ) : (
            <Stack justify="center" align="center" h={320} gap="xs">
              <Text fw={700}>No rolled-up trend available</Text>
              <Text size="sm" c="dimmed" ta="center" maw={360}>
                The selected filters currently have no time-series rollup for this range. If
                entity breakdown data exists, it is still shown in the chart and table on this
                page.
              </Text>
            </Stack>
          )}
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 5 }}>
        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" mb="sm">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Breakdown
              </Text>
              <Text fw={700}>{breakdownTitle}</Text>
            </div>
          </Group>
          {hasBreakdownData ? (
            <BarChart
              h={320}
              data={breakdownData}
              dataKey="label"
              series={[
                { name: 'Spend', color: 'cyan.6' },
                { name: 'Results', color: 'grape.6' },
              ]}
              withLegend
              tickLine="y"
              valueFormatter={(value) => formatCurrency(Number(value), currencyCode)}
            />
          ) : (
            <Stack justify="center" align="center" h={320} gap="xs">
              <Text fw={700}>No breakdown data</Text>
              <Text size="sm" c="dimmed" ta="center" maw={320}>
                No entities matched the selected scope and date range.
              </Text>
            </Stack>
          )}
        </Card>
      </Grid.Col>
    </Grid>
  );
}
