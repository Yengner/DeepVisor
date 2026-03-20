"use client";

import { Badge, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconActivityHeartbeat, IconChartBar } from "@tabler/icons-react";
import type { ReportKpi, ReportMetricTotals } from "@/lib/server/reports/types";

export interface KpiFrequencyChartProps {
  kpis: ReportKpi[];
  summary: ReportMetricTotals;
  currencyCode: string | null;
}

const PRIMARY_KPI_KEYS = new Set(['spend', 'conversion', 'impressions', 'clicks']);

export default function KpiFrequencyChart({ kpis, summary }: KpiFrequencyChartProps) {
  const primaryKpis = kpis.filter((kpi) => PRIMARY_KPI_KEYS.has(kpi.key));
  const secondaryKpis = kpis.filter((kpi) => !PRIMARY_KPI_KEYS.has(kpi.key));

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
        {primaryKpis.map((kpi) => (
          <Card
            key={kpi.key}
            withBorder
            radius="lg"
            p="lg"
            style={{
              borderColor: 'var(--mantine-color-blue-2)',
              background: 'linear-gradient(145deg, rgba(14,165,233,0.12), rgba(255,255,255,0.92))',
            }}
          >
            <Group justify="space-between" align="flex-start" mb="md">
              <Group gap="xs" align="center">
                <ThemeIcon variant="light" color="blue" radius="md" size="lg">
                  <IconChartBar size={18} />
                </ThemeIcon>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  {kpi.label}
                </Text>
              </Group>
              <Badge
                variant="light"
                color={
                  kpi.deltaPercent == null ? 'gray' : kpi.deltaPercent >= 0 ? 'green' : 'red'
                }
              >
                {kpi.deltaPercent == null ? 'No compare' : `${kpi.deltaPercent.toFixed(1)}%`}
              </Badge>
            </Group>

            <Text fw={900} size="2rem" lh={1.1}>
              {kpi.formattedValue}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 5 }} spacing="md">
        {secondaryKpis.map((kpi) => (
          <Card key={kpi.key} withBorder radius="lg" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={6}>
              {kpi.label}
            </Text>
            <Text fw={800} size="xl">
              {kpi.formattedValue}
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              {kpi.deltaPercent == null
                ? 'No comparison selected'
                : `${kpi.deltaPercent.toFixed(1)}% vs previous period`}
            </Text>
          </Card>
        ))}

        <Card
          withBorder
          radius="lg"
          p="md"
          style={{ background: 'linear-gradient(145deg, rgba(15,23,42,0.04), rgba(14,165,233,0.08))' }}
        >
          <Group gap="xs" mb={6}>
            <ThemeIcon variant="light" color="teal" radius="md">
              <IconActivityHeartbeat size={16} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Frequency
            </Text>
          </Group>
          <Text fw={800} size="xl">
            {summary.frequency.toFixed(2)}
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Average exposures per reached person.
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
