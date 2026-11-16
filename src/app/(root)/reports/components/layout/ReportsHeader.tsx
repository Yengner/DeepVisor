'use client';

import { useMemo, useState } from 'react';
import { ActionIcon, Button, Drawer, Menu, Popover, Switch, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DatePicker } from '@mantine/dates';
import {
  IconAdjustmentsHorizontal,
  IconCalendar,
  IconChevronDown,
  IconDots,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconRefresh,
} from '@tabler/icons-react';
import { SavedViewsMenu } from './SavedViewsMenu';
import RangeSwitch, { RANGE_LABELS } from '@/components/design/RangeSwitch';
import { completedReportRange, shiftReportDay } from '@/lib/shared/reports/dates';
import { formatReportRange, formatTimezone } from '@/lib/shared/reports/labels';
import type { ReportFilterOptions, ReportPayload } from '@/lib/server/reports/types';
import classes from '../Workspace.module.css';

interface ReportsHeaderProps {
  payload: ReportPayload;
  filterOptions: ReportFilterOptions;
  exportLinks: { pdf: string; csv: string };
  onUpdate: (mutate: (params: URLSearchParams) => void) => void;
  onRefresh: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  scopeName: string;
  isDemo?: boolean;
  isPending?: boolean;
}

type Preset = '7d' | '30d' | '90d' | 'max';
const PRESETS: Array<{ value: Preset; label: string; title: string }> = [
  // Reports use completed days (through yesterday); Overview and Campaigns windows include today so far.
  { value: '7d', label: RANGE_LABELS['7d'], title: 'Last 7 completed days, through yesterday (Overview and Campaigns include today)' },
  { value: '30d', label: RANGE_LABELS['30d'], title: 'Last 30 completed days, through yesterday (Overview and Campaigns include today)' },
  { value: '90d', label: RANGE_LABELS['90d'], title: 'Last 90 completed days, through yesterday' },
  { value: 'max', label: RANGE_LABELS.all, title: 'All saved history' },
];

