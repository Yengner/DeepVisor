'use client';

import '@mantine/charts/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { BarChart, LineChart } from '@mantine/charts';
import {
  Accordion,
  Badge,
  Button,
  Card,
  Container,
  Drawer,
  Grid,
  Group,
  Loader,
  Modal,
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
  IconChevronRight,
  IconProgressCheck,
  IconTimeline,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { buildReportUrl, CHART_METRIC_COLORS, formatChartDateLabel } from '@/lib/shared';
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

function getEntityPluralLabel(level: ReportBreakdownRow['level']) {
  if (level === 'campaign') {
    return 'Campaigns';
  }

  if (level === 'adset') {
    return 'Ad sets';
  }

  return 'Ads';
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

function scoreRankedRow(row: ReportBreakdownRow) {
  return scoreStrongestRow(row);
}

function dedupeRows(rows: ReportBreakdownRow[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function rankBreakdownRows(rows: ReportBreakdownRow[]) {
  return dedupeRows(rows)
    .filter((row) => row.spend > 0 || row.conversion > 0 || row.clicks > 0)
    .sort((left, right) => scoreRankedRow(right) - scoreRankedRow(left));
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

type ReportBreadcrumbItem = {
  label: string;
  href: string | null;
};

function findFilterLabel(
  options: Array<{ id: string; label: string }>,
  id: string | null | undefined,
  fallback: string
) {
  if (!id) {
    return fallback;
  }

  return options.find((option) => option.id === id)?.label ?? fallback;
}

function buildReportBreadcrumbs(
  payload: ReportPayload,
  filterOptions: ReportFilterOptions
): ReportBreadcrumbItem[] {
  const items: ReportBreadcrumbItem[] = [];
  const { query } = payload;

  if (query.platformIntegrationId) {
    items.push({
      label: findFilterLabel(filterOptions.platforms, query.platformIntegrationId, 'Platform'),
      href:
        query.adAccountIds.length > 0 ||
        query.campaignIds.length > 0 ||
        query.adsetIds.length > 0 ||
        query.adIds.length > 0
          ? buildReportUrl({
              scope: 'platform',
              platformIntegrationId: query.platformIntegrationId,
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
            })
          : null,
    });
  }

  if (query.adAccountIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.adAccounts, query.adAccountIds[0], 'Ad account'),
      href:
        query.campaignIds.length > 0 || query.adsetIds.length > 0 || query.adIds.length > 0
          ? buildReportUrl({
              scope: 'ad_account',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: [query.adAccountIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
            })
          : null,
    });
  }

  if (query.campaignIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.campaigns, query.campaignIds[0], 'Campaign'),
      href:
        query.adsetIds.length > 0 || query.adIds.length > 0
          ? buildReportUrl({
              scope: 'campaign',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: query.adAccountIds,
              campaignIds: [query.campaignIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
            })
          : null,
    });
  }

  if (query.adsetIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.adsets, query.adsetIds[0], 'Ad set'),
      href:
        query.adIds.length > 0
          ? buildReportUrl({
              scope: 'adset',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: query.adAccountIds,
              campaignIds: query.campaignIds,
              adsetIds: [query.adsetIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
            })
          : null,
    });
  }

  if (query.adIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.ads, query.adIds[0], 'Ad'),
      href: null,
    });
  }

  return items;
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

function getRankTone(index: number, total: number) {
  if (index === 0) {
    return { color: 'teal', label: 'Top performer' };
  }

  if (index <= Math.max(1, Math.floor(total * 0.25))) {
    return { color: 'blue', label: 'Leading' };
  }

  if (index >= Math.max(0, total - Math.max(1, Math.floor(total * 0.25)))) {
    return { color: 'orange', label: 'Needs review' };
  }

  return { color: 'gray', label: 'Mid-pack' };
}

type RankingSection = {
  title: string;
  rows: ReportBreakdownRow[];
};

type RankingGroup = {
  key: ReportBreakdownRow['level'];
  level: ReportBreakdownRow['level'];
  title: string;
  sections: RankingSection[];
  fullRows: ReportBreakdownRow[];
};

function getFullRankingTitle(level: ReportBreakdownRow['level']) {
  return `Full ${getEntityLabel(level).toLowerCase()} ranking`;
}

function getAccountRankingTitle(
  level: ReportBreakdownRow['level'],
  query: ReportPayload['query']
) {
  const accountLabel = query.adAccountIds.length === 1 ? 'this ad account' : 'selected accounts';
  return `Best ${getEntityPluralLabel(level).toLowerCase()} in ${accountLabel}`;
}

