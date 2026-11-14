'use client';

import { useMemo, useState } from 'react';
import { ActionIcon, Button, Drawer, Menu, Select, Switch, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import {
  IconAdjustmentsHorizontal,
  IconCalendar,
  IconChevronDown,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-react';
import { askDeepVisor } from '@/lib/shared/assistant/askEvent';
import { reportQuestions } from '@/lib/shared/reports/ask';
import { SavedViewsMenu } from './SavedViewsMenu';
import { completedReportRange } from '@/lib/shared/reports/dates';
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
  { value: '7d', label: '7D', title: 'Last 7 completed days' },
  { value: '30d', label: '30D', title: 'Last 30 completed days' },
  { value: '90d', label: '90D', title: 'Last 90 completed days' },
  { value: 'max', label: 'All', title: 'All saved history' },
];
const GROUPS = [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }] as const;

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
  payload, filterOptions, exportLinks, onUpdate, onRefresh, onOpenFilters,
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
  const showAccountSelect = filterOptions.adAccounts.length > 1;
  // Phones get one summary button that opens the period controls in a sheet.
  const mobile = useMediaQuery('(max-width: 760px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const questions = useMemo(() => (isDemo ? [] : reportQuestions(payload, scopeName)), [isDemo, payload, scopeName]);
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
      <div className={classes.toolbar} role="group" aria-label="Report period">
        <div className={classes.toolbarGroup}>
          <div className={classes.segmented} role="group" aria-label="Quick range">
            {PRESETS.map(preset => (
              <button
                key={preset.value}
                type="button"
                title={preset.title}
                aria-pressed={activePreset === preset.value}
                disabled={isPending || (preset.value !== 'max' && !presetRange(preset.value, meta.today))}
                onClick={() => applyPreset(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {!isMax ? (
            <DatePickerInput
              type="range"
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
              aria-label="Date range"
              valueFormat="MMM D, YYYY"
              leftSection={<IconCalendar size={16} />}
              radius="xl"
              size="sm"
              className={classes.rangeInput}
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

        <span className={classes.toolbarDivider} aria-hidden="true" />

        <div className={classes.toolbarGroup}>
          {!isMax ? (
            <div className={classes.segmented} role="group" aria-label="Group chart by">
              {GROUPS.map(group => (
                <button
                  key={group.value}
                  type="button"
                  aria-pressed={query.groupBy === group.value}
                  disabled={isPending}
                  onClick={() => onUpdate(params => params.set('group_by', group.value))}
                >
                  {group.label}
                </button>
              ))}
            </div>
          ) : null}
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

        {showAccountSelect ? (
          <Select
            aria-label="Ad account"
            searchable
            size="sm"
            radius="xl"
            className={classes.accountSelect}
            value={query.adAccountIds.length === 1 ? query.adAccountIds[0] : null}
            placeholder={query.adAccountIds.length > 1 ? 'Multiple accounts' : 'All accounts'}
            data={filterOptions.adAccounts.map(account => ({ value: account.id, label: account.label }))}
            onChange={value => {
              if (!value) return;
              onUpdate(params => {
                params.set('ad_account_id', value);
                ['campaign_id', 'adset_id', 'ad_id', 'platform_integration_id'].forEach(key => params.delete(key));
                if (activePreset && activePreset !== 'max') {
                  params.set('preset', activePreset.replace('d', ''));
                  params.delete('date_from');
                  params.delete('date_to');
                }
              });
            }}
          />
        ) : null}
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
            <strong>{scopeName}</strong> · {formatReportRange(query.dateFrom, query.dateTo)} · {formatTimezone(meta.timezone)}
            {meta.partialDay ? ' · Includes today (partial day)' : ''}
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
          {questions.length ? (
            <Menu position="bottom-end" shadow="md" width={320}>
              <Menu.Target>
                <Button leftSection={<IconSparkles size={16} />} rightSection={<IconChevronDown size={14} />} radius="xl" variant="light">
                  Ask
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Ask DeepVisor about this report</Menu.Label>
                {questions.map(item => (
                  <Menu.Item key={item.id} onClick={() => askDeepVisor(item.question)}>{item.label}</Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Label>Opens a draft you can edit before sending</Menu.Label>
              </Menu.Dropdown>
            </Menu>
          ) : null}
          <SavedViewsMenu rollingPreset={rollingPreset} isDemo={isDemo} />
          <Menu position="bottom-end" shadow="md" width={260}>
            <Menu.Target>
              <Button leftSection={<IconDownload size={16} />} rightSection={<IconChevronDown size={14} />} radius="xl" className="app-platform-page-action-primary">
                Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Every section · current filters</Menu.Label>
              <Menu.Item component="a" href={exportLinks.pdf} leftSection={<IconFileTypePdf size={16} />}>PDF report</Menu.Item>
              <Menu.Item component="a" href={exportLinks.csv} leftSection={<IconFileSpreadsheet size={16} />}>CSV data</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Tooltip label={isPending ? 'Reloading…' : 'Reload saved data (does not sync Meta)'}>
            <ActionIcon aria-label="Reload saved report data" size={36} radius="xl" variant="default" onClick={onRefresh} disabled={isPending}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      <button type="button" className={classes.mobilePeriod} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
        <IconCalendar size={16} aria-hidden="true" />
        <span>{periodSummary}</span>
        <IconChevronDown size={14} aria-hidden="true" />
      </button>
      {!mobile ? controls : null}
      <Drawer opened={Boolean(mobile) && sheetOpen} onClose={() => setSheetOpen(false)} position="bottom" radius="lg" title="Report period" classNames={{ body: classes.periodSheet }} styles={{ content: { height: "auto", maxHeight: "90dvh", flex: "0 0 auto" } }}>
        {mobile ? controls : null}
        <Button fullWidth radius="xl" mt="md" onClick={() => setSheetOpen(false)}>Done</Button>
      </Drawer>
    </header>
  );
}
