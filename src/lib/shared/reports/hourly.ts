import type { DashboardTrendPoint } from '@/lib/server/dashboard/types';

type HeatmapCell = {
  observed: boolean;
  observations: number;
  key: string;
  dayLabel: string;
  dayOfWeek: number;
  hourOfDay: number;
  metricAverage: number;
  metricTotal: number;
  results: number;
  clicks: number;
  linkClicks: number;
  spend: number;
  ctr: number;
  impressions: number;
  intensity: number;
};

type HeatmapRow = {
  dayLabel: string;
  dayOfWeek: number;
  cells: HeatmapCell[];
};

type HourlyHeatmapConfig = {
  title: string;
  metricLabel: string;
  summarySlotLabel: string;
  summaryDayLabel: string;
  summaryHourLabel: string;
  rows: HeatmapRow[];
  hourLabels: string[];
};

const HEATMAP_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function formatHourShortLabel(hour: number) {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return '';
  }

  const suffix = hour >= 12 ? 'P' : 'A';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

export function formatHourLongLabel(hour: number) {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return 'Unknown';
  }

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

function shouldRenderHeatmapHourLabel(hour: number) {
  return hour === 0 || hour === 4 || hour === 8 || hour === 12 || hour === 16 || hour === 20;
}

export function buildHourlyHeatmap(points: DashboardTrendPoint[]): HourlyHeatmapConfig | null {
  const hourlyPoints = points
    .filter(
      (point) =>
        point.dayKey &&
        point.dayOfWeek != null &&
        point.dayOfWeek >= 0 &&
        point.dayOfWeek <= 6 &&
        point.hourOfDay != null &&
        point.hourOfDay >= 0 &&
        point.hourOfDay <= 23
    )
    .map((point) => ({
      ...point,
      dayOfWeek: point.dayOfWeek as number,
      hourOfDay: point.hourOfDay as number,
    }));

  if (hourlyPoints.length === 0) {
    return null;
  }

  const prefersResults = hourlyPoints.some((point) => point.results > 0);
  const prefersLinkClicks =
    !prefersResults && hourlyPoints.some((point) => point.inlineLinkClicks > 0);
  const metricLabel = prefersResults ? 'Results' : prefersLinkClicks ? 'Link clicks' : 'Clicks';
  const aggregates = new Map<
    string,
    {
      dayOfWeek: number;
      hourOfDay: number;
      impressions: number;
      results: number;
      clicks: number;
      linkClicks: number;
      spend: number;
      occurrences: number;
    }
  >();

  for (const point of hourlyPoints) {
    const key = `${point.dayOfWeek}:${point.hourOfDay}`;
    const current = aggregates.get(key) ?? {
      dayOfWeek: point.dayOfWeek,
      hourOfDay: point.hourOfDay,
      impressions: 0,
      results: 0,
      clicks: 0,
      linkClicks: 0,
      spend: 0,
      occurrences: 0,
    };

    current.impressions += point.impressions;
    current.results += point.results;
    current.clicks += point.clicks;
    current.linkClicks += point.inlineLinkClicks;
    current.spend += point.spend;
    current.occurrences += 1;
    aggregates.set(key, current);
  }

  const cells = Array.from(aggregates.values()).map((aggregate) => {
    const metricTotal = prefersResults
      ? aggregate.results
      : prefersLinkClicks
        ? aggregate.linkClicks
        : aggregate.clicks;
    const metricAverage = aggregate.occurrences > 0 ? metricTotal / aggregate.occurrences : 0;
    const ctr = aggregate.impressions > 0 ? (aggregate.clicks / aggregate.impressions) * 100 : 0;

    return {
      key: `${aggregate.dayOfWeek}:${aggregate.hourOfDay}`,
      dayLabel: HEATMAP_DAY_LABELS[aggregate.dayOfWeek] ?? '-',
      dayOfWeek: aggregate.dayOfWeek,
      hourOfDay: aggregate.hourOfDay,
      observed: true,
      observations: aggregate.occurrences,
      metricAverage,
      metricTotal,
      results: aggregate.results,
      clicks: aggregate.clicks,
      linkClicks: aggregate.linkClicks,
      spend: aggregate.spend,
      ctr,
      impressions: aggregate.impressions,
      intensity: 0,
    } satisfies HeatmapCell;
  });

  const maxAverage = cells.reduce((max, cell) => Math.max(max, cell.metricAverage), 0);
  const normalizedCells = cells.map((cell) => ({
    ...cell,
    intensity: maxAverage > 0 ? Math.min(1, Math.sqrt(cell.metricAverage / maxAverage)) : 0,
  }));
  const rows: HeatmapRow[] = HEATMAP_DAY_LABELS.map((label, dayOfWeek) => ({
    dayLabel: label,
    dayOfWeek,
    cells: Array.from({ length: 24 }, (_, hourOfDay) => {
      const cell = normalizedCells.find(
        (candidate) => candidate.dayOfWeek === dayOfWeek && candidate.hourOfDay === hourOfDay
      );

      return (
        cell ?? {
          key: `${dayOfWeek}:${hourOfDay}`,
          dayLabel: label,
          dayOfWeek,
          hourOfDay,
          observed: false,
          observations: 0,
          metricAverage: 0,
          metricTotal: 0,
          results: 0,
          clicks: 0,
          linkClicks: 0,
          spend: 0,
          ctr: 0,
          impressions: 0,
          intensity: 0,
        }
      );
    }),
  }));
  const bestCell = normalizedCells.sort(
    (left, right) =>
      right.metricAverage - left.metricAverage ||
      right.ctr - left.ctr ||
      right.spend - left.spend
  )[0];

  if (!bestCell) {
    return null;
  }

  const bestDay = rows
    .map((row) => ({
      dayLabel: row.dayLabel,
      metricAverage: row.cells.reduce((sum, cell) => sum + cell.metricAverage, 0),
    }))
    .sort((left, right) => right.metricAverage - left.metricAverage)[0];
  const bestHour = Array.from({ length: 24 }, (_, hourOfDay) => ({
    hourOfDay,
    metricAverage: rows.reduce((sum, row) => sum + row.cells[hourOfDay].metricAverage, 0),
  })).sort((left, right) => right.metricAverage - left.metricAverage)[0];

  return {
    title: `Observed hourly ${metricLabel.toLowerCase()} activity`,
    metricLabel,
    summarySlotLabel: `${bestCell.dayLabel} · ${formatHourLongLabel(bestCell.hourOfDay)}`,
    summaryDayLabel: bestDay?.dayLabel ?? '-',
    summaryHourLabel: bestHour ? formatHourLongLabel(bestHour.hourOfDay) : '-',
    rows,
    hourLabels: Array.from({ length: 24 }, (_, hourOfDay) =>
      shouldRenderHeatmapHourLabel(hourOfDay) ? formatHourShortLabel(hourOfDay) : ''
    ),
  };
}