function getParentRankingTitle(
  level: ReportBreakdownRow['level'],
  query: ReportPayload['query']
) {
  if (level === 'adset') {
    const parentLabel = query.campaignIds.length > 1 ? 'these campaigns' : 'this campaign';
    return `Ad sets in ${parentLabel} ranking`;
  }

  if (level === 'ad') {
    const parentLabel = query.adsetIds.length > 1 ? 'these ad sets' : 'this ad set';
    return `Ads in ${parentLabel} ranking`;
  }

  return 'Campaign ranking';
}

function getRankingLevelOrder(level: ReportBreakdownRow['level']) {
  if (level === 'campaign') {
    return 0;
  }

  if (level === 'adset') {
    return 1;
  }

  return 2;
}

function shouldCollapseParentRankingGroup(
  groupLevel: ReportBreakdownRow['level'],
  currentLevel: ReportBreakdownRow['level'] | null
) {
  if (!currentLevel) {
    return false;
  }

  const currentLevelOrder = getRankingLevelOrder(currentLevel);
  if (currentLevelOrder === 0) {
    return false;
  }

  return getRankingLevelOrder(groupLevel) < currentLevelOrder;
}

function buildRankingGroup(input: {
  level: ReportBreakdownRow['level'];
  primaryTitle: string;
  primaryRows: ReportBreakdownRow[];
  comparisonTitle?: string;
  comparisonRows?: ReportBreakdownRow[];
}): RankingGroup | null {
  const primaryRows = input.primaryRows;
  const comparisonSourceRows = input.comparisonRows ?? [];
  const primaryIds = new Set(primaryRows.map((row) => row.id));
  const comparisonRows = comparisonSourceRows.filter((row) => !primaryIds.has(row.id));
  const sections: RankingSection[] = [];
  const fullRows = comparisonSourceRows.length > 0 ? comparisonSourceRows : primaryRows;

  if (primaryRows.length > 0) {
    sections.push({
      title: input.primaryTitle,
      rows: primaryRows,
    });
  }

  if (comparisonRows.length > 0 && input.comparisonTitle) {
    sections.push({
      title: input.comparisonTitle,
      rows: comparisonRows,
    });
  }

  if (sections.length === 0 || fullRows.length === 0) {
    return null;
  }

  return {
    key: input.level,
    level: input.level,
    title: `${getEntityLabel(input.level)} ranking`,
    sections,
    fullRows,
  };
}

