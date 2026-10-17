'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  Menu,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconAdjustmentsHorizontal,
  IconChevronDown,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconRefresh,
} from '@tabler/icons-react';
import { completedReportRange } from '@/lib/shared/reports/dates';
import type { ReportFilterOptions, ReportPayload } from '@/lib/server/reports/types';
import classes from '../ReportsClient.module.css';

interface ReportsHeaderProps {
  payload: ReportPayload;
  filterOptions: ReportFilterOptions;
  exportLinks: {
    pdf: string;
    csv: string;
  };
  onUpdate: (mutate: (params: URLSearchParams) => void) => void;
  onRefresh: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  isDemo?: boolean;
  isPending?: boolean;
}

type QuickRangePreset = '7d' | '30d' | '90d' | 'max';

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

function presetRange(preset: QuickRangePreset, today: string | null | undefined) {
  if (preset === 'max' || !today) return null;
  return completedReportRange(today, preset === '7d' ? 7 : preset === '90d' ? 90 : 30);
}

export default function ReportsHeader({
  payload,
  filterOptions,
  exportLinks,
  onUpdate,
  onRefresh,
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
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const activeDateCountByIso = useMemo(
    () => new Map((payload.activeDates?.days ?? []).map((item) => [item.date, item.activeEntityCount])),
    [payload.activeDates]
  );
  const isMaxRangeReport = payload.query.rangeMode === 'max';
  const isSummaryRangeReport = isMaxRangeReport;
  const activePreset = isMaxRangeReport ? 'max' : (['7d', '30d', '90d'] as const).find(preset => {
    const range = presetRange(preset, payload.meta.today);
    return range?.dateFrom === payload.query.dateFrom && range?.dateTo === payload.query.dateTo;
  });
  const reportDateSummary = `${formatReadableDate(payload.query.dateFrom) ?? 'Unknown'} through ${
    formatReadableDate(payload.query.dateTo) ?? 'Unknown'
  }`;

  useEffect(() => {
    setDraftRange(rangeValue);
  }, [rangeValue]);

  const presets: Array<{ value: QuickRangePreset; label: string }> = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
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
              <Badge color="dark" variant="light" size="md">
                {payload.meta.scopeLabel}
              </Badge>
              {isDemo ? (
                <Badge color="cyan.9" variant="outline" size="md">
                  Demo data
                </Badge>
              ) : null}
            </Group>
            <Text fw={900} size="1.65rem" mt="xs" className={classes.headerTitle}>
              Reports
            </Text>
            <Text size="sm" c="#626b5b" mt={4}>
              {reportDateSummary} · {payload.meta.timezone ?? "Timezone unknown"}{payload.meta.partialDay ? " · Partial day" : ""}
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
            <Menu position="bottom-end" shadow="md" width={250}>
              <Menu.Target>
                <Button
                  leftSection={<IconDownload size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                  radius="xl"
                  variant="filled"
                  color="#075f3b"
                  className="app-platform-page-action-primary"
                >
                  Export
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>All sections · selected scope</Menu.Label>
                <Menu.Item component="a" href={exportLinks.pdf} leftSection={<IconFileTypePdf size={16} />}>
                  Complete report · PDF
                </Menu.Item>
                <Menu.Item component="a" href={exportLinks.csv} leftSection={<IconFileSpreadsheet size={16} />}>
                  All report data · CSV
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Tooltip label={isPending ? 'Reloading…' : 'Reload saved report data (does not sync Meta)'}>
              <ActionIcon
                aria-label="Reload saved report data"
                size="lg"
                radius="xl"
                variant="default"
                className="app-platform-page-action-icon"
                onClick={onRefresh}
                disabled={isPending}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Group gap="md" align="flex-end" wrap="wrap">
          <Select label="Ad account" aria-label="Ad account" searchable
            style={{ flex: '1 1 220px', minWidth: 0 }}
            value={payload.query.adAccountIds.length === 1 ? payload.query.adAccountIds[0] : null}
            placeholder={payload.query.adAccountIds.length > 1 ? 'Multiple accounts selected' : 'All authorized accounts'}
            data={filterOptions.adAccounts.map(account => ({ value: account.id, label: account.label }))}
            onChange={value => {
              if (!value) return;
              onUpdate(params => {
                params.set('ad_account_id', value);
                ['campaign_id', 'adset_id', 'ad_id', 'platform_integration_id'].forEach(key => params.delete(key));
                if (activePreset && activePreset !== 'max') {
                  params.set('preset', activePreset.replace('d', ''));
                  params.delete('date_from'); params.delete('date_to');
                }
              });
            }} />
          <Switch label="Compare previous period" size="md" color="green"
            disabled={isSummaryRangeReport || Boolean(payload.meta.comparisonDisabledReason)}
            checked={payload.query.compareMode === 'previous_period'}
            onChange={event => { const checked = event.currentTarget.checked; onUpdate(params => params.set('compare', checked ? 'previous_period' : 'none')); }} />
        </Group>

        <div
          className={`${classes.controlBar} ${isSummaryRangeReport ? classes.controlBarSummary : ''}`}
        >
            <>
              <div className={classes.controlField}>
                <Text size="xs" fw={700} className={classes.controlLabel}>
                  Quick Range
                </Text>
                <div className={classes.presetRail}>
                  {presets.map((preset) => {
                    const isActive = activePreset === preset.value;
                    const range = presetRange(preset.value, payload.meta.today);
                    const isMaxPreset = preset.value === 'max';

                    return (
                      <Button
                        key={preset.value}
                        radius="xl"
                        size="xs"
                        variant={isActive ? 'filled' : 'light'}
                        color={isActive ? 'dark' : 'gray.8'}
                        c={isActive ? '#ffffff' : '#4d5946'}
                        className={classes.presetButton}
                        aria-pressed={isActive}
                        disabled={isPending || (!range && !isMaxPreset)}
                        onClick={() => {
                          if (isMaxPreset) {
                            if (range) {
                              setDraftRange([
                                parseLocalDate(range.dateFrom),
                                parseLocalDate(range.dateTo),
                              ]);
                            }

                            onUpdate((params) => {
                              params.set('range', 'max');
                              params.delete('preset');
                              params.delete('date_from');
                              params.delete('date_to');
                              params.delete('group_by');
                              params.delete('compare');
                            });
                            return;
                          }

                          if (!range) {
                            return;
                          }

                          setDraftRange([
                            parseLocalDate(range.dateFrom),
                            parseLocalDate(range.dateTo),
                          ]);
                          onUpdate((params) => {
                            params.delete('range');
                        params.delete('preset');
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

              {!isMaxRangeReport ? (
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
                        params.delete('range');
                        params.delete('preset');
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

                    maxDate={payload.meta.today ? parseLocalDate(payload.meta.today) : undefined}
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
              ) : null}
            </>

          <Button
              variant="subtle"
              color="dark"
              rightSection={
                <IconChevronDown
                  size={14}
                  className={moreOptionsOpen ? classes.chevronOpen : classes.chevron}
                />
              }
              onClick={() => setMoreOptionsOpen((current) => !current)}
              aria-expanded={moreOptionsOpen}
              className={classes.moreOptionsButton}
            >
              More options
            </Button>
        </div>

        <Collapse in={moreOptionsOpen}>
          <div className={classes.advancedControlBar}>
            <Button variant="default" onClick={() => onUpdate(params => {
              params.set('range', 'max');
              ['preset', 'date_from', 'date_to', 'group_by', 'compare'].forEach(key => params.delete(key));
            })}>All saved history</Button>
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
              />
            </div>

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
        </Collapse>
      </Stack>
    </Card>
  );
}