/** "Synced 1:38 PM" today, otherwise with the date; honest when no sync is recorded. */
function syncedLabel(at: string | null | undefined): string {
  if (!at || !Number.isFinite(Date.parse(at))) return 'Not synced yet';
  const date = new Date(at), time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString() ? `Synced ${time}` : `Synced ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}
function normalizePickerDate(value: Date | string | null): Date | null {
  if (!value) return null;
  return typeof value === 'string' ? parseLocalDate(value) : value;
}
function presetRange(preset: Preset, today: string | null | undefined) {
  if (preset === 'max' || !today) return null;
  return completedReportRange(today, preset === '7d' ? 7 : preset === '90d' ? 90 : 30);
}

export default function ReportsHeader({
  payload, exportLinks, onUpdate, onRefresh, onOpenFilters,
  activeFilterCount, scopeName, isDemo = false, isPending = false,
}: ReportsHeaderProps) {
  const { query, meta } = payload;
  const rangeValue = useMemo(
    () => [query.dateFrom ? parseLocalDate(query.dateFrom) : null, query.dateTo ? parseLocalDate(query.dateTo) : null] as [Date | null, Date | null],
    [query.dateFrom, query.dateTo]
  );
  const [draftRange, setDraftRange] = useState<[Date | null, Date | null]>(rangeValue);
  // Reset the in-progress picker selection when the applied range changes (during render, not in an effect).
  const [appliedRange, setAppliedRange] = useState(rangeValue);
  if (appliedRange !== rangeValue) {
    setAppliedRange(rangeValue);
    setDraftRange(rangeValue);
  }

  const activeDateCount = useMemo(
    () => new Map((payload.activeDates?.days ?? []).map(item => [item.date, item.activeEntityCount])),
    [payload.activeDates]
  );
  const isMax = query.rangeMode === 'max';
  const activePreset: Preset | undefined = isMax ? 'max' : (['7d', '30d', '90d'] as const).find(preset => {
    const range = presetRange(preset, meta.today);
    return range?.dateFrom === query.dateFrom && range?.dateTo === query.dateTo;
  });
  const compareDisabledReason = isMax ? 'Comparison is unavailable for all saved history.' : meta.comparisonDisabledReason ?? null;
  // One period button: a popover on desktop, a bottom sheet on phones.
  const mobile = useMediaQuery('(max-width: 760px)');
  const [periodOpen, setPeriodOpen] = useState(false);
  // Two months on desktop end on the selected end date's month, so no empty future month shows.
  const anchor = draftRange[1] ?? draftRange[0];
  const calendarStart = anchor ? (mobile ? anchor : new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)) : undefined;
  const rollingPreset = activePreset && activePreset !== 'max' ? (Number(activePreset.replace('d', '')) as 7 | 30 | 90) : null;
  const periodSummary = `${isMax ? 'All saved history' : formatReportRange(query.dateFrom, query.dateTo)}${activePreset && activePreset !== 'max' ? ` · ${activePreset.toUpperCase()}` : ''} · ${query.groupBy === 'day' ? 'Daily' : query.groupBy === 'week' ? 'Weekly' : 'Monthly'}${query.compareMode === 'previous_period' ? ' · Compared' : ''}`;

  const applyPreset = (preset: Preset) => {
    if (preset === 'max') {
      onUpdate(params => {
        params.set('range', 'max');
        ['preset', 'date_from', 'date_to', 'group_by', 'compare'].forEach(key => params.delete(key));
      });
      return;
    }
    const range = presetRange(preset, meta.today);
    if (!range) return;
    setDraftRange([parseLocalDate(range.dateFrom), parseLocalDate(range.dateTo)]);
    onUpdate(params => {
      params.delete('range');
      params.delete('preset');
      params.set('date_from', range.dateFrom);
      params.set('date_to', range.dateTo);
    });
  };

  const controls = (
      <div className={classes.periodPanel} role="group" aria-label="Report period">
        <div className={classes.periodGroup}>
          <RangeSwitch
            label="Quick range"
            className={classes.quickRange}
            value={activePreset}
            pending={isPending}
            options={PRESETS.map(preset => ({ ...preset, disabled: preset.value !== 'max' && !presetRange(preset.value, meta.today) }))}
            onChange={applyPreset}
          />
          {!isMax ? (
            <DatePicker
              type="range"
              allowSingleDateInRange
              numberOfColumns={mobile ? 1 : 2}
              defaultDate={calendarStart}
              ariaLabels={{ previousMonth: 'Previous month', nextMonth: 'Next month' }}
              value={draftRange}
              onChange={value => {
                const start = normalizePickerDate(value[0]);
                const end = normalizePickerDate(value[1]);
                setDraftRange([start, end]);
                if (!start || !end) return;
                onUpdate(params => {
                  params.delete('range');
                  params.delete('preset');
                  params.set('date_from', toIsoDate(start));
                  params.set('date_to', toIsoDate(end));
                });
              }}
              maxDate={meta.today ? parseLocalDate(meta.today) : undefined}
              getDayProps={date => {
                const count = activeDateCount.get(toIsoDate(normalizePickerDate(date)!)) ?? 0;
                return count ? { title: `${count} selected ${payload.activeDates?.scope === 'campaign' ? 'campaign' : payload.activeDates?.scope === 'adset' ? 'ad set' : 'ad'}${count === 1 ? '' : 's'} serving` } : {};
              }}
              renderDay={date => {
                const resolved = normalizePickerDate(date);
                const count = resolved ? activeDateCount.get(toIsoDate(resolved)) ?? 0 : 0;
                return (
                  <div className={classes.calendarDay}>
                    <span>{resolved?.getDate() ?? ''}</span>
                    {count > 0 ? <span className={classes.calendarDot} /> : null}
                  </div>
                );
              }}
            />
          ) : null}
        </div>

        <div className={classes.periodGroup}>
          <Tooltip label={compareDisabledReason} disabled={!compareDisabledReason} multiline maw={280} withinPortal>
            <span>
              <Switch
                label="Compare to previous period"
                size="sm"
                // A reason that appears after turning comparison on must still let the user turn it off.
                disabled={(Boolean(compareDisabledReason) && query.compareMode !== 'previous_period') || isPending}
                checked={query.compareMode === 'previous_period'}
                onChange={event => {
                  const checked = event.currentTarget.checked;
                  onUpdate(params => params.set('compare', checked ? 'previous_period' : 'none'));
                }}
              />
            </span>
          </Tooltip>
        </div>

      </div>
  );

  return (
    <header className={classes.header}>
      <div className={classes.headerTop}>
        <div>
          <div className={classes.titleRow}>
            <h1 className={classes.title}>Reports</h1>
            {isDemo ? <span className={classes.demoBadge}>Demo data</span> : null}
          </div>
          <p className={classes.subtitle}>
            <strong>{scopeName}</strong> · {formatTimezone(meta.timezone)}
            {' · '}{meta.partialDay ? 'Includes today (partial day)'
              : meta.today && query.dateTo === shiftReportDay(meta.today, -1) ? 'Completed days, through yesterday' : 'Completed days'}
          </p>
        </div>

        <div className={classes.actions}>
          <Button
            leftSection={<IconAdjustmentsHorizontal size={16} />}
            radius="xl"
            variant="default"
            onClick={onOpenFilters}
          >
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </Button>
          <SavedViewsMenu rollingPreset={rollingPreset} isDemo={isDemo} />
          <Popover opened={periodOpen && !mobile} onChange={setPeriodOpen} position="bottom-end" shadow="md" radius="lg" trapFocus returnFocus withinPortal>
            <Popover.Target>
              <button type="button" className={classes.periodButton} onClick={() => setPeriodOpen(open => !open)} aria-haspopup="dialog" aria-expanded={periodOpen}>
                <IconCalendar size={16} aria-hidden="true" />
                <span>{periodSummary}</span>
                <IconChevronDown size={14} aria-hidden="true" />
              </button>
            </Popover.Target>
            <Popover.Dropdown aria-label="Report period">{!mobile && periodOpen ? controls : null}</Popover.Dropdown>
          </Popover>
          <Menu position="bottom-end" shadow="md" width={260}>
            <Menu.Target>
              <ActionIcon variant="default" radius="xl" size={36} aria-label="Export and reload" loading={isPending} className={classes.moreActions}>
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Export every section, current filters</Menu.Label>
              <Menu.Item component="a" href={exportLinks.pdf} leftSection={<IconFileTypePdf size={16} />}>PDF report</Menu.Item>
              <Menu.Item component="a" href={exportLinks.csv} leftSection={<IconFileSpreadsheet size={16} />}>CSV data</Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconRefresh size={16} />} onClick={onRefresh}>
                Reload saved data
                <span className={classes.menuHint}>{syncedLabel(meta.lastSyncedAt)}. Doesn’t fetch new data from Meta.</span>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      <Drawer opened={Boolean(mobile) && periodOpen} onClose={() => setPeriodOpen(false)} position="bottom" radius="lg" title="Report period" classNames={{ body: classes.periodSheet }} styles={{ content: { height: "auto", maxHeight: "90dvh", flex: "0 0 auto" } }}>
        {mobile && periodOpen ? controls : null}
        <Button fullWidth radius="xl" mt="md" onClick={() => setPeriodOpen(false)}>Done</Button>
      </Drawer>
    </header>
  );
}