function RankedEntityBoard({
  rows,
  currencyCode,
  ranking,
  query,
}: {
  rows: ReportBreakdownRow[];
  currencyCode: string | null;
  ranking: ReportPayload['ranking'];
  query: ReportPayload['query'];
}) {
  const [openedRankingKey, setOpenedRankingKey] = useState<ReportBreakdownRow['level'] | null>(null);
  const [openedCollapsedRankingKeys, setOpenedCollapsedRankingKeys] = useState<
    ReportBreakdownRow['level'][]
  >([]);
  const rankedRows = rankBreakdownRows(rows);
  const currentLevel = rankedRows[0]?.level ?? null;
  const campaignRows = rankBreakdownRows(
    currentLevel === 'campaign' ? rankedRows : ranking.topAdAccountCampaigns
  );
  const adsetPrimaryRows = rankBreakdownRows(
    currentLevel === 'adset' ? rankedRows : ranking.sameCampaignAdsets
  );
  const adsetComparisonRows = rankBreakdownRows(ranking.topAdAccountAdsets);
  const adPrimaryRows = rankBreakdownRows(
    currentLevel === 'ad' ? rankedRows : ranking.sameAdsetAds
  );
  const adComparisonRows = rankBreakdownRows(ranking.topAdAccountAds);
  const rankingGroups = [
    buildRankingGroup({
      level: 'campaign',
      primaryTitle: currentLevel === 'campaign' ? 'Ranked campaigns' : getAccountRankingTitle('campaign', query),
      primaryRows: campaignRows,
    }),
    buildRankingGroup({
      level: 'adset',
      primaryTitle: getParentRankingTitle('adset', query),
      primaryRows: adsetPrimaryRows,
      comparisonTitle: getAccountRankingTitle('adset', query),
      comparisonRows: adsetComparisonRows,
    }),
    buildRankingGroup({
      level: 'ad',
      primaryTitle: getParentRankingTitle('ad', query),
      primaryRows: adPrimaryRows,
      comparisonTitle: getAccountRankingTitle('ad', query),
      comparisonRows: adComparisonRows,
    }),
  ].filter((group): group is RankingGroup => Boolean(group));
  const activeRankingGroup =
    rankingGroups.find((group) => group.key === openedRankingKey) ?? null;
  const collapsedRankingGroups = rankingGroups.filter((group) =>
    shouldCollapseParentRankingGroup(group.level, currentLevel)
  );
  const visibleRankingGroups = rankingGroups.filter(
    (group) => !shouldCollapseParentRankingGroup(group.level, currentLevel)
  );

  useEffect(() => {
    setOpenedCollapsedRankingKeys([]);
  }, [currentLevel, rankingGroups.map((group) => group.key).join('|')]);

  const renderRankedRows = (inputRows: ReportBreakdownRow[]) =>
    inputRows.slice(0, 4).map((row, index) => {
      const tone = getRankTone(index, inputRows.length);

      return (
        <div key={`${row.level}:${row.id}`} className={classes.moverRow}>
          <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Group gap={8} wrap="wrap">
                <Badge color={tone.color} variant="light" radius="sm">
                  #{index + 1}
                </Badge>
                <Text fw={800} lineClamp={1}>
                  {row.name}
                </Text>
              </Group>
              <Text size="sm" c="dimmed" mt={6}>
                {formatEntityPerformance(row, currencyCode)}
              </Text>
              <Text size="xs" c="dimmed" mt={6} lineClamp={1}>
                {row.creativeContext
                  ? `Creative: ${row.creativeContext}`
                  : row.primaryContext || row.secondaryContext
                    ? [row.primaryContext, row.secondaryContext].filter(Boolean).join(' · ')
                    : 'No extra context yet'}
              </Text>
            </div>
            <Stack gap={6} align="flex-end">
              <Badge color={tone.color} variant="light" radius="sm">
                {tone.label}
              </Badge>
              <Badge color="gray" variant="light" radius="sm">
                {getEntityLabel(row.level)}
              </Badge>
              {row.drilldownHref ? (
                <Button
                  component={Link}
                  href={row.drilldownHref}
                  variant="subtle"
                  size="compact-xs"
                  radius="xl"
                >
                  {row.drilldownLabel ?? 'Open report'}
                </Button>
              ) : null}
            </Stack>
          </Group>
          <Group gap="xs" mt="sm" wrap="wrap">
            <Badge variant="outline" color="gray" radius="sm">
              {row.conversion.toLocaleString()} results
            </Badge>
            <Badge variant="outline" color="gray" radius="sm">
              {formatCurrency(row.costPerResult, currencyCode, 2)} / result
            </Badge>
            <Badge variant="outline" color="gray" radius="sm">
              {row.ctr.toFixed(2)}% CTR
            </Badge>
            <Badge variant="outline" color="gray" radius="sm">
              {formatCurrency(row.spend, currencyCode, 2)} spend
            </Badge>
          </Group>
        </div>
      );
    });

  const renderRankingGroupContent = (group: RankingGroup) => (
    <Stack gap="sm">
      {group.sections.map((section) => (
        <Stack key={`${group.key}:${section.title}`} gap="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
            {section.title}
          </Text>
          {renderRankedRows(section.rows)}
        </Stack>
      ))}
      <Group justify="flex-end">
        <Button
          variant="light"
          radius="xl"
          size="xs"
          onClick={() => setOpenedRankingKey(group.key)}
        >
          Open {getFullRankingTitle(group.level).toLowerCase()}
        </Button>
      </Group>
    </Stack>
  );

  return (
    <Paper withBorder radius="xl" p="md" className={classes.reportCard}>
      <Modal
        opened={Boolean(activeRankingGroup)}
        onClose={() => setOpenedRankingKey(null)}
        title={activeRankingGroup ? getFullRankingTitle(activeRankingGroup.level) : 'Full ranking'}
        size="90%"
        centered
      >
        {activeRankingGroup ? (
          <PerformanceTable
            title={getFullRankingTitle(activeRankingGroup.level)}
            rows={activeRankingGroup.fullRows}
            currencyCode={currencyCode}
            hideTitle
            showRanking
          />
        ) : null}
      </Modal>

      <Group gap="sm" mb="md" className={classes.cardHeader}>
        <ThemeIcon variant="light" color="blue" radius="md">
          <IconTimeline size={18} />
        </ThemeIcon>
        <div>
          <Text fw={800}>Performance ranking</Text>
          <Text size="sm" c="dimmed">
            Highest to lowest for campaigns, ad sets, and ads in the current filters.
          </Text>
        </div>
      </Group>
      <Stack gap="sm">
        {rankingGroups.length > 0 ? (
          <>
            {collapsedRankingGroups.length > 0 ? (
              <Accordion
                multiple
                radius="lg"
                variant="separated"
                value={openedCollapsedRankingKeys}
                onChange={(value) =>
                  setOpenedCollapsedRankingKeys(value as ReportBreakdownRow['level'][])
                }
                className={classes.rankingAccordion}
              >
                {collapsedRankingGroups.map((group) => (
                  <Accordion.Item
                    key={group.key}
                    value={group.key}
                    className={classes.rankingAccordionItem}
                  >
                    <Accordion.Control className={classes.rankingAccordionControl}>
                      <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                        <Text fw={800}>{group.title}</Text>
                        <Group gap="xs" wrap="wrap">
                          <Badge color="gray" variant="outline" radius="sm">
                            Previous level
                          </Badge>
                          <Badge color="gray" variant="light" radius="sm">
                            {group.fullRows.length.toLocaleString()} ranked
                          </Badge>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>{renderRankingGroupContent(group)}</Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            ) : null}

            {visibleRankingGroups.map((group) => (
              <Stack key={group.key} gap="sm">
                <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                  <Text fw={800}>{group.title}</Text>
                  <Badge color="gray" variant="light" radius="sm">
                    {group.fullRows.length.toLocaleString()} ranked
                  </Badge>
                </Group>
                {renderRankingGroupContent(group)}
              </Stack>
            ))}
          </>
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
        label: formatChartDateLabel(point.label),
        Spend: Number(point.spend.toFixed(2)),
        Results: point.conversion,
        Clicks: point.clicks,
      })),
    [payload.series]
  );
  const efficiencyTrendData = useMemo(
    () =>
      payload.series.map((point) => ({
        label: formatChartDateLabel(point.label),
        CTR: Number(point.ctr.toFixed(2)),
        CPC: Number(point.cpc.toFixed(2)),
        CPM: Number(point.cpm.toFixed(2)),
      })),
    [payload.series]
  );
  const reportTrendXAxisProps = useMemo(
    () => ({
      minTickGap: 20,
      tickMargin: 10,
      padding: {
        left: 18,
        right: 30,
      },
    }),
    []
  );
  const reportTrendChartProps = useMemo(
    () => ({
      margin: {
        top: 8,
        right: 32,
        bottom: 8,
        left: 8,
      },
    }),
    []
  );

  const activeFilterCount = useMemo(() => getActiveFilterCount(payload), [payload]);
  const strongestRows = useMemo(
    () => [...payload.breakdown.rows].sort((left, right) => scoreStrongestRow(right) - scoreStrongestRow(left)).slice(0, 4),
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
  const hasTrendData = storyData.length > 0;
  const hasEfficiencyTrendData = efficiencyTrendData.length > 0;
  const peakResultsPoint = useMemo(
    () => pickPeakPoint(payload.series, 'conversion'),
    [payload.series]
  );
  const peakSpendPoint = useMemo(() => pickPeakPoint(payload.series, 'spend'), [payload.series]);
  const peakCtrPoint = useMemo(() => pickPeakPoint(payload.series, 'ctr'), [payload.series]);
  const strongestEntity = strongestRows[0] ?? null;
  const breadcrumbs = useMemo(
    () => buildReportBreadcrumbs(payload, filterOptions),
    [filterOptions, payload]
  );

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

        {breadcrumbs.length > 0 ? (
          <Paper withBorder radius="xl" p="md" className={classes.breadcrumbCard}>
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                Report path
              </Text>
              {breadcrumbs.map((item, index) => (
                <Group key={`${item.label}:${index}`} gap="xs" wrap="nowrap">
                  {index > 0 ? <IconChevronRight size={14} color="#94a3b8" /> : null}
                  {item.href ? (
                    <Button
                      component={Link}
                      href={item.href}
                      variant="subtle"
                      size="compact-xs"
                      radius="xl"
                    >
                      {item.label}
                    </Button>
                  ) : (
                    <Badge color="blue" variant="light" radius="sm">
                      {item.label}
                    </Badge>
                  )}
                </Group>
              ))}
            </Group>
          </Paper>
        ) : null}

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
                    xAxisProps={reportTrendXAxisProps}
                    lineChartProps={reportTrendChartProps}
                    series={[
                      { name: 'Spend', color: CHART_METRIC_COLORS.spend },
                      { name: 'Results', color: CHART_METRIC_COLORS.results },
                      { name: 'Clicks', color: CHART_METRIC_COLORS.clicks },
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
                      CTR, CPC, and CPM over time
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      This makes it easier to spot weaker click quality, rising acquisition cost, or
                      periods where efficiency improved without simply spending more.
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
                      xAxisProps={reportTrendXAxisProps}
                      lineChartProps={reportTrendChartProps}
                      series={[
                        { name: 'CTR', color: CHART_METRIC_COLORS.ctr },
                        { name: 'CPC', color: CHART_METRIC_COLORS.cpc },
                        { name: 'CPM', color: CHART_METRIC_COLORS.cpm },
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

        <RankedEntityBoard
          rows={payload.breakdown.rows}
          currencyCode={payload.meta.currencyCode}
          ranking={payload.ranking}
          query={payload.query}
        />

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
    </Container>
  );
}
