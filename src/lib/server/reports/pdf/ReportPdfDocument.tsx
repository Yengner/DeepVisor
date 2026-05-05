import React from 'react';
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type {
  ReportBreakdownRow,
  ReportKpi,
  ReportMetricTotals,
  ReportPayload,
  ReportTimeSeriesPoint,
} from '../types';
import type {
  DashboardAudienceSlice,
  DashboardPlatformSlice,
} from '@/lib/server/dashboard/types';

const PAGE_PADDING = 30;
const COLORS = {
  ink: '#111827',
  muted: '#64748b',
  border: '#dbe3ef',
  panel: '#f8fafc',
  blue: '#2563eb',
};

type DataRow = {
  label: string;
  values: Array<string | number>;
  muted?: boolean;
  emphasis?: boolean;
};

const styles = StyleSheet.create({
  page: {
    padding: PAGE_PADDING,
    fontSize: 8.5,
    color: COLORS.ink,
    backgroundColor: '#ffffff',
  },
  coverPage: {
    padding: PAGE_PADDING,
    fontSize: 8.5,
    color: COLORS.ink,
    backgroundColor: '#f8fafc',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.muted,
    fontWeight: 700,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 800,
    marginTop: 4,
    color: COLORS.ink,
  },
  clientBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 8,
    fontWeight: 700,
  },
  subtleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    color: COLORS.muted,
    fontSize: 7.5,
    fontWeight: 700,
  },
  heroPanel: {
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#ffffff',
    marginBottom: 9,
  },
  reportTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 1.08,
    fontWeight: 800,
    color: COLORS.ink,
  },
  reportSubtitle: {
    marginTop: 6,
    fontSize: 9,
    lineHeight: 1.45,
    color: COLORS.muted,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 9,
  },
  filterBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    fontSize: 7.2,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: COLORS.ink,
  },
  sectionNote: {
    fontSize: 7.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    padding: 8,
  },
  intelligenceCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    padding: 10,
    marginBottom: 8,
  },
  intelligenceTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: COLORS.ink,
    marginBottom: 4,
  },
  intelligenceBody: {
    fontSize: 8.6,
    lineHeight: 1.32,
    color: '#334155',
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 3,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    marginTop: 4,
    backgroundColor: COLORS.blue,
  },
  bulletText: {
    flex: 1,
    fontSize: 7.8,
    lineHeight: 1.25,
    color: '#334155',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kpiCard: {
    width: '48.5%',
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#fbfdff',
  },
  kpiLabel: {
    fontSize: 7.3,
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 0,
    color: COLORS.ink,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 7,
    fontWeight: 700,
  },
  deltaPositive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  deltaNegative: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#eaf1fb',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e6edf5',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  labelCell: {
    width: '34%',
    paddingRight: 6,
  },
  valueCell: {
    flex: 1,
    textAlign: 'right',
    paddingLeft: 5,
  },
  nameCell: {
    width: '30%',
    paddingRight: 6,
  },
  contextCell: {
    width: '20%',
    paddingRight: 6,
  },
  windowCell: {
    width: '16%',
    paddingRight: 6,
  },
  metricCell: {
    width: '8.5%',
    textAlign: 'right',
  },
  tableHeadText: {
    fontSize: 6.8,
    fontWeight: 800,
    color: '#334155',
    textTransform: 'uppercase',
  },
  tableText: {
    fontSize: 7,
    color: COLORS.ink,
  },
  tableMuted: {
    fontSize: 6.9,
    color: COLORS.muted,
  },
  surfaceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  surfaceCard: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.panel,
    padding: 7,
    minHeight: 54,
  },
  surfaceLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: 'uppercase',
    fontWeight: 700,
    marginBottom: 4,
  },
  surfaceValue: {
    fontSize: 9,
    fontWeight: 800,
    color: COLORS.ink,
    marginBottom: 3,
  },
  surfaceMeta: {
    fontSize: 6.9,
    color: COLORS.muted,
    lineHeight: 1.2,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    color: COLORS.muted,
    fontSize: 7.2,
  },
});

function truncate(value: string | null | undefined, maxLength: number) {
  const text = value?.trim();
  if (!text) {
    return '—';
  }

  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;
}

function parseUtcDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined) {
  const date = parseUtcDate(value);
  if (!date) {
    return value ?? '—';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate && !endDate) {
    return '—';
  }

  if (!startDate || !endDate || startDate === endDate) {
    return formatDate(startDate ?? endDate);
  }

  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);

  if (!start || !end) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endYear = end.getUTCFullYear();

  if (sameMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${endYear}`;
  }

  if (sameYear) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`;
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value: number, currencyCode: string | null, digits = 2) {
  if (!currencyCode || currencyCode === 'MIXED') {
    return digits === 0 ? Math.round(value).toLocaleString() : value.toFixed(digits);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `$${(Number.isFinite(value) ? value : 0).toFixed(digits)}`;
  }
}

function formatCompactCurrency(value: number, currencyCode: string | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDelta(kpi: ReportKpi) {
  if (kpi.deltaPercent == null) {
    return '';
  }

  const rounded = Math.abs(kpi.deltaPercent).toFixed(1);
  return kpi.deltaPercent >= 0 ? `+${rounded}% vs previous` : `-${rounded}% vs previous`;
}

function getDeltaStyle(deltaPercent: number) {
  return deltaPercent >= 0
    ? [styles.deltaPill, styles.deltaPositive]
    : [styles.deltaPill, styles.deltaNegative];
}

function formatFilterValue(payload: ReportPayload, label: string, value: string) {
  if (label === 'Date range') {
    return formatDateRange(payload.query.dateFrom, payload.query.dateTo);
  }

  return value;
}

function getContextLabel(row: ReportBreakdownRow) {
  if (row.level === 'campaign') {
    return row.secondaryContext ? `Objective: ${row.secondaryContext}` : row.primaryContext;
  }

  if (row.level === 'adset') {
    return row.primaryContext ? `Campaign: ${row.primaryContext}` : row.secondaryContext;
  }

  if (row.creativeContext) {
    return `Creative: ${row.creativeContext}`;
  }

  return row.primaryContext ?? row.secondaryContext;
}

function getPerformanceLine(row: ReportBreakdownRow, currencyCode: string | null) {
  if (row.conversion > 0) {
    return `${row.conversion.toLocaleString()} results at ${formatCurrency(row.costPerResult, currencyCode)} per result`;
  }

  return `${formatCurrency(row.spend, currencyCode)} spend with ${row.clicks.toLocaleString()} clicks`;
}

function rankRows(rows: ReportBreakdownRow[]) {
  return [...rows].sort(
    (left, right) =>
      right.conversion - left.conversion ||
      left.costPerResult - right.costPerResult ||
      right.spend - left.spend ||
      left.name.localeCompare(right.name)
  );
}

function getPrimaryEntityRows(payload: ReportPayload) {
  return rankRows(payload.breakdown.rows);
}

function getSeriesRows(payload: ReportPayload) {
  return payload.series
    .filter((point) => point.spend > 0 || point.impressions > 0 || point.clicks > 0 || point.conversion > 0)
    .slice(0, 10);
}

function metricDelta(current: number, previous: number | null | undefined) {
  if (!previous || previous <= 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function formatSignedPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  const rounded = Math.abs(value).toFixed(1);
  return value >= 0 ? `+${rounded}%` : `-${rounded}%`;
}

function trendDirection(points: ReportTimeSeriesPoint[], key: keyof ReportMetricTotals) {
  const activePoints = points.filter((point) => Number(point[key]) > 0);
  const first = activePoints[0];
  const last = activePoints.at(-1);

  if (!first || !last || first.key === last.key) {
    return null;
  }

  const firstValue = Number(first[key]);
  const lastValue = Number(last[key]);
  if (!Number.isFinite(firstValue) || !Number.isFinite(lastValue) || firstValue <= 0) {
    return null;
  }

  return {
    delta: ((lastValue - firstValue) / firstValue) * 100,
    first,
    last,
  };
}

function buildIntelligenceRead(payload: ReportPayload, dateRange: string) {
  const rows = getPrimaryEntityRows(payload);
  const leader = rows[0] ?? null;
  const spendDelta = metricDelta(payload.summary.spend, payload.comparison.previousTotals?.spend);
  const resultDelta = metricDelta(payload.summary.conversion, payload.comparison.previousTotals?.conversion);
  const resultTrend = trendDirection(payload.series, 'conversion');
  const topPlatform = payload.surface.platformBreakdowns.publisherPlatforms[0];
  const topGeo = payload.surface.audienceBreakdowns.geo[0];
  const hasDelivery =
    payload.summary.spend > 0 ||
    payload.summary.impressions > 0 ||
    payload.summary.clicks > 0 ||
    payload.summary.conversion > 0;

  if (!hasDelivery) {
    return {
      summary: `DeepVisor does not see meaningful delivery inside ${dateRange}. Treat this export as a coverage check rather than a performance read until the selected range or filters include synced delivery.`,
      bullets: [
        'No spend, impressions, clicks, or results were recorded in the selected report window.',
        'Use the date picker Max range or broaden filters to find the active serving period for this account.',
        payload.activeDates
          ? `${payload.activeDates.totalActiveDays.toLocaleString()} active serving days are available across the selected entity history.`
          : 'No active serving date map is available for this selection yet.',
      ],
    };
  }

  const bullets = [
    `${payload.summary.conversion.toLocaleString()} results were recorded from ${formatCurrency(
      payload.summary.spend,
      payload.meta.currencyCode
    )} in spend, producing ${formatCurrency(payload.summary.costPerResult, payload.meta.currencyCode)} per result.`,
    spendDelta == null && resultDelta == null
      ? `The report is focused on the current selected range because previous-period comparison is not available.`
      : `Compared with the previous period, spend moved ${formatSignedPercent(spendDelta)} and results moved ${formatSignedPercent(resultDelta)}.`,
    resultTrend
      ? `Results ${resultTrend.delta >= 0 ? 'improved' : 'softened'} ${formatSignedPercent(
          resultTrend.delta
        )} from ${formatDateRange(resultTrend.first.startDate, resultTrend.first.endDate)} to ${formatDateRange(
          resultTrend.last.startDate,
          resultTrend.last.endDate
        )}.`
      : `There is not enough grouped trend depth to call a period-to-period movement with confidence.`,
    leader
      ? `${truncate(leader.name, 64)} is the strongest row in this scope: ${getPerformanceLine(
          leader,
          payload.meta.currencyCode
        )}.`
      : `No entity-level leader is available for the current filters.`,
  ];

  if (topPlatform) {
    bullets.push(
      `${topPlatform.label} is the strongest delivery platform split with ${topPlatform.results.toLocaleString()} results and ${topPlatform.ctr.toFixed(2)}% CTR.`
    );
  }

  if (topGeo) {
    bullets.push(
      `${topGeo.label}${topGeo.secondaryLabel ? ` (${topGeo.secondaryLabel})` : ''} is the strongest audience/location split with ${topGeo.results.toLocaleString()} results.`
    );
  }

  return {
    summary: `DeepVisor reads ${dateRange} as a ${
      payload.summary.conversion > 0 ? 'measurable performance window' : 'delivery window with limited recorded results'
    } for ${payload.export.title}. The most important review points are efficiency, recent movement, and where delivery concentrated.`,
    bullets: bullets.slice(0, 6),
  };
}

function KpiCard({ kpi }: { kpi: ReportKpi }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{kpi.label}</Text>
      <Text style={styles.kpiValue}>{truncate(kpi.formattedValue, 18)}</Text>
      {kpi.deltaPercent == null ? null : (
        <Text style={getDeltaStyle(kpi.deltaPercent)}>{formatDelta(kpi)}</Text>
      )}
    </View>
  );
}

function IntelligenceReport({ payload, dateRange }: { payload: ReportPayload; dateRange: string }) {
  const read = buildIntelligenceRead(payload, dateRange);

  return (
    <View style={styles.intelligenceCard}>
      <Text style={styles.eyebrow}>DeepVisor Intelligence Read</Text>
      <Text style={styles.intelligenceTitle}>What matters in this report</Text>
      <Text style={styles.intelligenceBody}>{read.summary}</Text>
      {read.bullets.map((bullet) => (
        <View key={bullet} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
}

function DataTable({
  headers,
  rows,
  labelWidth = '34%',
}: {
  headers: string[];
  rows: DataRow[];
  labelWidth?: string;
}) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.labelCell, styles.tableHeadText, { width: labelWidth }]}>
          {headers[0] ?? 'Name'}
        </Text>
        {headers.slice(1).map((header) => (
          <Text key={header} style={[styles.valueCell, styles.tableHeadText]}>
            {header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={`${row.label}:${index}`}
          style={index % 2 === 0 ? styles.tableRow : [styles.tableRow, styles.tableRowAlt]}
        >
          <Text
            style={[
              styles.labelCell,
              row.muted ? styles.tableMuted : styles.tableText,
              row.emphasis ? { fontWeight: 800 } : {},
              { width: labelWidth },
            ]}
          >
            {row.label}
          </Text>
          {row.values.map((value, valueIndex) => (
            <Text
              key={`${row.label}:${valueIndex}`}
              style={[
                styles.valueCell,
                styles.tableText,
                row.emphasis ? { fontWeight: 800 } : {},
              ]}
            >
              {String(value)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function PeriodPerformanceTable({ payload }: { payload: ReportPayload }) {
  const periodRows = getSeriesRows(payload);
  const rows: DataRow[] = periodRows.map((point) => ({
    label: truncate(formatDateRange(point.startDate, point.endDate), 28),
    values: [
      formatCurrency(point.spend, payload.meta.currencyCode, 0),
      point.conversion.toLocaleString(),
      point.clicks.toLocaleString(),
      `${point.ctr.toFixed(2)}%`,
      formatCurrency(point.cpc, payload.meta.currencyCode),
      formatCurrency(point.cpm, payload.meta.currencyCode),
    ],
  }));

  rows.push({
    label: 'Total / average',
    emphasis: true,
    values: [
      formatCurrency(payload.summary.spend, payload.meta.currencyCode, 0),
      payload.summary.conversion.toLocaleString(),
      payload.summary.clicks.toLocaleString(),
      `${payload.summary.ctr.toFixed(2)}%`,
      formatCurrency(payload.summary.cpc, payload.meta.currencyCode),
      formatCurrency(payload.summary.cpm, payload.meta.currencyCode),
    ],
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={[styles.card, styles.section]}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Performance by Period</Text>
          <Text style={styles.sectionNote}>Numerical delivery and efficiency view for the selected grouping.</Text>
        </View>
      </View>
      <DataTable
        headers={['Window', 'Spend', 'Results', 'Clicks', 'CTR', 'CPC', 'CPM']}
        rows={rows}
        labelWidth="28%"
      />
    </View>
  );
}

function ComparisonTable({ payload }: { payload: ReportPayload }) {
  const previous = payload.comparison.previousTotals;
  if (!previous) {
    return null;
  }

  const metrics: Array<{
    label: string;
    current: string;
    previous: string;
    delta: string;
  }> = [
    {
      label: 'Spend',
      current: formatCurrency(payload.summary.spend, payload.meta.currencyCode),
      previous: formatCurrency(previous.spend, payload.meta.currencyCode),
      delta: formatSignedPercent(metricDelta(payload.summary.spend, previous.spend)),
    },
    {
      label: 'Results',
      current: payload.summary.conversion.toLocaleString(),
      previous: previous.conversion.toLocaleString(),
      delta: formatSignedPercent(metricDelta(payload.summary.conversion, previous.conversion)),
    },
    {
      label: 'CTR',
      current: `${payload.summary.ctr.toFixed(2)}%`,
      previous: `${previous.ctr.toFixed(2)}%`,
      delta: formatSignedPercent(metricDelta(payload.summary.ctr, previous.ctr)),
    },
    {
      label: 'Cost / Result',
      current: formatCurrency(payload.summary.costPerResult, payload.meta.currencyCode),
      previous: formatCurrency(previous.costPerResult, payload.meta.currencyCode),
      delta: formatSignedPercent(metricDelta(payload.summary.costPerResult, previous.costPerResult)),
    },
  ];

  return (
    <View style={[styles.card, styles.section]}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Previous Period Comparison</Text>
          <Text style={styles.sectionNote}>
            Previous window: {formatDateRange(payload.comparison.previousDateFrom, payload.comparison.previousDateTo)}.
          </Text>
        </View>
      </View>
      <DataTable
        headers={['Metric', 'Current', 'Previous', 'Delta']}
        rows={metrics.map((metric) => ({
          label: metric.label,
          values: [metric.current, metric.previous, metric.delta],
        }))}
      />
    </View>
  );
}

function PerformanceRowsTable({ payload, limit = 8 }: { payload: ReportPayload; limit?: number }) {
  const rows = getPrimaryEntityRows(payload).slice(0, limit);
  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={[styles.card, styles.section]}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Key Performance Rows</Text>
          <Text style={styles.sectionNote}>Most productive rows in the current report scope.</Text>
        </View>
      </View>
      <DataTable
        headers={['Entity', 'Spend', 'Results', 'CTR', 'Cost/Result']}
        labelWidth="42%"
        rows={rows.map((row) => ({
          label: truncate(row.name, 42),
          values: [
            formatCurrency(row.spend, payload.meta.currencyCode, 0),
            row.conversion.toLocaleString(),
            `${row.ctr.toFixed(2)}%`,
            formatCurrency(row.costPerResult, payload.meta.currencyCode),
          ],
        }))}
      />
    </View>
  );
}

function surfaceRowsFromPlatform(
  slices: DashboardPlatformSlice[],
  payload: ReportPayload,
  limit = 5
): DataRow[] {
  return slices
    .filter((slice) => slice.spend > 0 || slice.impressions > 0 || slice.clicks > 0 || slice.results > 0)
    .slice(0, limit)
    .map((slice) => ({
      label: truncate(slice.label, 28),
      values: [
        slice.clicks.toLocaleString(),
        `${slice.ctr.toFixed(2)}%`,
        formatCurrency(slice.spend, payload.meta.currencyCode, 0),
      ],
    }));
}

function isTabletDeviceLabel(label: string) {
  return /tablet|ipad/i.test(label);
}

function surfaceRowsFromAudience(
  slices: DashboardAudienceSlice[],
  payload: ReportPayload,
  limit = 5
): DataRow[] {
  return slices
    .filter((slice) => slice.spend > 0 || slice.impressions > 0 || slice.clicks > 0 || slice.results > 0)
    .slice(0, limit)
    .map((slice) => ({
      label: truncate(slice.secondaryLabel ? `${slice.label} · ${slice.secondaryLabel}` : slice.label, 30),
      values: [
        slice.results.toLocaleString(),
        slice.clicks.toLocaleString(),
        `${slice.ctr.toFixed(2)}%`,
        formatCurrency(slice.spend, payload.meta.currencyCode, 0),
      ],
    }));
}

function SurfaceCards({ payload }: { payload: ReportPayload }) {
  const topDevice = payload.surface.platformBreakdowns.impressionDevices.find(
    (slice) => !isTabletDeviceLabel(slice.label)
  );
  const cards = [
    payload.surface.platformBreakdowns.publisherPlatforms[0]
      ? {
          label: 'Top platform',
          value: payload.surface.platformBreakdowns.publisherPlatforms[0].label,
          meta: `${payload.surface.platformBreakdowns.publisherPlatforms[0].clicks.toLocaleString()} clicks · ${payload.surface.platformBreakdowns.publisherPlatforms[0].ctr.toFixed(2)}% CTR`,
        }
      : null,
    topDevice
      ? {
          label: 'Top device',
          value: topDevice.label,
          meta: `${topDevice.clicks.toLocaleString()} clicks · ${formatCompactNumber(
            topDevice.impressions
          )} impressions`,
        }
      : null,
    payload.surface.audienceBreakdowns.ageGender[0]
      ? {
          label: 'Top audience',
          value: payload.surface.audienceBreakdowns.ageGender[0].label,
          meta: `${payload.surface.audienceBreakdowns.ageGender[0].results.toLocaleString()} results · ${formatCompactCurrency(
            payload.surface.audienceBreakdowns.ageGender[0].spend,
            payload.meta.currencyCode
          )} spend`,
        }
      : null,
    payload.surface.audienceBreakdowns.geo[0]
      ? {
          label: 'Top geo',
          value: payload.surface.audienceBreakdowns.geo[0].secondaryLabel
            ? `${payload.surface.audienceBreakdowns.geo[0].label} · ${payload.surface.audienceBreakdowns.geo[0].secondaryLabel}`
            : payload.surface.audienceBreakdowns.geo[0].label,
          meta: `${payload.surface.audienceBreakdowns.geo[0].results.toLocaleString()} results · ${payload.surface.audienceBreakdowns.geo[0].ctr.toFixed(2)}% CTR`,
        }
      : null,
  ].filter((card): card is { label: string; value: string; meta: string } => Boolean(card));

  if (cards.length === 0) {
    return null;
  }

  return (
    <View style={[styles.section, styles.surfaceGrid]}>
      {cards.map((card) => (
        <View key={card.label} style={styles.surfaceCard}>
          <Text style={styles.surfaceLabel}>{card.label}</Text>
          <Text style={styles.surfaceValue}>{truncate(card.value, 32)}</Text>
          <Text style={styles.surfaceMeta}>{card.meta}</Text>
        </View>
      ))}
    </View>
  );
}

function SurfaceDataTables({ payload }: { payload: ReportPayload }) {
  const tables = [
    {
      title: 'Serving Platforms',
      note: 'Publisher platform delivery splits. Results use click volume for this split.',
      headers: ['Segment', 'Results', 'CTR', 'Spend'],
      rows: surfaceRowsFromPlatform(payload.surface.platformBreakdowns.publisherPlatforms, payload),
    },
    {
      title: 'Devices',
      note: 'Impression device delivery splits. Results use click volume for this split.',
      headers: ['Segment', 'Results', 'CTR', 'Spend'],
      rows: surfaceRowsFromPlatform(
        payload.surface.platformBreakdowns.impressionDevices.filter(
          (slice) => !isTabletDeviceLabel(slice.label)
        ),
        payload
      ),
    },
    {
      title: 'Audience',
      note: 'Age and gender delivery splits.',
      headers: ['Segment', 'Results', 'Clicks', 'CTR', 'Spend'],
      rows: surfaceRowsFromAudience(payload.surface.audienceBreakdowns.ageGender, payload),
    },
    {
      title: 'Geo',
      note: 'Location delivery splits.',
      headers: ['Segment', 'Results', 'Clicks', 'CTR', 'Spend'],
      rows: surfaceRowsFromAudience(payload.surface.audienceBreakdowns.geo, payload),
    },
  ].filter((table) => table.rows.length > 0);

  if (tables.length === 0) {
    return null;
  }

  return (
    <>
      {tables.map((table) => (
        <View key={table.title} style={[styles.card, styles.section]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{table.title}</Text>
              <Text style={styles.sectionNote}>{table.note}</Text>
            </View>
          </View>
          <DataTable
            headers={table.headers}
            rows={table.rows}
            labelWidth="38%"
          />
        </View>
      ))}
    </>
  );
}

function AppendixTable({ payload }: { payload: ReportPayload }) {
  const rows = payload.breakdown.rows.slice(0, 18);
  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Performance Appendix</Text>
          <Text style={styles.sectionNote}>
            Compact row-level view. Showing first {rows.length.toLocaleString()} rows from the current performance table.
          </Text>
        </View>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.nameCell, styles.tableHeadText]}>Name</Text>
        <Text style={[styles.contextCell, styles.tableHeadText]}>Context</Text>
        <Text style={[styles.windowCell, styles.tableHeadText]}>Window</Text>
        <Text style={[styles.metricCell, styles.tableHeadText]}>Spend</Text>
        <Text style={[styles.metricCell, styles.tableHeadText]}>Results</Text>
        <Text style={[styles.metricCell, styles.tableHeadText]}>CTR</Text>
        <Text style={[styles.metricCell, styles.tableHeadText]}>CPC</Text>
        <Text style={[styles.metricCell, styles.tableHeadText]}>Cost/Res.</Text>
      </View>
      {rows.map((row, index) => (
        <View key={row.id} style={index % 2 === 0 ? styles.tableRow : [styles.tableRow, styles.tableRowAlt]}>
          <Text style={[styles.nameCell, styles.tableText]}>{truncate(row.name, 36)}</Text>
          <Text style={[styles.contextCell, styles.tableMuted]}>{truncate(getContextLabel(row), 26)}</Text>
          <Text style={[styles.windowCell, styles.tableMuted]}>{truncate(formatDateRange(row.startDate, row.endDate), 22)}</Text>
          <Text style={[styles.metricCell, styles.tableText]}>{formatCurrency(row.spend, payload.meta.currencyCode, 0)}</Text>
          <Text style={[styles.metricCell, styles.tableText]}>{row.conversion.toLocaleString()}</Text>
          <Text style={[styles.metricCell, styles.tableText]}>{row.ctr.toFixed(2)}%</Text>
          <Text style={[styles.metricCell, styles.tableText]}>{formatCurrency(row.cpc, payload.meta.currencyCode)}</Text>
          <Text style={[styles.metricCell, styles.tableText]}>{formatCurrency(row.costPerResult, payload.meta.currencyCode)}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ payload }: { payload: ReportPayload }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{payload.meta.businessName}</Text>
      <Text render={({ pageNumber, totalPages }) => `DeepVisor source report · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function PageHeader({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <View style={styles.pageHeader}>
      <View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {note ? <Text style={styles.subtleBadge}>{note}</Text> : null}
    </View>
  );
}

export function ReportPdfDocument({ payload }: { payload: ReportPayload }) {
  const dateRange = formatDateRange(payload.query.dateFrom, payload.query.dateTo);
  const hasPeriodData = getSeriesRows(payload).length > 0;
  const hasDeviceData = payload.surface.platformBreakdowns.impressionDevices.some(
    (slice) => !isTabletDeviceLabel(slice.label)
  );
  const hasSurfaceData =
    payload.surface.platformBreakdowns.publisherPlatforms.length > 0 ||
    hasDeviceData ||
    payload.surface.audienceBreakdowns.ageGender.length > 0 ||
    payload.surface.audienceBreakdowns.geo.length > 0;
  const hasBreakdownRows = payload.breakdown.rows.length > 0;

  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={styles.coverPage}>
        <View style={styles.heroPanel}>
          <View style={styles.pageHeader}>
            <Text style={styles.clientBadge}>{payload.meta.businessName}</Text>
            <Text style={styles.subtleBadge}>Generated {formatGeneratedAt(payload.export.generatedAt)}</Text>
          </View>
          <Text style={styles.eyebrow}>Executive Performance Report</Text>
          <Text style={styles.reportTitle}>{payload.export.title}</Text>
          <Text style={styles.reportSubtitle}>
            {payload.export.subtitle}. Reporting window: {dateRange}. This export highlights the delivery, efficiency,
            audience, and row-level signals that are available for the selected scope.
          </Text>
          <View style={styles.filterGrid}>
            {payload.export.filterSummary.slice(0, 8).map((item) => (
              <Text key={item.label} style={styles.filterBadge}>
                {item.label}: {truncate(formatFilterValue(payload, item.label, item.value), 42)}
              </Text>
            ))}
          </View>
        </View>

        <IntelligenceReport payload={payload} dateRange={dateRange} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>KPI Summary</Text>
              <Text style={styles.sectionNote}>Current period values with previous-period comparison when available.</Text>
            </View>
          </View>
          <View style={styles.kpiGrid}>
            {payload.kpis.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </View>
        </View>

        <Footer payload={payload} />
      </Page>

      {(hasPeriodData || hasBreakdownRows) ? (
        <Page size="LETTER" orientation="portrait" style={styles.page}>
          <PageHeader eyebrow="Performance Data" title="Numerical performance view" note={`Grouped by ${payload.query.groupBy}`} />
          <ComparisonTable payload={payload} />
          <PeriodPerformanceTable payload={payload} />
          <PerformanceRowsTable payload={payload} limit={4} />
          <Footer payload={payload} />
        </Page>
      ) : null}

      {hasSurfaceData ? (
        <Page size="LETTER" orientation="portrait" style={styles.page}>
          <PageHeader eyebrow="Audience and Delivery" title="Delivery surface data" note={payload.meta.scopeLabel} />
          <SurfaceCards payload={payload} />
          <SurfaceDataTables payload={payload} />
          <Footer payload={payload} />
        </Page>
      ) : null}

      {hasBreakdownRows ? (
        <Page size="LETTER" orientation="portrait" style={styles.page}>
          <PageHeader eyebrow="Appendix" title="Performance Appendix" note={`${payload.breakdown.rows.length.toLocaleString()} rows`} />
          <AppendixTable payload={payload} />
          <Footer payload={payload} />
        </Page>
      ) : null}
    </Document>
  );
}
