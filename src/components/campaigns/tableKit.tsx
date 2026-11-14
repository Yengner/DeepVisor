'use client';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ActionIcon, Menu, Radio, Skeleton, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconArrowsSort, IconChevronRight, IconDots, IconTrendingUp } from '@tabler/icons-react';
import { LiveIndicator } from '@/components/design/LiveIndicator';
import { accountToday } from '@/lib/shared/reports/dates';
import StatusBadge from './StatusBadge';
import { formatRecordedCurrency } from './metrics';
import classes from './CampaignDashboard.module.css';

/** Shared presentation helpers for the Campaigns, Ad sets and Ads tables. */

/** Meta enum (e.g. OUTCOME_LEADS) → readable label. Shared with Reports. */
export { humanizeObjective } from '@/lib/shared/reports/labels';

export function formatCount(value: number | null | undefined, available = true): string {
  return !available || value == null || !Number.isFinite(value) ? '—' : Math.round(value).toLocaleString('en-US');
}

/**
 * Last-activity label. Lifetime summaries can report a last day beyond today; activity
 * cannot be in the future, so anything on or after the account's today reads "Today".
 */
export function lastActivity(formatted: string | null | undefined, rawDay: string | null | undefined, timezone?: string | null, now = new Date()): string {
  const today = accountToday(timezone ?? null, now);
  if (rawDay && today && rawDay >= today) return 'Today';
  return formatted || '—';
}

/** One status chip: a delivering chain shows "Delivering"; otherwise Meta's status. */
export function StatusCell({ status, delivering }: { status?: string | null; delivering?: boolean }) {
  return delivering ? (
    <span className={classes.deliveringChip} title="Campaign, ad set and at least one ad are active in the latest saved Meta status.">
      <LiveIndicator label="Delivering" />
    </span>
  ) : (
    <StatusBadge status={status} />
  );
}

export function SelectCell({ selected, label, onSelect, disabled }: { selected: boolean; label: string; onSelect: () => void; disabled?: boolean }) {
  return (
    <Radio
      size="xs"
      checked={selected}
      disabled={disabled}
      aria-label={label}
      onChange={onSelect}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      classNames={{ radio: classes.selectRadio }}
    />
  );
}

/** See-through "more actions" control; the dropdown is unchanged. */
export function RowActions({ name, children, extra }: { name: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className={classes.rowActions} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      {extra}
      <Menu position="bottom-end" withArrow offset={4}>
        <Menu.Target>
          <Tooltip label="More actions" openDelay={300} withinPortal>
            <ActionIcon variant="subtle" color="gray" radius="xl" aria-label={`More actions for ${name}`} className={classes.ghostAction}>
              <IconDots size={18} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>{children}</Menu.Dropdown>
      </Menu>
    </div>
  );
}

/** Mobile drill-down: touch has no double-click, so the next level needs a visible control. */
export function OpenNextButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <UnstyledButton
      className={classes.openNext}
      onClick={(event) => { event.stopPropagation(); onOpen(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {label}
      <IconChevronRight size={14} aria-hidden="true" />
    </UnstyledButton>
  );
}

/** Entity name that ellipsizes; the full-name tooltip appears only when text is actually cut off. */
export function TruncatedName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  return (
    <Tooltip label={name} multiline withArrow withinPortal position="top-start" maw={420} openDelay={350} disabled={!truncated}>
      <span
        ref={ref}
        className={classes.cellName}
        onMouseEnter={() => { const el = ref.current; if (el) setTruncated(el.scrollWidth > el.clientWidth + 1); }}
        onFocus={() => { const el = ref.current; if (el) setTruncated(el.scrollWidth > el.clientWidth + 1); }}
      >
        {name}
      </span>
    </Tooltip>
  );
}

/* ---------------- Shared metric columns ---------------- */

type Numeric = number | string | null | undefined;

/** Raw row shape shared by campaign, ad-set and ad lifetime rows. */
export interface MetricSource {
  spend?: Numeric;
  leads?: Numeric;
  messages?: Numeric;
  calls?: Numeric;
  ctr?: Numeric;
  cpc?: Numeric;
  cpm?: Numeric;
  impressions?: Numeric;
  clicks?: Numeric;
  link_clicks?: Numeric;
  metricsAvailable?: boolean;
}

