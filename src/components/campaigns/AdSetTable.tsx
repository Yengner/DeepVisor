'use client';

import type { AdSetLifetimeRow } from '@/lib/server/data';
import { Button, Group, Menu, ScrollArea, Table, Text } from '@mantine/core';
import { IconChartBar, IconCopyPlus, IconPhoto } from '@tabler/icons-react';
import {
  EmptyRow,
  humanizeObjective,
  lastActivity,
  METRIC_COLUMN_COUNT,
  MetricCells,
  MetricHeaders,
  MobileMetrics,
  RowActions, TruncatedName,
  rowMetrics,
  OpenNextButton,
  SelectCell,
  SortHeader,
  StatusCell,
  TableSkeleton,
  useTableRows,
} from './tableKit';
import { buildEntityReportUrl } from './reportLinks';
import classes from './CampaignDashboard.module.css';

interface AdSetTableProps {
  adSets?: (AdSetLifetimeRow & { delivery?: boolean })[];
  loading?: boolean;
  onSelectAdSet?: (id: string) => void;
  onOpenAdSet?: (id: string) => void;
  onRunAgain?: (adSet: AdSetLifetimeRow) => void;
  selectedAdSetId?: string | null;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  currencyCode?: string | null;
  platformColor?: string;
  fillHeight?: boolean;
  timezone?: string | null;
}

const EMPTY_TITLE = 'No ad sets in this campaign';
const EMPTY_HINT = 'Ad sets appear here after the next Meta sync that includes them.';

