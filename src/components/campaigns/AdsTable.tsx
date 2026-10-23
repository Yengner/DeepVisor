'use client';

import { MediaImage } from './exploration/AdvertisingExplorer';
import { DeliveryIndicator } from './DeliveryIndicator';

import type { AdLifetimeRow } from '@/lib/server/data';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  Paper,
  ScrollArea,
  Skeleton,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconChartBar,
  IconCheck,
  IconCircle,
  IconCopyPlus,
  IconDots,
  IconEye,
} from '@tabler/icons-react';
import StatusBadge from './StatusBadge';
import { buildEntityReportUrl } from './reportLinks';
import { formatRecordedCurrency as formatCurrencyAmount } from './metrics';
import classes from './CampaignDashboard.module.css';

const BG = 'var(--mantine-color-body)';
const BORDER = 'var(--mantine-color-gray-3)';
const Z_HEADER = 2;
const Z_STICKY_RIGHT = 4;
const RIGHT_COL_WIDTH = 24;

const fmtPct = (n?: number) => {
  if (n == null || !Number.isFinite(n)) {
    return '0%';
  }

  return `${n.toFixed(2)}%`;
};

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
}: AdsTableProps) {
  const maxRowsBeforeScroll = 12;
  const headerH = 44;
  const rowH = 48;
  const rows = ads.length;
  const tableHeight = Math.min(rows, maxRowsBeforeScroll) * rowH + headerH + 8;
  const scrollHeight = fillHeight ? '100%' : rows > maxRowsBeforeScroll ? tableHeight : undefined;

  if (loading) {
    return (
      <Paper p="md" radius="md" h={fillHeight ? '100%' : undefined}>
        <Group justify="apart" mb="md">
          <Text size="lg" fw={600}>Ads</Text>
          <Loader size="sm" />
        </Group>
        <Skeleton h={40} mb="sm" />
        <Skeleton h={40} mb="sm" />
        <Skeleton h={40} mb="sm" />
      </Paper>
    );
  }

  return (
    <>
      <div className={classes.mobileEntityList}>
        {ads.length === 0 ? (
          <Text ta="center" py="md" c="dimmed">
            No ads found for this ad set
          </Text>
        ) : (
          ads.map((ad) => {
            const id = ad.ad_id ?? ad.id;
            const spend = Number(ad.spend || 0);
            const leads = Number(ad.leads || 0);
            const messages = Number(ad.messages || 0);
            const conversions = leads + messages + Number(ad.calls || 0);
            const previewImage = ad.creativePreview?.image ?? null;
            const isSelected = selectedAdId === id;
            const reportHref = buildEntityReportUrl({
              scope: 'ad',
              platformIntegrationId,
              adAccountId,
              campaignId: ad.campaign_id,
              adsetId: ad.adset_id,
              adId: id,
              startDate: ad.start_date,
              endDate: ad.end_date,
            });

            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                className={classes.mobileEntityCard}
                data-delivering={ad.delivery || undefined}
                data-selected={isSelected || undefined}
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
                    <div style={{ width: 64, height: 64, flexShrink: 0, overflow: "hidden" }}><MediaImage media={ad.creativePreview} name={ad.name} /></div>
                    <div style={{ minWidth: 0 }}>
                      <Text fw={800} size="sm" lineClamp={2}>
                        {ad.name ?? 'Unnamed ad'}
                      </Text>
                      <Group gap={6} mt={6} wrap="wrap">
                        <StatusBadge status={ad.status} />
                      <DeliveryIndicator active={ad.delivery} />
                      </Group>
                    </div>
                  </Group>
                  <Menu position="bottom-end" withArrow offset={4}>
                    <Menu.Target>
                      <ActionIcon
                        variant="light"
                        color={platformColor}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {onRunAgain ? (
                        <Menu.Item
                          leftSection={<IconCopyPlus size={16} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRunAgain(ad);
                          }}
                        >
                          Run again
                        </Menu.Item>
                      ) : null}
                      {previewImage ? (
                        <Menu.Item leftSection={<IconEye size={16} />} component="a" href={previewImage} target="_blank">
                          Preview
                        </Menu.Item>
                      ) : null}
                      <Menu.Item leftSection={<IconChartBar size={16} />} component="a" href={reportHref}>
                        View Analytics
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>

                <div className={classes.mobileMetricGrid}>
                  <div>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Spend</Text>
                    <Text fw={800}>{ad.metricsAvailable === false ? '—' : formatCurrencyAmount(spend, currencyCode)}</Text>
                  </div>
                  <div>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Results</Text>
                    <Text fw={800}>{ad.metricsAvailable === false ? '—' : conversions}</Text>
                  </div>
                  <div>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Cost/Result</Text>
                    <Text fw={800}>
                      {formatCurrencyAmount(
                        conversions > 0 ? spend / conversions : null,
                        currencyCode
                      )}
                    </Text>
                  </div>
                  <details className={classes.moreMetrics} onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
                    <summary>More metrics</summary>
                    <Text size="xs" c="dimmed">Click-through rate</Text>
                    <Text fw={800}>{ad.ctr != null ? fmtPct(Number(ad.ctr)) : '—'}</Text>
                  </details>
                </div>

                <Group justify="space-between" gap="sm" wrap="nowrap" mt="sm">
                  <Text size="xs" c="dimmed" lineClamp={1} className={classes.mobileActivity}>
                    Activity: {ad.start_date || '—'} - {ad.end_date || '—'}
                  </Text>
                  <Group gap={4} wrap="nowrap" className={classes.mobileEntityActions}>
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
                    <Text component="a" href={reportHref} size="xs" fw={800} c={platformColor} onClick={(event) => event.stopPropagation()}>
                      Report
                    </Text>
                  </Group>
                </Group>
              </div>
            );
          })
        )}
      </div>

    <ScrollArea
      className={classes.desktopDataTable}
      h={scrollHeight}
      type="always"
      offsetScrollbars
      style={{ borderRadius: 8, height: fillHeight ? '100%' : undefined }}
    >
      <Table
        highlightOnHover
        stickyHeader
        verticalSpacing="sm"
        horizontalSpacing="md"
        withColumnBorders={false}
        style={{ minWidth: 1200, tableLayout: 'auto', marginBottom: fillHeight ? 18 : undefined }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 64, minWidth: 64, textAlign: 'center' }}>Select</Table.Th>
            <Table.Th style={{ width: 340, maxWidth: 340 }}>Ad Name</Table.Th>
            <Table.Th style={{ width: 60, textAlign: 'center', whiteSpace: 'nowrap' }}>Preview</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Status</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Spend</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Results</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Cost/Result</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>CTR</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>CPC</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>CPM</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Impressions</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Clicks</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Reach</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Link Clicks</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Leads</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Messages</Table.Th>
            <Table.Th
              style={{
                width: RIGHT_COL_WIDTH,
                minWidth: RIGHT_COL_WIDTH,
                position: 'sticky',
                right: 0,
                top: 0,
                zIndex: Z_HEADER,
                background: BG,
                boxShadow: `inset 1px 0 0 ${BORDER}, inset 0 -1px 0 ${BORDER}`,
              }}
            />
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {ads.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={20}>
                <Text ta="center" py="md" c="dimmed">
                  No ads found for this ad set
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            ads.map((ad) => {
              const id = ad.ad_id ?? ad.id;
              const spend = Number(ad.spend || 0);
              const clicks = Number(ad.clicks || 0);
              const impressions = Number(ad.impressions || 0);
              const reach = ad.reach;
              const linkClicks = Number(ad.link_clicks || 0);
              const leads = Number(ad.leads || 0);
              const messages = Number(ad.messages || 0);
              const conversions = leads + messages + Number(ad.calls || 0);
              const isSelected = selectedAdId === id;
              const rowBg = isSelected ? `var(--mantine-color-${platformColor}-1)` : 'transparent';
              const stickyCellBg = isSelected ? `var(--mantine-color-${platformColor}-1)` : BG;
              const reportHref = buildEntityReportUrl({
                scope: 'ad',
                platformIntegrationId,
                adAccountId,
                campaignId: ad.campaign_id,
                adsetId: ad.adset_id,
                adId: id,
                startDate: ad.start_date,
                endDate: ad.end_date,
              });
              const previewImage = ad.creativePreview?.image ?? null;

              return (
                <Table.Tr
                  data-delivering={ad.delivery || undefined}
                  key={id}
                  style={{ background: rowBg, cursor: onSelectAd ? 'pointer' : 'default' }}
                  onClick={() => onSelectAd?.(id)}
                  onDoubleClick={() => onOpenAd?.(id)}
                >
                  <Table.Td ta="center">
                    <Tooltip
                      label={isSelected ? 'Selected ad' : 'Select ad'}
                      withArrow
                      withinPortal
                      openDelay={150}
                    >
                      <ActionIcon
                        aria-label={isSelected ? 'Selected ad' : 'Select ad'}
                        variant={isSelected ? 'filled' : 'default'}
                        color={isSelected ? platformColor : 'gray'}
                        radius="xl"
                        size="sm"
                        disabled={!onSelectAd}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectAd?.(id);
                        }}
                        onDoubleClick={(event) => event.stopPropagation()}
                      >
                        {isSelected ? <IconCheck size={14} /> : <IconCircle size={13} />}
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td style={{ width: 340, maxWidth: 340 }}>
                    <Tooltip
                      label={ad.name ?? '—'}
                      multiline
                      withArrow
                      withinPortal
                      position="top-start"
                      maw={420}
                      openDelay={200}
                    >
                      <Text
                        size="sm"
                        fw={500}
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {ad.name ?? '—'}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Box w={64} mx="auto">
                      <div style={{ width: 64, height: 64, flexShrink: 0, overflow: "hidden" }}><MediaImage media={ad.creativePreview} name={ad.name} /></div>
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
                      <StatusBadge status={ad.status} />
                      <DeliveryIndicator active={ad.delivery} />
                    </Group>
                  </Table.Td>
                  <Table.Td>{ad.metricsAvailable === false ? '—' : formatCurrencyAmount(spend, currencyCode)}</Table.Td>
                  <Table.Td>{ad.metricsAvailable === false ? 'Unavailable' : `${conversions} ${conversions === 1 ? 'Result' : 'Results'}`}</Table.Td>
                  <Table.Td>
                    {formatCurrencyAmount(
                      conversions > 0 ? spend / conversions : null,
                      currencyCode
                    )}
                  </Table.Td>
                  <Table.Td>{ad.ctr != null ? fmtPct(Number(ad.ctr)) : '—'}</Table.Td>
                  <Table.Td>{ad.cpc != null ? formatCurrencyAmount(Number(ad.cpc), currencyCode) : '—'}</Table.Td>
                  <Table.Td>{ad.cpm != null ? formatCurrencyAmount(Number(ad.cpm), currencyCode) : '—'}</Table.Td>
                  <Table.Td>{ad.metricsAvailable === false ? '—' : impressions.toLocaleString()}</Table.Td>
                  <Table.Td>{ad.metricsAvailable === false ? '—' : clicks.toLocaleString()}</Table.Td>
                  <Table.Td>{reach == null ? '—' : reach.toLocaleString()}</Table.Td>
                  <Table.Td>{ad.metricsAvailable === false ? '—' : linkClicks.toLocaleString()}</Table.Td>
                  <Table.Td>{ad.metricsAvailable === false ? '—' : leads.toLocaleString()}</Table.Td>
                  <Table.Td>{ad.metricsAvailable === false ? '—' : messages.toLocaleString()}</Table.Td>

                  <Table.Td
                    style={{
                      width: RIGHT_COL_WIDTH,
                      minWidth: RIGHT_COL_WIDTH,
                      position: 'sticky',
                      right: 0,
                      zIndex: Z_STICKY_RIGHT,
                      background: stickyCellBg,
                      boxShadow: `inset 1px 0 0 ${BORDER}`,
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Group gap={8} justify="center">
                      {previewImage && (
                        <Tooltip label="Preview">
                          <ActionIcon
                            variant="filled"
                            color={platformColor}
                            component="a"
                            href={previewImage}
                            target="_blank"
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon>
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {onRunAgain ? (
                            <Menu.Item
                              leftSection={<IconCopyPlus size={16} />}
                              onClick={(event) => {
                                event.stopPropagation();
                                onRunAgain(ad);
                              }}
                            >
                              Run again
                            </Menu.Item>
                          ) : null}
                          <Menu.Item
                            leftSection={<IconChartBar size={16} />}
                            component="a"
                            href={reportHref}
                            onClick={(event) => event.stopPropagation()}
                          >
                            View Analytics
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
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
