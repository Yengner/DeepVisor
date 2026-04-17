'use client';

import '@mantine/charts/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { BarChart, LineChart } from '@mantine/charts';
import {
  Badge,
  Button,
  Card,
  Container,
  Drawer,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconProgressCheck,
  IconTimeline,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import ReviveCampaignPrompt from '@/components/campaigns/ReviveCampaignPrompt';
import type {
  ReportBreakdownRow,
  ReportFilterOptions,
  ReportKpi,
  ReportPayload,
  ReportTimeSeriesPoint,
} from '@/lib/server/reports/types';
import PerformanceTable from './cards/PerformanceTable';
import ReportsHeader from './layout/ReportsHeader';
import ReportsSidebar from './layout/ReportsSidebar';
import classes from './ReportsClient.module.css';

interface ReportsClientProps {
  payload: ReportPayload;
  filterOptions: ReportFilterOptions;
  isDemo?: boolean;
}

const staticAudienceMix = [
  { audience: 'Retargeting', Share: 34 },
  { audience: 'Lookalike', Share: 27 },
  { audience: 'Interest stack', Share: 23 },
  { audience: 'Broad prospecting', Share: 16 },
];

const staticChannelSignals = [
  {
    label: 'Instagram Reels',
    score: 86,
    note: 'Lowest projected cost per lead',
    share: '32% of expected results',
    color: 'grape',
  },
  {
    label: 'Facebook Feed',
    score: 79,
    note: 'Most stable reach volume',
    share: '29% of expected results',
    color: 'blue',
  },
  {
    label: 'Instagram Stories',
    score: 73,
    note: 'Strong click-through rate',
    share: '24% of expected results',
    color: 'pink',
  },
  {
    label: 'Messenger',
    score: 61,
    note: 'Best reply quality',
    share: '15% of expected results',
    color: 'teal',
  },
] as const;

type ReportInsight = {
  summary: string;
  strongestLabel: string;
  strongestDetail: string;
  weakestLabel: string;
  weakestDetail: string;
  momentumLabel: string;
  momentumDetail: string;
  recommendationLabel: string;
  recommendationDetail: string;
  worked: string[];
  watch: string[];
  nextMoves: string[];
};

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

function formatCurrency(value: number, currencyCode: string | null, digits = 0) {
  if (!currencyCode || currencyCode === 'MIXED') {
    return digits === 0 ? Math.round(value).toLocaleString() : value.toFixed(digits);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `$${value.toFixed(digits)}`;
  }
}

function formatSignedPercent(value: number | null) {
  if (value == null) {
    return 'No comparison';
  }

  const rounded = Math.abs(value).toFixed(1);
  return value >= 0 ? `+${rounded}%` : `-${rounded}%`;
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return 'this period';
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatEntityPerformance(row: ReportBreakdownRow, currencyCode: string | null) {
  if (row.conversion > 0) {
    return `${row.conversion.toLocaleString()} results at ${formatCurrency(row.costPerResult, currencyCode, 2)} per result`;
  }

  return `${formatCurrency(row.spend, currencyCode, 2)} spent without a recorded result`;
}

function getEntityLabel(level: ReportBreakdownRow['level']) {
  if (level === 'campaign') {
    return 'Campaign';
  }

  if (level === 'adset') {
    return 'Ad set';
  }

  return 'Ad';
}

function scoreStrongestRow(row: ReportBreakdownRow) {
  const resultEfficiency = row.conversion > 0 ? row.conversion / Math.max(row.spend, 1) : 0;
  return row.conversion * 1000 + resultEfficiency * 10000 + row.ctr * 100 - row.cpc * 10;
}

function scoreWeakestRow(row: ReportBreakdownRow) {
  const resultPenalty = row.conversion === 0 ? 1000 : 0;
  return (
    resultPenalty +
    row.costPerResult * 12 +
    row.cpc * 6 +
    row.spend / 10 -
    row.ctr * 40 -
    row.conversion * 30
  );
}

function pickStrongestRow(rows: ReportBreakdownRow[]) {
  return [...rows]
    .filter((row) => row.spend > 0 || row.conversion > 0 || row.clicks > 0)
    .sort((left, right) => scoreStrongestRow(right) - scoreStrongestRow(left))[0] ?? null;
}

function pickWeakestRow(rows: ReportBreakdownRow[]) {
  return [...rows]
    .filter((row) => row.spend > 0 || row.clicks > 0)
    .sort((left, right) => scoreWeakestRow(right) - scoreWeakestRow(left))[0] ?? null;
}

function pickPositiveKpi(kpis: ReportKpi[]) {
  return [...kpis]
    .filter((kpi) => kpi.deltaPercent != null)
    .sort((left, right) => (right.deltaPercent ?? 0) - (left.deltaPercent ?? 0))[0] ?? null;
}

function pickNegativeKpi(kpis: ReportKpi[]) {
  return [...kpis]
    .filter((kpi) => kpi.deltaPercent != null)
    .sort((left, right) => (left.deltaPercent ?? 0) - (right.deltaPercent ?? 0))[0] ?? null;
}

function pickPeakPoint(series: ReportTimeSeriesPoint[], key: keyof ReportTimeSeriesPoint) {
  return [...series].sort((left, right) => Number(right[key]) - Number(left[key]))[0] ?? null;
}

function getActiveFilterCount(payload: ReportPayload) {
  let count = 0;

  if (payload.query.platformIntegrationId) {
    count += 1;
  }

  if (payload.query.adAccountIds.length > 0) {
    count += 1;
  }

  if (payload.query.campaignIds.length > 0) {
    count += 1;
  }

  if (payload.query.adsetIds.length > 0) {
    count += 1;
  }

  if (payload.query.adIds.length > 0) {
    count += 1;
  }

  return count;
}

function deriveInsight(payload: ReportPayload): ReportInsight {
  const strongestRow = pickStrongestRow(payload.breakdown.rows);
  const weakestRow = pickWeakestRow(payload.breakdown.rows);
  const positiveKpi = pickPositiveKpi(payload.kpis);
  const negativeKpi = pickNegativeKpi(payload.kpis);
  const peakResultsPoint = pickPeakPoint(payload.series, 'conversion');
  const peakSpendPoint = pickPeakPoint(payload.series, 'spend');
  const entityLabel = strongestRow ? getEntityLabel(strongestRow.level) : payload.meta.scopeLabel;

  const strongestLabel = strongestRow
    ? `Strongest ${entityLabel.toLowerCase()}`
    : `Strongest ${payload.meta.scopeLabel.toLowerCase()}`;
  const strongestDetail = strongestRow
    ? `${strongestRow.name} is leading with ${formatEntityPerformance(
        strongestRow,
        payload.meta.currencyCode
      )}.`
    : 'There is not enough breakdown data yet to name a clear winner.';

  const weakestLabel = weakestRow
    ? `Needs attention: ${weakestRow.name}`
    : 'Needs attention';
  const weakestDetail = weakestRow
    ? weakestRow.conversion > 0
      ? `${weakestRow.name} is the weakest current mover with ${formatCurrency(
          weakestRow.costPerResult,
          payload.meta.currencyCode,
          2
        )} cost per result and ${weakestRow.ctr.toFixed(2)}% CTR.`
      : `${weakestRow.name} has already spent ${formatCurrency(
          weakestRow.spend,
          payload.meta.currencyCode,
          2
        )} without a recorded result.`
    : 'No weak entity stands out yet.';

  const momentumLabel = positiveKpi
    ? `${positiveKpi.label} ${positiveKpi.deltaPercent && positiveKpi.deltaPercent >= 0 ? 'improved' : 'changed'}`
    : 'Trend signal';
  const momentumDetail = positiveKpi
    ? `${positiveKpi.label} moved ${formatSignedPercent(positiveKpi.deltaPercent)} compared with the previous period.`
    : peakResultsPoint
      ? `Peak results landed around ${peakResultsPoint.label}.`
      : 'Comparison signals will appear when more reporting history is available.';

  let recommendationLabel = 'Recommended next move';
  let recommendationDetail = 'Keep monitoring the current mix until clearer movement appears.';

  if (strongestRow && weakestRow && strongestRow.id !== weakestRow.id) {
    recommendationLabel = `Shift attention toward ${strongestRow.name}`;
    recommendationDetail =
      weakestRow.conversion === 0
        ? `Keep leaning into ${strongestRow.name} while reworking or pausing ${weakestRow.name} before it absorbs more spend.`
        : `Use ${strongestRow.name} as the benchmark and review why ${weakestRow.name} is lagging on cost per result and click-through rate.`;
  } else if (negativeKpi?.key === 'ctr') {
    recommendationDetail =
      'Click-through rate is the clearest drag right now. Refresh creative or messaging before adding more budget.';
  } else if (negativeKpi?.key === 'costPerResult') {
    recommendationDetail =
      'Cost per result is slipping. Tighten targeting and pause the weakest segments before scaling.';
  } else if (strongestRow) {
    recommendationDetail = `Keep building around ${strongestRow.name} while you watch for fatigue across the rest of the mix.`;
  }

  const summaryParts = [
    strongestRow
      ? `${strongestRow.name} is currently the clearest performer, producing ${formatEntityPerformance(
          strongestRow,
          payload.meta.currencyCode
        )}.`
      : `${payload.meta.title} does not have enough entity-level activity yet to name a clear winner.`,
    weakestRow
      ? weakestRow.conversion > 0
        ? `${weakestRow.name} is the soft spot with ${formatCurrency(
            weakestRow.costPerResult,
            payload.meta.currencyCode,
            2
          )} cost per result.`
        : `${weakestRow.name} is spending without converting.`
      : null,
    peakResultsPoint
      ? `The strongest results point landed around ${peakResultsPoint.label}.`
      : peakSpendPoint
        ? `Spend peaked around ${peakSpendPoint.label}.`
        : null,
  ].filter(Boolean);

  const worked = [
    strongestRow
      ? `${strongestRow.name} is setting the pace with ${formatEntityPerformance(
          strongestRow,
          payload.meta.currencyCode
        )}.`
      : null,
    positiveKpi
      ? `${positiveKpi.label} moved ${formatSignedPercent(positiveKpi.deltaPercent)} versus the previous period.`
      : null,
    peakResultsPoint
      ? `${formatDateLabel(peakResultsPoint.startDate)} was the strongest point for results in this range.`
      : null,
  ].filter((item): item is string => Boolean(item));

  const watch = [
    weakestRow
      ? weakestRow.conversion > 0
        ? `${weakestRow.name} is underperforming relative to the rest of the mix.`
        : `${weakestRow.name} has spend with no recorded result yet.`
      : null,
    negativeKpi
      ? `${negativeKpi.label} moved ${formatSignedPercent(negativeKpi.deltaPercent)} and is the clearest negative trend.`
      : null,
    peakSpendPoint && peakResultsPoint && peakSpendPoint.key !== peakResultsPoint.key
      ? `Spend peaked around ${peakSpendPoint.label}, but results peaked at a different time.`
      : null,
  ].filter((item): item is string => Boolean(item));

  const nextMoves = [
    recommendationDetail,
    strongestRow && weakestRow && strongestRow.id !== weakestRow.id
      ? `Compare ${strongestRow.name} and ${weakestRow.name} before approving the next queue items in Calendar.`
      : null,
    payload.query.compareMode === 'none'
      ? 'Turn on previous-period comparison when you want a clearer trend read.'
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    summary: summaryParts.join(' '),
    strongestLabel,
    strongestDetail,
    weakestLabel,
    weakestDetail,
    momentumLabel,
    momentumDetail,
    recommendationLabel,
    recommendationDetail,
    worked,
    watch,
    nextMoves,
  };
}

function KpiCard({ kpi }: { kpi: ReportKpi }) {
  const deltaClass =
    kpi.deltaPercent == null
      ? classes.deltaNeutral
      : kpi.deltaPercent >= 0
        ? classes.deltaPositive
        : classes.deltaNegative;
  const DeltaIcon =
    kpi.deltaPercent == null ? IconTimeline : kpi.deltaPercent >= 0 ? IconArrowUpRight : IconArrowDownRight;

  return (
    <Paper withBorder radius="xl" p="md" className={classes.kpiCard}>
      <Stack gap="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
          {kpi.label}
        </Text>
        <Text fw={900} size="1.75rem" className={classes.kpiValue}>
          {kpi.formattedValue}
        </Text>
        <span className={`${classes.deltaPill} ${deltaClass}`}>
          <DeltaIcon size={13} />
          {formatSignedPercent(kpi.deltaPercent)}
        </span>
      </Stack>
    </Paper>
  );
}

function MoverList({
  title,
  subtitle,
  rows,
  tone,
  currencyCode,
}: {
  title: string;
  subtitle: string;
  rows: ReportBreakdownRow[];
  tone: 'good' | 'warning';
  currencyCode: string | null;
}) {
  const color = tone === 'good' ? 'teal' : 'orange';

  return (
    <Paper withBorder radius="xl" p="md" className={classes.reportCard}>
      <Group gap="sm" mb="md" className={classes.cardHeader}>
        <ThemeIcon variant="light" color={color} radius="md">
          {tone === 'good' ? <IconArrowUpRight size={18} /> : <IconTrendingDown size={18} />}
        </ThemeIcon>
        <div>
          <Text fw={800}>{title}</Text>
          <Text size="sm" c="dimmed">
            {subtitle}
          </Text>
        </div>
      </Group>
      <Stack gap="sm">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.id} className={classes.moverRow}>
              <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={800} lineClamp={1}>
                    {row.name}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    {tone === 'good'
                      ? formatEntityPerformance(row, currencyCode)
                      : row.conversion > 0
                        ? `${formatCurrency(row.costPerResult, currencyCode, 2)} cost per result · ${row.ctr.toFixed(2)}% CTR`
                        : `${formatCurrency(row.spend, currencyCode, 2)} spent without a recorded result`}
                  </Text>
                </div>
                <Badge color={color} variant="light" radius="sm">
                  {getEntityLabel(row.level)}
                </Badge>
              </Group>
            </div>
          ))
        ) : (
          <Text size="sm" c="dimmed">
            No entity breakdown is available for the current filters.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function StaticSignalRow({
  label,
  note,
  share,
  score,
  color,
}: {
  label: string;
  note: string;
  share: string;
  score: number;
  color: string;
}) {
  return (
    <div className={classes.signalRow}>
      <Group justify="space-between" gap="md" wrap="nowrap">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text fw={800} lineClamp={1}>
            {label}
          </Text>
          <Text size="sm" c="dimmed" mt={4} lineClamp={1}>
            {note}
          </Text>
        </div>
        <Text size="xs" fw={800} c="dimmed">
          {share}
        </Text>
      </Group>
      <Progress value={score} color={color} radius="xl" size="sm" mt="sm" />
    </div>
  );
}

function TimelineSnapshotCard({
  label,
  headline,
  detail,
  tone = 'neutral',
}: {
  label: string;
  headline: string;
  detail: string;
  tone?: 'positive' | 'warning' | 'neutral';
}) {
  const Icon =
    tone === 'positive'
      ? IconArrowUpRight
      : tone === 'warning'
        ? IconTrendingDown
        : IconTimeline;
  const color = tone === 'positive' ? 'teal' : tone === 'warning' ? 'orange' : 'blue';

  return (
    <Paper withBorder radius="lg" p="md" className={classes.timelineSnapshotCard}>
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <ThemeIcon color={color} variant="light" radius="md">
          <Icon size={17} />
        </ThemeIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
            {label}
          </Text>
          <Text fw={800} mt={6}>
            {headline}
          </Text>
          <Text size="sm" c="dimmed" mt={6}>
            {detail}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}

export function ReportsClient({ payload, filterOptions, isDemo = false }: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [filtersOpened, setFiltersOpened] = useState(false);
  const [reviveModalOpened, setReviveModalOpened] = useState(false);
  const [revivePromptDismissed, setRevivePromptDismissed] = useState(false);

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
    const nextParams = new URLSearchParams(currentSearchString);

    if (isDemo) {
      nextParams.set('demo', '1');
    }

    const query = nextParams.toString() ? `?${nextParams.toString()}` : '';

    return {
      pdf: `/api/reports/pdf${query}`,
      csv: `/api/reports/csv${query}`,
    };
  }, [currentSearchString, isDemo]);

  const storyData = useMemo(
    () =>
      payload.series.map((point) => ({
        label: point.label,
        Spend: Number(point.spend.toFixed(2)),
        Results: point.conversion,
        Clicks: point.clicks,
      })),
    [payload.series]
  );
  const efficiencyTrendData = useMemo(
    () =>
      payload.series.map((point) => ({
        label: point.label,
        CTR: Number(point.ctr.toFixed(2)),
        'Conversion rate': Number(point.conversionRate.toFixed(2)),
        Frequency: Number(point.frequency.toFixed(2)),
      })),
    [payload.series]
  );

  const insight = useMemo(() => deriveInsight(payload), [payload]);
  const activeFilterCount = useMemo(() => getActiveFilterCount(payload), [payload]);
  const strongestRows = useMemo(
    () => [...payload.breakdown.rows].sort((left, right) => scoreStrongestRow(right) - scoreStrongestRow(left)).slice(0, 4),
    [payload.breakdown.rows]
  );
  const weakestRows = useMemo(
    () => [...payload.breakdown.rows].sort((left, right) => scoreWeakestRow(right) - scoreWeakestRow(left)).slice(0, 4),
    [payload.breakdown.rows]
  );
  const visibleFilterSummary = useMemo(
    () =>
      payload.export.filterSummary.filter((item) => {
        if (item.label === 'Date range') {
          return true;
        }

        if (item.label === 'Compare' && item.value === 'None') {
          return false;
        }

        return !item.value.startsWith('All ');
      }),
    [payload.export.filterSummary]
  );
  const reviveDismissKey = payload.meta.reviveOpportunity
    ? `revive-prompt:${payload.meta.reviveOpportunity.adAccountId}:${payload.meta.reviveOpportunity.sourceAssessmentDigestHash}`
    : null;

  const hasTrendData = storyData.length > 0;
  const hasEfficiencyTrendData = efficiencyTrendData.length > 0;
  const peakResultsPoint = useMemo(
    () => pickPeakPoint(payload.series, 'conversion'),
    [payload.series]
  );
  const peakSpendPoint = useMemo(() => pickPeakPoint(payload.series, 'spend'), [payload.series]);
  const peakCtrPoint = useMemo(() => pickPeakPoint(payload.series, 'ctr'), [payload.series]);
  const strongestEntity = strongestRows[0] ?? null;

  useEffect(() => {
    if (!payload.meta.reviveOpportunity || !reviveDismissKey) {
      setReviveModalOpened(false);
      setRevivePromptDismissed(false);
      return;
    }

    try {
      const isDismissed = window.localStorage.getItem(reviveDismissKey) === '1';
      setRevivePromptDismissed(isDismissed);
      setReviveModalOpened(!isDismissed);
    } catch {
      setRevivePromptDismissed(false);
      setReviveModalOpened(true);
    }
  }, [payload.meta.reviveOpportunity, reviveDismissKey]);

  const dismissReviveModal = () => {
    if (reviveDismissKey) {
      try {
        window.localStorage.setItem(reviveDismissKey, '1');
      } catch {
        // Ignore localStorage failures and keep the reports view responsive.
      }
    }

    setRevivePromptDismissed(true);
    setReviveModalOpened(false);
  };

  return (
    <Container fluid px={6} py={0} className={`${classes.page} reports-page-shell`}>
      <Drawer
        opened={filtersOpened}
        onClose={() => setFiltersOpened(false)}
        title="Report filters"
        position="right"
        size="md"
      >
        <ReportsSidebar
          query={payload.query}
          filterOptions={filterOptions}
          onUpdate={(mutate) => {
            setFiltersOpened(false);
            updateSearch(mutate);
          }}
        />
      </Drawer>

      <Stack gap="md" className={classes.shell}>
        <ReportsHeader
          payload={payload}
          exportLinks={exportLinks}
          onUpdate={updateSearch}
          onOpenFilters={() => setFiltersOpened(true)}
          activeFilterCount={activeFilterCount}
          isDemo={isDemo}
          isPending={isPending}
        />

        {payload.meta.syncCoverage?.historicalAnalysisPending ? (
          <Paper
            radius="xl"
            p="md"
            bg="rgba(59,130,246,0.08)"
            style={{ border: '1px solid rgba(59,130,246,0.16)' }}
          >
            <Group justify="space-between" align="flex-start" gap="md">
              <div>
                <Text fw={800}>Recent coverage is ready while full history sync continues</Text>
                <Text size="sm" c="dimmed" mt={4}>
                  {payload.meta.syncCoverage.coverageStartDate &&
                  payload.meta.syncCoverage.coverageEndDate
                    ? `This report currently reflects synced data from ${payload.meta.syncCoverage.coverageStartDate} through ${payload.meta.syncCoverage.coverageEndDate}.`
                    : 'DeepVisor is still expanding the history window for this selected ad account.'}
                </Text>
              </div>
              <Badge color="blue" variant="light">
                {payload.meta.syncCoverage.activeJobStatus ?? 'pending'}
              </Badge>
            </Group>
          </Paper>
        ) : null}

        {payload.meta.reviveOpportunity && !revivePromptDismissed ? (
          <ReviveCampaignPrompt
            opportunity={payload.meta.reviveOpportunity}
            variant="card"
            onDismiss={dismissReviveModal}
          />
        ) : null}

        {isPending && (
          <Card withBorder radius="lg" p="sm">
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Updating report…
              </Text>
            </Group>
          </Card>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {payload.kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </SimpleGrid>

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, xl: 8 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.reportCard}>
              <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.cardHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Timeline
                  </Text>
                  <Text fw={900} size="xl" mt={4}>
                    Performance over time
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Spend, results, and clicks in the selected reporting window.
                  </Text>
                </div>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" color="gray" radius="sm">
                    Grouped by {payload.query.groupBy}
                  </Badge>
                  <Badge variant="light" color={payload.query.compareMode === 'previous_period' ? 'teal' : 'gray'} radius="sm">
                    {payload.query.compareMode === 'previous_period' ? 'Previous period on' : 'No comparison'}
                  </Badge>
                </Group>
              </Group>

              <div className={classes.chartWrap}>
                {hasTrendData ? (
                  <LineChart
                    h={340}
                    data={storyData}
                    dataKey="label"
                    series={[
                      { name: 'Spend', color: 'blue.6' },
                      { name: 'Results', color: 'teal.6' },
                      { name: 'Clicks', color: 'orange.6' },
                    ]}
                    curveType="linear"
                    withLegend
                    valueFormatter={(value) => value.toLocaleString()}
                  />
                ) : (
                  <Stack justify="center" align="center" h={340} gap="xs">
                    <Text fw={800}>No time-series trend available yet</Text>
                    <Text size="sm" c="dimmed" ta="center" maw={360}>
                      Breakdown data is still shown below, so you can still see which entities are carrying the report.
                    </Text>
                  </Stack>
                )}
              </div>

              <Paper withBorder radius="lg" p="md" className={classes.supportingChartBlock}>
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="md">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                      Quality trend
                    </Text>
                    <Text fw={800} mt={4}>
                      CTR, conversion rate, and frequency over time
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      This makes it easier to spot fatigue, weaker traffic quality, or periods where
                      delivery improved without simply spending more.
                    </Text>
                  </div>
                  <Badge variant="light" color="gray" radius="sm">
                    Efficiency read
                  </Badge>
                </Group>

                <div className={classes.supportingChartWrap}>
                  {hasEfficiencyTrendData ? (
                    <LineChart
                      h={220}
                      data={efficiencyTrendData}
                      dataKey="label"
                      series={[
                        { name: 'CTR', color: 'violet.6' },
                        { name: 'Conversion rate', color: 'teal.6' },
                        { name: 'Frequency', color: 'orange.6' },
                      ]}
                      curveType="linear"
                      withLegend
                      valueFormatter={(value) => Number(value).toFixed(2)}
                    />
                  ) : (
                    <Stack justify="center" align="center" h={220} gap="xs">
                      <Text fw={800}>No efficiency trend available yet</Text>
                      <Text size="sm" c="dimmed" ta="center" maw={360}>
                        Once more time-series points are available, DeepVisor will show how traffic
                        quality changed across the selected period.
                      </Text>
                    </Stack>
                  )}
                </div>
              </Paper>

              <Paper withBorder radius="lg" p="md" className={classes.insightBlock}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                  Report read
                </Text>
                <Text size="sm" mt={6}>
                  {insight.summary}
                </Text>
              </Paper>

              <div className={classes.timelineSnapshotGrid}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TimelineSnapshotCard
                    label="Peak results"
                    headline={
                      peakResultsPoint
                        ? `${peakResultsPoint.conversion.toLocaleString()} results`
                        : 'No clear peak yet'
                    }
                    detail={
                      peakResultsPoint
                        ? `${peakResultsPoint.label} delivered the strongest results window in this range.`
                        : 'More performance points are needed before DeepVisor can identify the strongest results window.'
                    }
                    tone="positive"
                  />
                  <TimelineSnapshotCard
                    label="Spend peak"
                    headline={
                      peakSpendPoint
                        ? formatCurrency(peakSpendPoint.spend, payload.meta.currencyCode, 2)
                        : 'No spend peak yet'
                    }
                    detail={
                      peakSpendPoint
                        ? `${peakSpendPoint.label} carried the heaviest spend load across the selected period.`
                        : 'Spend landmarks will appear once there is enough delivery history in the selected range.'
                    }
                  />
                  <TimelineSnapshotCard
                    label="Best traffic quality"
                    headline={
                      peakCtrPoint ? `${peakCtrPoint.ctr.toFixed(2)}% CTR` : 'CTR not available yet'
                    }
                    detail={
                      peakCtrPoint
                        ? `${peakCtrPoint.label} combined the highest click-through rate with ${peakCtrPoint.conversionRate.toFixed(2)}% conversion rate.`
                        : 'Traffic-quality markers will show up once DeepVisor has enough time-series points.'
                    }
                    tone="positive"
                  />
                  <TimelineSnapshotCard
                    label="Leading entity"
                    headline={strongestEntity?.name ?? 'No leading entity yet'}
                    detail={
                      strongestEntity
                        ? `${formatEntityPerformance(strongestEntity, payload.meta.currencyCode)} in the current ${payload.meta.scopeLabel.toLowerCase()} scope.`
                        : 'Entity leadership will appear once there is enough breakdown activity in the selected range.'
                    }
                    tone={strongestEntity ? 'positive' : 'neutral'}
                  />
                </SimpleGrid>
              </div>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.reportCard}>
              <Stack gap="md" h="100%">
                <Group justify="space-between" align="flex-start" gap="md" className={classes.cardHeader}>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                      Static breakdown
                    </Text>
                    <Text fw={900} size="xl" mt={4}>
                      Audience and channel mix
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      Placeholder segmentation until live audience and placement reporting is wired in.
                    </Text>
                  </div>
                  <Badge color="violet" variant="light" radius="sm">
                    Static preview
                  </Badge>
                </Group>

                <Paper withBorder radius="lg" p="md" className={classes.insightBlock}>
                  <Group gap="sm" mb="md" wrap="nowrap">
                    <ThemeIcon color="blue" variant="light" radius="md">
                      <IconTimeline size={18} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                        Audience type
                      </Text>
                      <Text fw={800}>Projected audience share</Text>
                    </div>
                  </Group>
                  <div className={classes.miniChartWrap}>
                    <BarChart
                      h={220}
                      data={staticAudienceMix}
                      dataKey="audience"
                      series={[{ name: 'Share', color: 'blue.6' }]}
                      tickLine="y"
                      withLegend={false}
                      valueFormatter={(value) => `${value}%`}
                    />
                  </div>
                </Paper>

                <Paper withBorder radius="lg" p="md" className={classes.insightBlock}>
                  <Group gap="sm" mb="md" wrap="nowrap">
                    <ThemeIcon color="teal" variant="light" radius="md">
                      <IconTrendingUp size={18} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                        Social signal
                      </Text>
                      <Text fw={800}>What social surfaces look strongest</Text>
                    </div>
                  </Group>
                  <Stack gap="sm">
                    {staticChannelSignals.map((signal) => (
                      <StaticSignalRow
                        key={signal.label}
                        label={signal.label}
                        note={signal.note}
                        share={signal.share}
                        score={signal.score}
                        color={signal.color}
                      />
                    ))}
                  </Stack>
                </Paper>

                <Paper withBorder radius="lg" p="md" className={classes.insightBlock}>
                  <Text size="sm" c="dimmed">
                    Narrative reads like “What matters right now?” now live in the Ask DeepVisor quick prompts so
                    reports can stay focused on charts and tables.
                  </Text>
                </Paper>

                {isDemo ? (
                  <Paper withBorder radius="lg" p="md" className={classes.insightBlock}>
                    <Text size="sm" c="dimmed">
                      This preview uses static audience and placement examples for now. The live version will swap in
                      real segment and channel performance once those rollups are connected.
                    </Text>
                  </Paper>
                ) : null}

                <Button
                  component={Link}
                  href="/calendar"
                  radius="xl"
                  variant="light"
                  color="blue"
                  leftSection={<IconProgressCheck size={16} />}
                  mt="auto"
                >
                  Open Calendar Queue
                </Button>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, xl: 6 }}>
            <MoverList
              title="Carrying the report"
              subtitle="Highest-performing entities in the current scope"
              rows={strongestRows}
              tone="good"
              currencyCode={payload.meta.currencyCode}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xl: 6 }}>
            <MoverList
              title="Slowing things down"
              subtitle="Weak spots that need review before more budget is committed"
              rows={weakestRows}
              tone="warning"
              currencyCode={payload.meta.currencyCode}
            />
          </Grid.Col>
        </Grid>

        <Card withBorder radius="xl" p="lg" className={`${classes.reportCard} ${classes.tableCard}`}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.cardHeader}>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                  Performance table
                </Text>
                <Text fw={900} size="xl" mt={4}>
                  {payload.breakdown.title}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  Full row-level view for campaigns, ad sets, or ads in the current filters.
                </Text>
              </div>
              <Group gap="xs" wrap="wrap">
                {visibleFilterSummary.map((item) => (
                  <Badge key={`${item.label}:${item.value}`} variant="light" color="gray" radius="sm">
                    {item.label}: {item.value}
                  </Badge>
                ))}
              </Group>
            </Group>

            <PerformanceTable
              title={payload.breakdown.title}
              rows={payload.breakdown.rows}
              currencyCode={payload.meta.currencyCode}
              hideTitle
            />
          </Stack>
        </Card>
      </Stack>

      {payload.meta.reviveOpportunity && !revivePromptDismissed ? (
        <ReviveCampaignPrompt
          opportunity={payload.meta.reviveOpportunity}
          variant="modal"
          opened={reviveModalOpened}
          onDismiss={dismissReviveModal}
        />
      ) : null}
    </Container>
  );
}