export interface RowMetrics {
  available: boolean;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  impressions: number | null;
  clicks: number | null;
  linkClicks: number | null;
  leads: number | null;
  messages: number | null;
}

const num = (value: Numeric): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Normalises a lifetime row. Missing observations stay null (rendered "—"), never zero;
 * cost per result is recomputed from the aggregates rather than averaged.
 */
export function rowMetrics(row: MetricSource): RowMetrics {
  const available = row.metricsAvailable !== false;
  const count = (value: Numeric) => (available ? num(value) ?? 0 : null);
  const spend = count(row.spend);
  const results = available ? (num(row.leads) ?? 0) + (num(row.messages) ?? 0) + (num(row.calls) ?? 0) : null;
  return {
    available,
    spend,
    results,
    costPerResult: spend != null && results ? spend / results : null,
    ctr: available ? num(row.ctr) : null,
    cpc: available ? num(row.cpc) : null,
    cpm: available ? num(row.cpm) : null,
    impressions: count(row.impressions),
    clicks: count(row.clicks),
    linkClicks: count(row.link_clicks),
    leads: count(row.leads),
    messages: count(row.messages),
  };
}

export const formatPercent = (value: number | null) => (value == null ? '—' : `${value.toFixed(2)}%`);

/* ---------------- Sorting ---------------- */

export type SortKey =
  | 'name' | 'spend' | 'results' | 'costPerResult' | 'ctr' | 'cpc' | 'cpm'
  | 'impressions' | 'clicks' | 'linkClicks' | 'leads' | 'messages';
export type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null;

/** Header click cycle: descending → ascending → default order. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (!current || current.key !== key) return { key, dir: key === 'name' ? 'asc' : 'desc' };
  const first = key === 'name' ? 'asc' : 'desc';
  return current.dir === first ? { key, dir: first === 'asc' ? 'desc' : 'asc' } : null;
}

/**
 * Stable sort by a metric or the name. Missing values ("—") always sort last in either
 * direction; with no sort the incoming order (delivering first) is kept.
 */
export function sortRows<T>(rows: T[], sort: SortState, pick: (row: T) => { name: string; metrics: RowMetrics }): T[] {
  if (!sort) return rows;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, ...pick(row) }))
    .sort((a, b) => {
      if (sort.key === 'name') return sign * a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.index - b.index;
      const av = a.metrics[sort.key];
      const bv = b.metrics[sort.key];
      if (av == null || bv == null) return av == null && bv == null ? a.index - b.index : av == null ? 1 : -1;
      return sign * (av - bv) || a.index - b.index;
    })
    .map(({ row }) => row);
}

export function useSort() {
  const [sort, setSort] = useState<SortState>(null);
  return { sort, toggle: (key: SortKey) => setSort((current) => nextSort(current, key)) };
}

export function SortHeader({ label, sortKey, sort, onSort, numeric, style }: {
  label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void; numeric?: boolean; style?: CSSProperties;
}) {
  const active = sort?.key === sortKey ? sort.dir : null;
  const Icon = active === 'asc' ? IconArrowUp : active === 'desc' ? IconArrowDown : IconArrowsSort;
  return (
    <Table.Th
      data-num={numeric || undefined}
      className={classes.nowrap}
      style={style}
      aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}
    >
      <UnstyledButton className={classes.sortButton} data-active={active || undefined} onClick={() => onSort(sortKey)}>
        {label}
        <Icon size={13} aria-hidden="true" className={classes.sortIcon} />
      </UnstyledButton>
    </Table.Th>
  );
}

/* ---------------- Cost-per-result comparison ---------------- */

/** Minimum evidence before a row is compared: its own results, and the peer pool's. */
export const COST_FLAG = { ratio: 1.25, minRowResults: 5, minPoolResults: 10, minPeers: 2 } as const;

export interface CostBenchmark { costPerResult: number; peers: number; label: string }

/**
 * Pooled cost per result (total spend ÷ total results) per group, so rows are only
 * compared with like-for-like peers (e.g. campaigns sharing an objective). Groups without
 * enough evidence get no benchmark — no comparison is shown rather than a weak one.
 */
