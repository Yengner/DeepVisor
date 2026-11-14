'use client';

import type { FormattedCampaign } from '@/app/(root)/campaigns/page';
import {
  Group,
  Menu,
  ScrollArea,
  Table,
  Text,
} from '@mantine/core';
import { IconChartBar, IconStack2 } from '@tabler/icons-react';
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
  useTableRows,
} from './tableKit';
import { buildEntityReportUrl } from './reportLinks';
import classes from './CampaignDashboard.module.css';

interface CampaignTableProps {
  campaigns: FormattedCampaign[];
  selectedCampaignId?: string;
  onSelectCampaign: (campaignId: string) => void;
  onOpenCampaign?: (campaignId: string) => void;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  currencyCode?: string | null;
  platformColor?: string;
  fillHeight?: boolean;
  timezone?: string | null;
}

export default function CampaignTable({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onOpenCampaign,
  platformIntegrationId,
  adAccountId,
  currencyCode,
  fillHeight = false,
  timezone = null,
}: CampaignTableProps) {
  const scrollHeight = fillHeight ? '100%' : undefined;
  // Campaigns are compared only with campaigns sharing an objective: a lead and a sale are not the same result.
  const { sorted, sort, toggle, benchmarkFor } = useTableRows(
    campaigns,
    (campaign) => ({ name: campaign.name, metrics: rowMetrics(campaign) }),
    (campaign) => humanizeObjective(campaign.objective),
    (objective) => (objective === '—' ? 'campaigns' : `${objective} campaigns`),
  );
  const menuItems = (campaign: FormattedCampaign, reportHref: string) => (
    <>
      {onOpenCampaign ? (
        <Menu.Item leftSection={<IconStack2 size={16} />} onClick={() => onOpenCampaign(campaign.id)}>
          Open ad sets
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
        {sorted.length === 0 ? (
          <div className={classes.emptyRow}>
            <Text fw={600} size="sm">No campaigns match these filters</Text>
            <Text size="sm" c="dimmed">Clear the search or filters to see every campaign.</Text>
          </div>
        ) : (
          sorted.map((campaign) => {
            const selected = selectedCampaignId === campaign.id;
            const reportHref = buildEntityReportUrl({
              scope: 'campaign',
              platformIntegrationId,
              adAccountId,
              campaignId: campaign.id,
              startDate: campaign.startDate,
              endDate: campaign.endDate,
            });

            return (
              <div
                key={campaign.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                className={classes.mobileEntityCard}
                data-delivering={campaign.delivery || undefined}
                data-selected={selected || undefined}
                onClick={() => onSelectCampaign(campaign.id)}
                onDoubleClick={() => onOpenCampaign?.(campaign.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectCampaign(campaign.id);
                  }
                }}
              >
                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                  <div className={classes.mobileEntityTitleBlock}>
                    <Text fw={700} size="sm" lineClamp={2}>
                      {campaign.name}
                    </Text>
                    <Group gap={6} mt={6} wrap="wrap">
                      <StatusCell status={campaign.status} delivering={campaign.delivery} />
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {humanizeObjective(campaign.objective)}
                      </Text>
                    </Group>
                  </div>
                  <RowActions name={campaign.name}>{menuItems(campaign, reportHref)}</RowActions>
                </Group>

                <MobileMetrics metrics={rowMetrics(campaign)} currencyCode={currencyCode} benchmark={benchmarkFor(campaign)} />

                <Group justify="space-between" gap="sm" wrap="nowrap" mt="sm">
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {campaign.startDate || '—'} – {lastActivity(campaign.endDate, campaign.lastDay, timezone)}
                  </Text>
                  {onOpenCampaign ? (
                    <OpenNextButton label="Ad sets" onOpen={() => onOpenCampaign(campaign.id)} />
                  ) : null}
                </Group>
              </div>
            );
          })
        )}
      </div>

    <ScrollArea
      className={classes.desktopDataTable}
      h={scrollHeight}
      type="auto"
      style={{ borderRadius: 8, height: fillHeight ? '100%' : undefined }}
      offsetScrollbars="present"
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
            <SortHeader label="Campaign" sortKey="name" sort={sort} onSort={toggle} style={{ width: 320, maxWidth: 320 }} />
            <Table.Th className={classes.nowrap}>Status</Table.Th>
            <Table.Th className={classes.nowrap}>Objective</Table.Th>
            <MetricHeaders sort={sort} onSort={toggle} />
            <Table.Th className={classes.nowrap}>First activity</Table.Th>
            <Table.Th className={classes.nowrap}>Last activity</Table.Th>
            <Table.Th className={classes.actionCell}><span className={classes.srOnly}>Actions</span></Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {sorted.length === 0 ? (
            <EmptyRow
              colSpan={METRIC_COLUMN_COUNT + 7}
              title="No campaigns match these filters"
              hint="Clear the search or filters to see every campaign."
            />
          ) : (
            sorted.map((campaign) => {
              const selected = selectedCampaignId === campaign.id;
              const reportHref = buildEntityReportUrl({
                scope: 'campaign',
                platformIntegrationId,
                adAccountId,
                campaignId: campaign.id,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
              });

              return (
                <Table.Tr
                  data-delivering={campaign.delivery || undefined}
                  data-selected={selected || undefined}
                  aria-selected={selected}
                  key={campaign.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectCampaign(campaign.id)}
                  onDoubleClick={() => onOpenCampaign?.(campaign.id)}
                >
                  <Table.Td>
                    <SelectCell selected={selected} label={`Select ${campaign.name}`} onSelect={() => onSelectCampaign(campaign.id)} />
                  </Table.Td>
                  <Table.Td style={{ width: 320, maxWidth: 320 }}>
                    <TruncatedName name={campaign.name} />
                  </Table.Td>
                  <Table.Td><StatusCell status={campaign.status} delivering={campaign.delivery} /></Table.Td>
                  <Table.Td className={classes.nowrap}><Text size="sm">{humanizeObjective(campaign.objective)}</Text></Table.Td>
                  <MetricCells metrics={rowMetrics(campaign)} currencyCode={currencyCode} benchmark={benchmarkFor(campaign)} />
                  <Table.Td className={classes.nowrap}><Text size="sm">{campaign.startDate || '—'}</Text></Table.Td>
                  <Table.Td className={classes.nowrap}><Text size="sm">{lastActivity(campaign.endDate, campaign.lastDay, timezone)}</Text></Table.Td>
                  <Table.Td className={classes.actionCell}>
                    <RowActions name={campaign.name}>{menuItems(campaign, reportHref)}</RowActions>
                  </Table.Td>
                </Table.Tr>
              );
            })
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
    </>
  );
}
