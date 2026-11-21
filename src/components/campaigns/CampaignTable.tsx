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
import { useTranslations } from 'next-intl';
import { useLabels } from '@/lib/client/hooks/useLabels';
import {
  EmptyRow,
  lastActivity,
  MetricCells,
  OpenRowCell,
  StatusHeader,
  rowKeys,
  useMetricColumnCount,
  MetricHeaders,
  MobileMetrics,
  RowActions, TruncatedName,
  rowMetrics,
  OpenNextButton,
  SortHeader,
  StatusCell,
  useTableRows,
} from './tableKit';
import { buildEntityReportUrl } from './reportLinks';
import type { TableRange } from '@/lib/shared/performance/periodTotals';
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
  /** Selected period; outside lifetime, rows without delivery say so instead of showing dashes. */
  range?: TableRange;
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
  range = 'lifetime',
}: CampaignTableProps) {
  const t = useTranslations('table');
  const labels = useLabels();
  const metricCount = useMetricColumnCount();
  const noDelivery = range === 'lifetime' ? null : t('noDelivery');
  // One click opens the campaign's ad sets; the row stays highlighted when you come back.
  const open = (id: string) => { onSelectCampaign(id); onOpenCampaign?.(id); };
  const scrollHeight = fillHeight ? '100%' : undefined;
  // Campaigns are compared only with campaigns sharing an objective: a lead and a sale are not the same result.
  const { sorted, sort, toggle, benchmarkFor } = useTableRows(
    campaigns,
    (campaign) => ({ name: campaign.name, metrics: rowMetrics(campaign) }),
    (campaign) => labels.objective(campaign.objective),
    (objective) => (objective === '—' ? t('group.campaigns') : t('group.objectiveCampaigns', { objective })),
  );
  const menuItems = (campaign: FormattedCampaign, reportHref: string) => (
    <>
      {onOpenCampaign ? (
        <Menu.Item leftSection={<IconStack2 size={16} />} onClick={() => onOpenCampaign(campaign.id)}>
          {t('openAdSets')}
        </Menu.Item>
      ) : null}
      <Menu.Item leftSection={<IconChartBar size={16} />} component="a" href={reportHref}>
        {t('viewAnalytics')}
      </Menu.Item>
    </>
  );

  return (
    <>
      <div className={classes.mobileEntityList}>
        {sorted.length === 0 ? (
          <div className={classes.emptyRow}>
            <Text fw={600} size="sm">{t('empty.campaignsTitle')}</Text>
            <Text size="sm" c="dimmed">{t('empty.campaignsHint')}</Text>
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
                onClick={() => open(campaign.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open(campaign.id);
                  }
                }}
              >
                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                  <div className={classes.mobileEntityTitleBlock}>
                    <Text lineClamp={2} className={classes.mobileCardTitle}>
                      {campaign.name}
                    </Text>
                    <Group gap={6} mt={6} wrap="wrap">
                      <StatusCell status={campaign.status} delivering={campaign.delivery} />
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {labels.objective(campaign.objective)}
                      </Text>
                    </Group>
                  </div>
                  <RowActions name={campaign.name}>{menuItems(campaign, reportHref)}</RowActions>
                </Group>

                <MobileMetrics metrics={rowMetrics(campaign)} currencyCode={currencyCode} benchmark={benchmarkFor(campaign)} />

                <Group justify="space-between" gap="sm" wrap="nowrap" className={classes.mobileFooter}>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {labels.displayDate(campaign.startDate)} – {labels.displayDate(lastActivity(campaign.endDate, campaign.lastDay, timezone))}
                  </Text>
                  {onOpenCampaign ? (
                    <OpenNextButton label={t('nextAdSets')} onOpen={() => onOpenCampaign(campaign.id)} />
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
            <SortHeader label={t('col.campaign')} sortKey="name" sort={sort} onSort={toggle} style={{ width: 320, minWidth: 240, maxWidth: 320 }} />
            <StatusHeader />
            <Table.Th className={classes.nowrap}>{t('col.objective')}</Table.Th>
            <MetricHeaders sort={sort} onSort={toggle} />
            <Table.Th className={classes.nowrap}>{t('col.firstActivity')}</Table.Th>
            <Table.Th className={classes.nowrap}>{t('col.lastActivity')}</Table.Th>
            <Table.Th className={classes.actionCell}><span className={classes.srOnly}>{t('col.actions')}</span></Table.Th>
            {onOpenCampaign ? <Table.Th className={classes.openCell}><span className={classes.srOnly}>{t('col.open')}</span></Table.Th> : null}
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {sorted.length === 0 ? (
            <EmptyRow
              colSpan={metricCount + (onOpenCampaign ? 7 : 6)}
              title={t('empty.campaignsTitle')}
              hint={t('empty.campaignsHint')}
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
                  onClick={() => open(campaign.id)}
                  {...rowKeys(() => open(campaign.id))}
                  aria-label={onOpenCampaign ? t('rowOpenAdSets', { name: campaign.name }) : campaign.name}
                >
                  <Table.Td style={{ width: 320, minWidth: 240, maxWidth: 320 }}>
                    <TruncatedName name={campaign.name} />
                    {range === 'lifetime' && !campaign.delivery && campaign.metricsAvailable !== false ? (
                      <Text size="xs" c="dimmed" className={classes.rowContext}>{t('notDeliveringNow')}</Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td><StatusCell status={campaign.status} delivering={campaign.delivery} /></Table.Td>
                  <Table.Td className={classes.nowrap}><Text size="sm">{labels.objective(campaign.objective)}</Text></Table.Td>
                  <MetricCells metrics={rowMetrics(campaign)} currencyCode={currencyCode} benchmark={benchmarkFor(campaign)} noDeliveryNote={noDelivery} />
                  <Table.Td className={classes.nowrap}><Text size="sm">{labels.displayDate(campaign.startDate)}</Text></Table.Td>
                  <Table.Td className={classes.nowrap}><Text size="sm">{labels.displayDate(lastActivity(campaign.endDate, campaign.lastDay, timezone))}</Text></Table.Td>
                  <Table.Td className={classes.actionCell}>
                    <RowActions name={campaign.name}>{menuItems(campaign, reportHref)}</RowActions>
                  </Table.Td>
                  {onOpenCampaign ? <OpenRowCell label={t('openAdSetsFor', { name: campaign.name })} onOpen={() => open(campaign.id)} /> : null}
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