export default function AdSetTable({
  adSets = [],
  loading = false,
  onSelectAdSet,
  onOpenAdSet,
  onRunAgain,
  selectedAdSetId,
  platformIntegrationId,
  adAccountId,
  currencyCode,
  platformColor = 'dark',
  fillHeight = false,
  timezone = null,
}: AdSetTableProps) {
  // Ad sets inside one campaign share its objective, so they form a single comparison group.
  const { sorted, sort, toggle, benchmarkFor } = useTableRows(
    adSets,
    (adSet) => ({ name: adSet.name, metrics: rowMetrics(adSet) }),
    () => 'all',
    () => 'ad sets in this campaign',
  );
  if (loading) return <TableSkeleton label="ad sets" />;

  const rows = sorted.map((adSet) => ({
    adSet,
    metrics: rowMetrics(adSet),
    benchmark: benchmarkFor(adSet),
    selected: selectedAdSetId === adSet.id,
    goal: humanizeObjective(adSet.optimization_goal || adSet.objective),
    last: lastActivity(adSet.end_date, adSet.last_day, timezone),
    reportHref: buildEntityReportUrl({
      scope: 'adset',
      platformIntegrationId,
      adAccountId,
      campaignId: adSet.campaign_id,
      adsetId: adSet.id,
      startDate: adSet.start_date,
      endDate: adSet.end_date,
    }),
  }));

  const menuItems = (adSet: AdSetLifetimeRow, reportHref: string) => (
    <>
      {onOpenAdSet ? (
        <Menu.Item leftSection={<IconPhoto size={16} />} onClick={() => onOpenAdSet(adSet.id)}>
          Open ads
        </Menu.Item>
      ) : null}
      {onRunAgain ? (
        <Menu.Item leftSection={<IconCopyPlus size={16} />} onClick={() => onRunAgain(adSet)}>
          Run again
        </Menu.Item>
      ) : null}
      <Menu.Item leftSection={<IconChartBar size={16} />} component="a" href={reportHref}>
        View analytics
      </Menu.Item>
    </>
  );

  return (
    <>
      <div className={classes.mobileEntityList}>
        {rows.length === 0 ? (
          <div className={classes.emptyRow}>
            <Text fw={600} size="sm">{EMPTY_TITLE}</Text>
            <Text size="sm" c="dimmed">{EMPTY_HINT}</Text>
          </div>
        ) : (
          rows.map(({ adSet, metrics, benchmark, selected, goal, last, reportHref }) => (
            <div
              key={adSet.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              className={classes.mobileEntityCard}
              data-delivering={adSet.delivery || undefined}
              data-selected={selected || undefined}
              onClick={() => onSelectAdSet?.(adSet.id)}
              onDoubleClick={() => onOpenAdSet?.(adSet.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectAdSet?.(adSet.id);
                }
              }}
            >
              <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <div className={classes.mobileEntityTitleBlock}>
                  <Text fw={700} size="sm" lineClamp={2}>{adSet.name}</Text>
                  <Group gap={6} mt={6} wrap="wrap">
                    <StatusCell status={adSet.status} delivering={adSet.delivery} />
                    <Text size="xs" c="dimmed" lineClamp={1}>{goal}</Text>
                  </Group>
                </div>
                <RowActions name={adSet.name}>{menuItems(adSet, reportHref)}</RowActions>
              </Group>

              <MobileMetrics metrics={metrics} currencyCode={currencyCode} benchmark={benchmark} />

              <Group justify="space-between" gap="sm" wrap="nowrap" mt="sm">
                <Text size="xs" c="dimmed" lineClamp={1} className={classes.mobileActivity}>
                  {adSet.start_date || '—'} – {last}
                </Text>
                <Group gap={4} wrap="nowrap" className={classes.mobileEntityActions}>
                  {onOpenAdSet ? <OpenNextButton label="Ads" onOpen={() => onOpenAdSet(adSet.id)} /> : null}
                  {onRunAgain ? (
                    <Button
                      size="compact-xs"
                      variant="light"
                      color={platformColor}
                      leftSection={<IconCopyPlus size={14} />}
                      className={classes.mobileRunAgainButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRunAgain(adSet);
                      }}
                    >
                      Run again
                    </Button>
                  ) : null}
                </Group>
              </Group>
            </div>
          ))
        )}
      </div>

      <ScrollArea
        className={classes.desktopDataTable}
        h={fillHeight ? '100%' : undefined}
        type="auto"
        offsetScrollbars="present"
        style={{ borderRadius: 8, height: fillHeight ? '100%' : undefined }}
      >
        <Table
          highlightOnHover
          stickyHeader
          verticalSpacing="sm"
          horizontalSpacing="md"
          withColumnBorders={false}
          style={{ minWidth: 1100, tableLayout: 'auto', marginBottom: fillHeight ? 18 : undefined }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 48, minWidth: 48 }}><span className={classes.srOnly}>Select</span></Table.Th>
              <SortHeader label="Ad set" sortKey="name" sort={sort} onSort={toggle} style={{ width: 320, maxWidth: 320 }} />
              <Table.Th className={classes.nowrap}>Status</Table.Th>
              <Table.Th className={classes.nowrap}>Optimization</Table.Th>
              <MetricHeaders sort={sort} onSort={toggle} />
              <Table.Th className={classes.nowrap}>First activity</Table.Th>
              <Table.Th className={classes.nowrap}>Last activity</Table.Th>
              <Table.Th className={classes.actionCell}><span className={classes.srOnly}>Actions</span></Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={METRIC_COLUMN_COUNT + 7} title={EMPTY_TITLE} hint={EMPTY_HINT} />
            ) : (
              rows.map(({ adSet, metrics, benchmark, selected, goal, last, reportHref }) => (
                <Table.Tr
                  key={adSet.id}
                  data-delivering={adSet.delivery || undefined}
                  data-selected={selected || undefined}
                  aria-selected={selected}
                  style={{ cursor: onSelectAdSet ? 'pointer' : 'default' }}
                  onClick={() => onSelectAdSet?.(adSet.id)}
                  onDoubleClick={() => onOpenAdSet?.(adSet.id)}
                >
                  <Table.Td>
                    <SelectCell
                      selected={selected}
                      disabled={!onSelectAdSet}
                      label={`Select ${adSet.name}`}
                      onSelect={() => onSelectAdSet?.(adSet.id)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: 320, maxWidth: 320 }}>
                    <TruncatedName name={adSet.name} />
                  </Table.Td>
                  <Table.Td><StatusCell status={adSet.status} delivering={adSet.delivery} /></Table.Td>
                  <Table.Td className={classes.nowrap}><Text size="sm">{goal}</Text></Table.Td>
                  <MetricCells metrics={metrics} currencyCode={currencyCode} benchmark={benchmark} />
                  <Table.Td className={classes.nowrap}><Text size="sm">{adSet.start_date || '—'}</Text></Table.Td>
                  <Table.Td className={classes.nowrap}><Text size="sm">{last}</Text></Table.Td>
                  <Table.Td className={classes.actionCell}>
                    <RowActions name={adSet.name}>{menuItems(adSet, reportHref)}</RowActions>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </>
  );
}