export function costBenchmarks<T>(rows: T[], metricsOf: (row: T) => RowMetrics, groupOf: (row: T) => string, labelOf: (group: string) => string): Map<string, CostBenchmark> {
  const pools = new Map<string, { spend: number; results: number; peers: number }>();
  for (const row of rows) {
    const m = metricsOf(row);
    if (m.spend == null || !m.results) continue;
    const key = groupOf(row);
    const pool = pools.get(key) ?? { spend: 0, results: 0, peers: 0 };
    pool.spend += m.spend;
    pool.results += m.results;
    pool.peers += 1;
    pools.set(key, pool);
  }
  const out = new Map<string, CostBenchmark>();
  for (const [key, pool] of pools) {
    if (pool.peers >= COST_FLAG.minPeers && pool.results >= COST_FLAG.minPoolResults) {
      out.set(key, { costPerResult: pool.spend / pool.results, peers: pool.peers, label: labelOf(key) });
    }
  }
  return out;
}

/** Percent above the benchmark when it clears the threshold, otherwise null. */
export function costAbove(metrics: RowMetrics, benchmark?: CostBenchmark | null): number | null {
  if (!benchmark || metrics.costPerResult == null || (metrics.results ?? 0) < COST_FLAG.minRowResults) return null;
  const ratio = metrics.costPerResult / benchmark.costPerResult;
  return ratio >= COST_FLAG.ratio ? Math.round((ratio - 1) * 100) : null;
}

function CostValue({ metrics, currencyCode, benchmark }: { metrics: RowMetrics; currencyCode?: string | null; benchmark?: CostBenchmark | null }) {
  const above = costAbove(metrics, benchmark);
  const value = formatRecordedCurrency(metrics.costPerResult, currencyCode);
  if (above == null || !benchmark) return <>{value}</>;
  const note = `${above}% above the ${formatRecordedCurrency(benchmark.costPerResult, currencyCode)} average across ${benchmark.peers} ${benchmark.label} (lifetime).`;
  return (
    <Tooltip label={note} multiline maw={260} withArrow withinPortal openDelay={200}>
      <span className={classes.costHigh} tabIndex={0} aria-label={`${value}, ${note}`}>
        {/* Tag first so the value stays aligned with the rest of the right-aligned column. */}
        <span className={classes.costHighTag} aria-hidden="true"><IconTrendingUp size={12} />{above}%</span>
        {value}
      </span>
    </Tooltip>
  );
}

/* ---------------- Metric columns ---------------- */

type MetricColumn = { key: Exclude<SortKey, 'name'>; label: string; render: (m: RowMetrics, currency?: string | null, benchmark?: CostBenchmark | null) => ReactNode; strong?: boolean };
const METRIC_COLUMNS: MetricColumn[] = [
  { key: 'spend', label: 'Spend', render: (m, c) => formatRecordedCurrency(m.spend, c), strong: true },
  { key: 'results', label: 'Results', render: (m) => formatCount(m.results) },
  { key: 'costPerResult', label: 'Cost / result', render: (m, c, b) => <CostValue metrics={m} currencyCode={c} benchmark={b} /> },
  { key: 'ctr', label: 'CTR', render: (m) => formatPercent(m.ctr) },
  { key: 'cpc', label: 'CPC', render: (m, c) => formatRecordedCurrency(m.cpc, c) },
  { key: 'cpm', label: 'CPM', render: (m, c) => formatRecordedCurrency(m.cpm, c) },
  { key: 'impressions', label: 'Impressions', render: (m) => formatCount(m.impressions) },
  { key: 'clicks', label: 'Clicks', render: (m) => formatCount(m.clicks) },
  { key: 'linkClicks', label: 'Link clicks', render: (m) => formatCount(m.linkClicks) },
  { key: 'leads', label: 'Leads', render: (m) => formatCount(m.leads) },
  { key: 'messages', label: 'Messages', render: (m) => formatCount(m.messages) },
];
export const METRIC_COLUMN_COUNT = METRIC_COLUMNS.length;

