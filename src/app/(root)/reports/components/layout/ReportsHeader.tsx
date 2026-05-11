'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconAdjustmentsHorizontal,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconRefresh,
} from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import classes from '../ReportsClient.module.css';

interface ReportsHeaderProps {
  payload: ReportPayload;
  exportLinks: {
    pdf: string;
    csv: string;
  };
  onUpdate: (mutate: (params: URLSearchParams) => void) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  isDemo?: boolean;
  isPending?: boolean;
}

type QuickRangePreset = '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd' | 'max';

function toIsoDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function normalizePickerDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  return typeof value === 'string' ? parseLocalDate(value) : value;
}

function formatReadableDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function presetRange(
  preset: QuickRangePreset,
  maxRange: { dateFrom: string; dateTo: string } | null = null
) {
  if (preset === 'max') {
    return maxRange;
  }

  const anchor = maxRange ? parseLocalDate(maxRange.dateTo) : new Date();
  anchor.setHours(0, 0, 0, 0);
  const from = new Date(anchor);

  switch (preset) {
    case '7d':
      from.setDate(anchor.getDate() - 6);
      break;
    case '30d':
      from.setDate(anchor.getDate() - 29);
      break;
    case '90d':
      from.setDate(anchor.getDate() - 89);
      break;
    case 'mtd':
      from.setDate(1);
      break;
    case 'qtd':
      from.setMonth(Math.floor(anchor.getMonth() / 3) * 3, 1);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      break;
    default:
      from.setDate(anchor.getDate() - 29);
      break;
  }

  const resolvedDateFrom = maxRange && toIsoDate(from) < maxRange.dateFrom
    ? maxRange.dateFrom
    : toIsoDate(from);
  const resolvedDateTo = maxRange && toIsoDate(anchor) > maxRange.dateTo
    ? maxRange.dateTo
    : toIsoDate(anchor);

  return {
    dateFrom: resolvedDateFrom,
    dateTo: resolvedDateTo,
  };
}

function resolveActivePreset(
  dateFrom: string,
  dateTo: string,
  maxRange: { dateFrom: string; dateTo: string } | null
): QuickRangePreset | null {
  const presetValues: QuickRangePreset[] = ['max', '7d', '30d', '90d', 'mtd', 'qtd', 'ytd'];

  for (const preset of presetValues) {
    const range = presetRange(preset, maxRange);

    if (!range) {
      continue;
    }

    if (range.dateFrom === dateFrom && range.dateTo === dateTo) {
      return preset;
    }
  }

  return null;
}

