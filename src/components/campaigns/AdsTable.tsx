'use client';

import { MediaImage } from './exploration/AdvertisingExplorer';

import type { AdLifetimeRow } from '@/lib/server/data';
import { Button, Group, Menu, ScrollArea, Table, Text } from '@mantine/core';
import { IconChartBar, IconCopyPlus, IconExternalLink } from '@tabler/icons-react';
import {
  EmptyRow,
  lastActivity,
  METRIC_COLUMN_COUNT,
  MetricCells,
  MetricHeaders,
  MobileMetrics,
  RowActions, TruncatedName,
  rowMetrics,
  SelectCell,
  SortHeader,
  StatusCell,
  TableSkeleton,
  useTableRows,
} from './tableKit';
import { buildEntityReportUrl } from './reportLinks';
import classes from './CampaignDashboard.module.css';

interface AdsTableProps {
  ads?: (AdLifetimeRow & { delivery?: boolean })[];
  loading?: boolean;
  selectedAdId?: string | null;
  onSelectAd?: (id: string) => void;
  onOpenAd?: (id: string) => void;
  onRunAgain?: (ad: AdLifetimeRow) => void;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  currencyCode?: string | null;
  platformColor?: string;
  fillHeight?: boolean;
  timezone?: string | null;
}

const EMPTY_TITLE = 'No ads in this ad set';
const EMPTY_HINT = 'Ads appear here after the next Meta sync that includes them.';

/** Only formats with an unambiguous owner-facing label; Meta's SHARE/STATUS types are omitted. */
const FORMAT_LABELS: Record<string, string> = {
  VIDEO: 'Video',
  PHOTO: 'Image',
  IMAGE: 'Image',
  CAROUSEL: 'Carousel',
};
function formatLabel(value?: string | null): string | null {
  return value ? FORMAT_LABELS[value.toUpperCase()] ?? null : null;
}

export default function AdsTable({
  ads = [],
  loading = false,
  selectedAdId,
  onSelectAd,
  onOpenAd,
  onRunAgain,
  platformIntegrationId,
  adAccountId,
  currencyCode,
  platformColor = 'dark',
  fillHeight = false,
  timezone = null,
}: AdsTableProps) {
  const { sorted, sort, toggle, benchmarkFor } = useTableRows(
    ads,
    (ad) => ({ name: ad.name || 'Unnamed ad', metrics: rowMetrics(ad) }),
    () => 'all',
    () => 'ads in this ad set',
  );
  if (loading) return <TableSkeleton label="ads" />;

  const rows = sorted.map((ad) => {
    const id = ad.ad_id ?? ad.id;
    return {
      ad,
      id,
      name: ad.name || 'Unnamed ad',
      metrics: rowMetrics(ad),
      benchmark: benchmarkFor(ad),
      selected: selectedAdId === id,
      format: formatLabel(ad.ad_format),
      last: lastActivity(ad.end_date, ad.last_day, timezone),
      previewImage: ad.creativePreview?.image ?? null,
      reportHref: buildEntityReportUrl({
        scope: 'ad',
        platformIntegrationId,
        adAccountId,
        campaignId: ad.campaign_id,
        adsetId: ad.adset_id,
        adId: id,
        startDate: ad.start_date,
        endDate: ad.end_date,
      }),
    };
  });

  const menuItems = (ad: AdLifetimeRow, previewImage: string | null, reportHref: string) => (
    <>
      {onRunAgain ? (
        <Menu.Item leftSection={<IconCopyPlus size={16} />} onClick={() => onRunAgain(ad)}>
          Run again
        </Menu.Item>
      ) : null}
      {previewImage ? (
        <Menu.Item
          leftSection={<IconExternalLink size={16} />}
          component="a"
          href={previewImage}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open creative
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
          rows.map(({ ad, id, name, metrics, benchmark, selected, format, last, previewImage, reportHref }) => (
            <div
              key={id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              className={classes.mobileEntityCard}
              data-delivering={ad.delivery || undefined}
              data-selected={selected || undefined}
              onClick={() => onSelectAd?.(id)}
              onDoubleClick={() => onOpenAd?.(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectAd?.(id);
                }
              }}
            >
              <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" className={classes.mobileEntityTitleBlock}>
                  <div className={`${classes.thumb} ${classes.thumbLarge}`}>
                    <MediaImage media={ad.creativePreview} name={name} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} size="sm" lineClamp={2}>{name}</Text>
                    <Group gap={6} mt={6} wrap="wrap">
                      <StatusCell status={ad.status} delivering={ad.delivery} />
                      {format ? <Text size="xs" c="dimmed">{format}</Text> : null}
                    </Group>
                  </div>
                </Group>
                <RowActions name={name}>{menuItems(ad, previewImage, reportHref)}</RowActions>
              </Group>

              <MobileMetrics metrics={metrics} currencyCode={currencyCode} benchmark={benchmark} />

              <Group justify="space-between" gap="sm" wrap="nowrap" mt="sm">
                <Text size="xs" c="dimmed" lineClamp={1} className={classes.mobileActivity}>
                  {ad.start_date || '—'} – {last}
                </Text>
                {onRunAgain ? (
                  <Button
                    size="compact-xs"
                    variant="light"
                    color={platformColor}
                    leftSection={<IconCopyPlus size={14} />}
                    className={classes.mobileRunAgainButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRunAgain(ad);
                    }}
                  >
                    Run again
                  </Button>
                ) : null}
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
              <SortHeader label="Ad" sortKey="name" sort={sort} onSort={toggle} style={{ width: 360, maxWidth: 360 }} />
              <Table.Th className={classes.nowrap}>Status</Table.Th>
              <MetricHeaders sort={sort} onSort={toggle} />
              <Table.Th className={classes.nowrap}>First activity</Table.Th>
              <Table.Th className={classes.nowrap}>Last activity</Table.Th>
              <Table.Th className={classes.actionCell}><span className={classes.srOnly}>Actions</span></Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={METRIC_COLUMN_COUNT + 6} title={EMPTY_TITLE} hint={EMPTY_HINT} />
            ) : (
              rows.map(({ ad, id, name, metrics, benchmark, selected, format, last, previewImage, reportHref }) => (
                <Table.Tr
                  key={id}
                  data-delivering={ad.delivery || undefined}
                  data-selected={selected || undefined}
                  aria-selected={selected}
                  style={{ cursor: onSelectAd ? 'pointer' : 'default' }}
                  onClick={() => onSelectAd?.(id)}
                  onDoubleClick={() => onOpenAd?.(id)}
                >
                  <Table.Td>
                    <SelectCell
                      selected={selected}
                      disabled={!onSelectAd}
                      label={`Select ${name}`}
                      onSelect={() => onSelectAd?.(id)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: 360, maxWidth: 360 }}>
                    <div className={classes.adIdentity}>
                      <div className={classes.thumb}>
                        <MediaImage media={ad.creativePreview} name={name} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <TruncatedName name={name} />
                        {format ? <Text size="xs" c="dimmed">{format}</Text> : null}
                      </div>
                    </div>
                  </Table.Td>
                  <Table.Td><StatusCell status={ad.status} delivering={ad.delivery} /></Table.Td>
                  <MetricCells metrics={metrics} currencyCode={currencyCode} benchmark={benchmark} />
                  <Table.Td className={classes.nowrap}><Text size="sm">{ad.start_date || '—'}</Text></Table.Td>
                  <Table.Td className={classes.nowrap}><Text size="sm">{last}</Text></Table.Td>
                  <Table.Td className={classes.actionCell}>
                    <RowActions name={name}>{menuItems(ad, previewImage, reportHref)}</RowActions>
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