export function MetricHeaders({ sort, onSort }: { sort: SortState; onSort: (key: SortKey) => void }) {
  return METRIC_COLUMNS.map((column) => (
    <SortHeader key={column.key} label={column.label} sortKey={column.key} sort={sort} onSort={onSort} numeric />
  ));
}

export function MetricCells({ metrics, currencyCode, benchmark }: { metrics: RowMetrics; currencyCode?: string | null; benchmark?: CostBenchmark | null }) {
  return METRIC_COLUMNS.map((column) => (
    <Table.Td key={column.key} data-num className={classes.nowrap}>
      <Text size="sm" fw={column.strong ? 600 : undefined} component="div">{column.render(metrics, currencyCode, benchmark)}</Text>
    </Table.Td>
  ));
}

/** View rows for a table: sorted by the header state, with per-group cost benchmarks. */
export function useTableRows<T>(rows: T[], pick: (row: T) => { name: string; metrics: RowMetrics }, groupOf: (row: T) => string, labelOf: (group: string) => string) {
  const { sort, toggle } = useSort();
  // Tables hold a few dozen rows at most; recomputing per render is cheaper than memo bookkeeping.
  const benchmarks = costBenchmarks(rows, (row) => pick(row).metrics, groupOf, labelOf);
  return { sorted: sortRows(rows, sort, pick), sort, toggle, benchmarkFor: (row: T) => benchmarks.get(groupOf(row)) ?? null };
}

/** Mobile card metrics: the three decision numbers up front, efficiency behind a disclosure. */
export function MobileMetrics({ metrics, currencyCode, benchmark }: { metrics: RowMetrics; currencyCode?: string | null; benchmark?: CostBenchmark | null }) {
  return (
    <div className={classes.mobileMetricGrid}>
      <div><Text>Spend</Text><Text>{formatRecordedCurrency(metrics.spend, currencyCode)}</Text></div>
      <div><Text>Results</Text><Text>{formatCount(metrics.results)}</Text></div>
      <div><Text>Cost / result</Text><Text component="div"><CostValue metrics={metrics} currencyCode={currencyCode} benchmark={benchmark} /></Text></div>
      <details className={classes.moreMetrics} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <summary>More metrics</summary>
        <dl className={classes.moreMetricList}>
          <div><dt>CTR</dt><dd>{formatPercent(metrics.ctr)}</dd></div>
          <div><dt>CPC</dt><dd>{formatRecordedCurrency(metrics.cpc, currencyCode)}</dd></div>
          <div><dt>CPM</dt><dd>{formatRecordedCurrency(metrics.cpm, currencyCode)}</dd></div>
          <div><dt>Impressions</dt><dd>{formatCount(metrics.impressions)}</dd></div>
          <div><dt>Link clicks</dt><dd>{formatCount(metrics.linkClicks)}</dd></div>
          <div><dt>Leads</dt><dd>{formatCount(metrics.leads)}</dd></div>
        </dl>
      </details>
    </div>
  );
}

/** Table-shaped loading state so the layout does not jump when rows arrive. */
export function TableSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div className={classes.tableSkeleton} role="status" aria-live="polite" aria-busy="true">
      <span className={classes.srOnly}>Loading {label}…</span>
      <div className={classes.skeletonHeader}>
        <Skeleton height={10} width="22%" radius="sm" />
        <Skeleton height={10} width="10%" radius="sm" />
        <Skeleton height={10} width="12%" radius="sm" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={classes.skeletonRow}>
          <Skeleton height={16} circle />
          <Skeleton height={12} width={`${38 - index * 4}%`} radius="sm" />
          <Skeleton height={20} width={72} radius="xl" />
          <Skeleton height={12} width="12%" radius="sm" ml="auto" />
        </div>
      ))}
    </div>
  );
}

export function EmptyRow({ colSpan, title, hint }: { colSpan: number; title: string; hint?: string }) {
  return (
    <Table.Tr>
      <Table.Td colSpan={colSpan}>
        <div className={classes.emptyRow}>
          <Text fw={600} size="sm">{title}</Text>
          {hint ? <Text size="sm" c="dimmed">{hint}</Text> : null}
        </div>
      </Table.Td>
    </Table.Tr>
  );
}