export default function ReportsHeader({
  payload,
  exportLinks,
  onUpdate,
  onOpenFilters,
  activeFilterCount,
  isDemo = false,
  isPending = false,
}: ReportsHeaderProps) {
  const rangeValue = useMemo(
    () => [
      payload.query.dateFrom ? parseLocalDate(payload.query.dateFrom) : null,
      payload.query.dateTo ? parseLocalDate(payload.query.dateTo) : null,
    ] as [Date | null, Date | null],
    [payload.query.dateFrom, payload.query.dateTo]
  );
  const [draftRange, setDraftRange] = useState<[Date | null, Date | null]>(rangeValue);
  const activeDateCountByIso = useMemo(
    () => new Map((payload.activeDates?.days ?? []).map((item) => [item.date, item.activeEntityCount])),
    [payload.activeDates]
  );
  const maxRange = useMemo(() => {
    if (!payload.activeDates?.startDate || !payload.activeDates.endDate) {
      return null;
    }

    return {
      dateFrom: payload.activeDates.startDate,
      dateTo: payload.activeDates.endDate,
    };
  }, [payload.activeDates]);
  const activePreset = useMemo(
    () => resolveActivePreset(payload.query.dateFrom, payload.query.dateTo, maxRange),
    [maxRange, payload.query.dateFrom, payload.query.dateTo]
  );
  const isAccountLevelReport = payload.query.scope === 'ad_account';
  const reportDateSummary = `${formatReadableDate(payload.query.dateFrom) ?? 'Unknown'} through ${
    formatReadableDate(payload.query.dateTo) ?? 'Unknown'
  }`;

  useEffect(() => {
    setDraftRange(rangeValue);
  }, [rangeValue]);

  const presets: Array<{ value: QuickRangePreset; label: string }> = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: 'max', label: 'Max' },
  ];

  const activeDateSummary = payload.activeDates
    ? `${formatReadableDate(payload.activeDates.startDate) ?? 'Unknown'} through ${
        formatReadableDate(payload.activeDates.endDate) ?? 'Unknown'
      }`
    : null;

  const formatActiveEntityLabel = (count: number) => {
    if (!payload.activeDates) {
      return 'entities';
    }

    if (payload.activeDates.scope === 'campaign') {
      return count === 1 ? 'campaign' : 'campaigns';
    }

    if (payload.activeDates.scope === 'adset') {
      return count === 1 ? 'ad set' : 'ad sets';
    }

    return count === 1 ? 'ad' : 'ads';
  };

  return (
    <Card p={{ base: 'sm', md: 'md' }} radius="xl" withBorder className={classes.headerCard}>
      <Stack gap="sm">
        <Group
          justify="space-between"
          align="flex-start"
          gap="md"
          wrap="wrap"
          className={classes.headerTopRow}
        >
          <div className={classes.headerMeta}>
            <Group gap="xs" align="center" wrap="wrap">
              <Badge color="gray" variant="light" size="md">
                {payload.meta.businessName}
              </Badge>
              <Badge color="blue" variant="light" size="md">
                {payload.meta.scopeLabel}
              </Badge>
              {isDemo ? (
                <Badge color="cyan" variant="outline" size="md">
                  Demo data
                </Badge>
              ) : null}
              <Badge
                color={
                  isAccountLevelReport
                    ? 'blue'
                    : payload.query.compareMode === 'previous_period'
                      ? 'teal'
                      : 'gray'
                }
                variant="light"
                size="md"
              >
                {isAccountLevelReport
                  ? 'Full account history'
                  : payload.query.compareMode === 'previous_period'
                    ? 'Comparing previous period'
                    : 'Single range'}
              </Badge>
            </Group>
            <Text fw={900} size="1.65rem" mt="xs" className={classes.headerTitle}>
              {payload.meta.title}
            </Text>
          </div>

          <Group gap="xs" wrap="wrap" className={classes.headerActions}>
            <Button
              leftSection={<IconAdjustmentsHorizontal size={16} />}
              radius="xl"
              variant="default"
              className="app-platform-page-action-secondary"
              onClick={onOpenFilters}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            <Button
              component="a"
              href={exportLinks.pdf}
              leftSection={<IconFileTypePdf size={16} />}
              radius="xl"
              variant="filled"
              className="app-platform-page-action-primary"
            >
              Export PDF
            </Button>
            <Button
              component="a"
              href={exportLinks.csv}
              leftSection={<IconFileSpreadsheet size={16} />}
              radius="xl"
              variant="default"
              className="app-platform-page-action-secondary"
            >
              Export CSV
            </Button>
            <Tooltip label={isPending ? 'Refreshing…' : 'Refresh report'}>
              <ActionIcon
                size="lg"
                radius="xl"
                variant="default"
                className="app-platform-page-action-icon"
                onClick={() => onUpdate(() => undefined)}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <div className={classes.controlBar}>
          {isAccountLevelReport ? (
            <div className={classes.controlField}>
              <Text size="xs" fw={700} className={classes.controlLabel}>
                Range
              </Text>
              <div className={classes.compareField}>
                <Text size="sm" fw={700}>
                  Full account history · {reportDateSummary}
                </Text>
              </div>
            </div>
          ) : (
            <>
              <div className={classes.controlField}>
                <Text size="xs" fw={700} className={classes.controlLabel}>
                  Quick Range
                </Text>
                <div className={classes.presetRail}>
                  {presets.map((preset) => {
                    const isActive = activePreset === preset.value;
                    const range = presetRange(preset.value, maxRange);

                    return (
                      <Button
                        key={preset.value}
                        radius="xl"
                        size="xs"
                        variant={isActive ? 'filled' : 'light'}
                        color={isActive ? 'blue' : 'gray'}
                        className={classes.presetButton}
                        disabled={!range}
                        onClick={() => {
                          if (!range) {
                            return;
                          }

                          setDraftRange([
                            parseLocalDate(range.dateFrom),
                            parseLocalDate(range.dateTo),
                          ]);
                          onUpdate((params) => {
                            params.set('date_from', range.dateFrom);
                            params.set('date_to', range.dateTo);
                          });
                        }}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className={classes.controlField}>
                <Text size="xs" fw={700} className={classes.controlLabel}>
                  Date Range
                </Text>
                <DatePickerInput
                  type="range"
                  value={draftRange}
                  onChange={(value) => {
                    const start = normalizePickerDate(value[0]);
                    const end = normalizePickerDate(value[1]);

                    setDraftRange([start, end]);

                    if (!start || !end) {
                      return;
                    }

                    onUpdate((params) => {
                      params.set('date_from', toIsoDate(start));
                      params.set('date_to', toIsoDate(end));
                    });
                  }}
                  aria-label="Date range"
                  valueFormat="MMM D, YYYY"
                  radius="md"
                  size="sm"
                  placeholder="Select date range"
                  className={classes.controlInput}
                  minDate={maxRange ? parseLocalDate(maxRange.dateFrom) : undefined}
                  maxDate={maxRange ? parseLocalDate(maxRange.dateTo) : undefined}
                  getDayProps={(date) => {
                    const isoDate = toIsoDate(date);
                    const activeCount = activeDateCountByIso.get(isoDate) ?? 0;

                    if (activeCount === 0) {
                      return {};
                    }

                    return {
                      title: `${activeCount} selected ${formatActiveEntityLabel(activeCount)} serving`,
                      style: {
                        boxShadow: 'inset 0 0 0 1px rgba(249, 115, 22, 0.38)',
                      },
                    };
                  }}
                  renderDay={(date) => {
                    const isoDate = toIsoDate(date);
                    const activeCount = activeDateCountByIso.get(isoDate) ?? 0;
                    const resolvedDate = normalizePickerDate(date);

                    return (
                      <div className={classes.reportCalendarDay}>
                        <span>{resolvedDate?.getDate() ?? ''}</span>
                        {activeCount > 0 ? <span className={classes.reportCalendarDayDot} /> : null}
                      </div>
                    );
                  }}
                />
              </div>
            </>
          )}

          <div className={classes.controlField}>
            <Text size="xs" fw={700} className={classes.controlLabel}>
              Group By
            </Text>
            <Select
              aria-label="Group by"
              value={payload.query.groupBy}
              onChange={(value) => {
                if (!value) {
                  return;
                }

                onUpdate((params) => {
                  params.set('group_by', value);
                });
              }}
              data={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
              radius="md"
              size="sm"
              className={classes.groupBySelect}
              disabled={isAccountLevelReport}
            />
          </div>

          {isAccountLevelReport ? null : (
            <div className={classes.controlField}>
              <Text size="xs" fw={700} className={classes.controlLabel}>
                Compare
              </Text>
              <div className={classes.compareField}>
                <Switch
                  label="Previous period"
                  checked={payload.query.compareMode === 'previous_period'}
                  onChange={(event) => {
                    onUpdate((params) => {
                      params.set(
                        'compare',
                        event.currentTarget.checked ? 'previous_period' : 'none'
                      );
                    });
                  }}
                  color="blue"
                  size="md"
                />
              </div>
            </div>
          )}

          {payload.activeDates ? (
            <Group gap="xs" wrap="wrap" className={classes.activeDatesHint}>
              <span className={classes.activeDatesLegendDot} />
              <Text size="xs" c="dimmed">
                {payload.activeDates.label}. {payload.activeDates.totalActiveDays.toLocaleString()} active
                day{payload.activeDates.totalActiveDays === 1 ? '' : 's'} across {activeDateSummary}.
              </Text>
            </Group>
          ) : null}
        </div>
      </Stack>
    </Card>
  );
}
