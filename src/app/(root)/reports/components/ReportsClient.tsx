"use client";

import '@mantine/charts/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { useMemo, useTransition } from 'react';
import { Badge, Box, Card, Container, Grid, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReportFilterOptions, ReportPayload } from '@/lib/server/reports/types';
import ReportsHeader from './layout/ReportsHeader';
import ReportsSidebar from './layout/ReportsSidebar';
import KpiFrequencyChart from './cards/KpiFrequencyChart';
import LineChartSection from './cards/LineChartSection';
import PerformanceTable from './cards/PerformanceTable';

interface ReportsClientProps {
  payload: ReportPayload;
  filterOptions: ReportFilterOptions;
}

function resolveScope(params: URLSearchParams) {
  if (params.get('ad_id')) {
    return 'ad';
  }

  if (params.get('adset_id')) {
    return 'adset';
  }

  if (params.get('campaign_id')) {
    return 'campaign';
  }

  if (params.get('ad_account_id')) {
    return 'ad_account';
  }

  if (params.get('platform_integration_id')) {
    return 'platform';
  }

  return 'business';
}

export function ReportsClient({ payload, filterOptions }: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearchString = searchParams?.toString() ?? '';

  const updateSearch = (mutate: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(currentSearchString);
    mutate(nextParams);
    nextParams.set('scope', resolveScope(nextParams));

    startTransition(() => {
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    });
  };

  const exportLinks = useMemo(() => {
    const query = currentSearchString ? `?${currentSearchString}` : '';

    return {
      pdf: `/api/reports/pdf${query}`,
      csv: `/api/reports/csv${query}`,
    };
  }, [currentSearchString]);

  const hasTrendData = payload.series.length > 0;
  const hasBreakdownData = payload.breakdown.rows.length > 0;

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <ReportsHeader
          payload={payload}
          exportLinks={exportLinks}
          onUpdate={updateSearch}
          isPending={isPending}
        />

        <Card
          withBorder
          radius="lg"
          p="md"
          style={{ background: 'linear-gradient(180deg, rgba(14,165,233,0.04), rgba(15,23,42,0.01))' }}
        >
          <Grid gutter="lg" align="flex-start">
            <Grid.Col span={{ base: 12, xl: 3 }}>
              <Box style={{ position: 'sticky', top: 16 }}>
                <ReportsSidebar
                  query={payload.query}
                  filterOptions={filterOptions}
                  onUpdate={updateSearch}
                />
              </Box>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 9 }}>
              <Stack gap="lg">
                {isPending && (
                  <Card withBorder radius="md" p="sm">
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Updating report…</Text>
                    </Box>
                  </Card>
                )}

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                  <Card withBorder radius="lg" p="lg">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                      Report Context
                    </Text>
                    <Text fw={700} size="lg" mb={6}>
                      {payload.meta.scopeLabel} report
                    </Text>
                    <Text size="sm" c="dimmed" mb="md">
                      Generated {new Date(payload.meta.generatedAt).toLocaleString()}
                    </Text>
                    <Group gap="xs">
                      {payload.export.filterSummary.map((item) => (
                        <Badge key={item.label} variant="light" color="blue" radius="sm">
                          {item.label}: {item.value}
                        </Badge>
                      ))}
                    </Group>
                  </Card>

                  <Card withBorder radius="lg" p="lg">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                      Data Coverage
                    </Text>
                    <Text fw={700} size="lg" mb={6}>
                      {hasBreakdownData
                        ? `${payload.breakdown.rows.length} entities in ${payload.breakdown.title.toLowerCase()}`
                        : 'No entity breakdown available'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {hasTrendData
                        ? `${payload.series.length} grouped time points are available for the selected range.`
                        : hasBreakdownData
                          ? 'Breakdown data is available even if the rolled-up trend is still catching up.'
                          : 'No metrics matched the selected filters and date range.'}
                    </Text>
                  </Card>
                </SimpleGrid>

                <KpiFrequencyChart
                  kpis={payload.kpis}
                  summary={payload.summary}
                  currencyCode={payload.meta.currencyCode}
                />
                <LineChartSection
                  series={payload.series}
                  breakdown={payload.breakdown.chart}
                  breakdownTitle={payload.breakdown.title}
                  currencyCode={payload.meta.currencyCode}
                />
                <PerformanceTable
                  title={payload.breakdown.title}
                  rows={payload.breakdown.rows}
                  currencyCode={payload.meta.currencyCode}
                />
              </Stack>
            </Grid.Col>
          </Grid>
        </Card>
      </Stack>
    </Container>
  );
}
