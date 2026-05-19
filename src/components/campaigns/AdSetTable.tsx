'use client';

import type { AdSetLifetimeRow } from '@/lib/server/data';
import {
  ActionIcon,
  Group,
  Loader,
  Menu,
  Paper,
  ScrollArea,
  Skeleton,
  Switch,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconChartBar, IconCheck, IconCircle, IconDots, IconPencil, IconTrash } from '@tabler/icons-react';
import StatusBadge from './StatusBadge';
import { buildEntityReportUrl } from './reportLinks';
import classes from './CampaignDashboard.module.css';

const BG = 'var(--mantine-color-body)';
const BORDER = 'var(--mantine-color-gray-3)';
const Z_HEADER = 2;
const Z_STICKY_RIGHT = 4;
const RIGHT_COL_WIDTH = 24;

interface AdSetTableProps {
  adSets?: AdSetLifetimeRow[];
  loading?: boolean;
  onSelectAdSet?: (id: string) => void;
  onOpenAdSet?: (id: string) => void;
  selectedAdSetId?: string | null;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  platformColor?: string;
  fillHeight?: boolean;
}

export default function AdSetTable({
  adSets = [],
  loading = false,
  onSelectAdSet,
  onOpenAdSet,
  selectedAdSetId,
  platformIntegrationId,
  adAccountId,
  platformColor = 'dark',
  fillHeight = false,
}: AdSetTableProps) {
  const fmt$ = (n?: number) => `$${Number(n || 0).toFixed(2)}`;

  const maxRowsBeforeScroll = 12;
  const headerH = 44;
  const rowH = 48;
  const rows = adSets.length;
  const tableHeight = Math.min(rows, maxRowsBeforeScroll) * rowH + headerH + 8;
  const scrollHeight = fillHeight ? '100%' : rows > maxRowsBeforeScroll ? tableHeight : undefined;

  const handleRowClick = (adsetId: string) => {
    onSelectAdSet?.(adsetId);
  };

  if (loading) {
    return (
      <Paper p="md" radius="md" h={fillHeight ? '100%' : undefined}>
        <Group justify="apart" mb="md">
          <Text size="lg" fw={600}>Ad Sets</Text>
          <Loader size="sm" />
        </Group>
        <Skeleton height={40} mb="sm" />
        <Skeleton height={40} mb="sm" />
        <Skeleton height={40} mb="sm" />
      </Paper>
    );
  }

  return (
    <>
      <div className={classes.mobileEntityList}>
        {adSets.length === 0 ? (
          <Text ta="center" py="md" c="dimmed">
            No ad sets found
          </Text>
        ) : (
          adSets.map((adSet) => {
            const isSelected = selectedAdSetId === adSet.id;
            const status = (adSet.status || '').toString();
            const spend = Number(adSet.spend || 0);
            const ctr = adSet.ctr != null ? Number(adSet.ctr) : null;
            const leads = Number(adSet.leads || 0);
            const messages = Number(adSet.messages || 0);
            const results = leads + messages;
            const reportHref = buildEntityReportUrl({
              scope: 'adset',
              platformIntegrationId,
              adAccountId,
              campaignId: adSet.campaign_id,
              adsetId: adSet.id,
              startDate: adSet.start_date,
              endDate: adSet.end_date,
            });

            return (
              <div
                key={adSet.id}
                role="button"
                tabIndex={0}
                className={classes.mobileEntityCard}
                data-selected={isSelected || undefined}
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
                    <Text fw={800} size="sm" lineClamp={2}>
                      {adSet.name}
                    </Text>
                    <Group gap={6} mt={6} wrap="wrap">
                      <StatusBadge status={status} />
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {adSet.optimization_goal || adSet.objective || 'Goal unavailable'}
                      </Text>
                    </Group>
                  </div>
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
                      <Menu.Item leftSection={<IconChartBar size={16} />} component="a" href={reportHref}>
                        View Analytics
                      </Menu.Item>
                      <Menu.Item leftSection={<IconPencil size={16} />} component="a" href={`/adsets/${adSet.id}/edit`}>
                        Edit Ad Set
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>

                <div className={classes.mobileMetricGrid}>
                  <div>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Spend</Text>
                    <Text fw={800}>{fmt$(spend)}</Text>
                  </div>
                  <div>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Results</Text>
                    <Text fw={800}>{results}</Text>
                  </div>
                  <div>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Cost/Result</Text>
                    <Text fw={800}>{results > 0 ? fmt$(spend / results) : '$0.00'}</Text>
                  </div>
                  <div>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={800}>CTR</Text>
                    <Text fw={800}>{ctr != null ? `${ctr}%` : '0%'}</Text>
                  </div>
                </div>

                <Group justify="space-between" gap="sm" wrap="nowrap" mt="sm">
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {adSet.start_date || '—'} - {adSet.end_date || 'Ongoing'}
                  </Text>
                  <Text component="a" href={reportHref} size="xs" fw={800} c={platformColor} onClick={(event) => event.stopPropagation()}>
                    Report
                  </Text>
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
            <Table.Th style={{ width: 320, maxWidth: 320 }}>Ad Set</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Status</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Objective</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Start</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>End</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Spend</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Results</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Cost/Result</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>CTR</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>CPC</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>CPM</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Reach</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Impressions</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Clicks</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Link Clicks</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Leads</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Messages</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Freq</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>CPL</Table.Th>
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
          {adSets.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={25}>
                <Text ta="center" py="md" c="dimmed">
                  No ad sets found
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            adSets.map((adSet) => {
              const isSelected = selectedAdSetId === adSet.id;
              const rowBg = isSelected ? `var(--mantine-color-${platformColor}-1)` : 'transparent';
              const stickyCellBg = isSelected ? `var(--mantine-color-${platformColor}-1)` : BG;
              const status = (adSet.status || '').toString();
              const delivery = status.toUpperCase() === 'ACTIVE';
              const spend = Number(adSet.spend || 0);
              const ctr = adSet.ctr != null ? Number(adSet.ctr) : null;
              const cpc = adSet.cpc != null ? Number(adSet.cpc) : null;
              const cpm = adSet.cpm != null ? Number(adSet.cpm) : null;
              const reach = Number(adSet.reach || 0);
              const impressions = Number(adSet.impressions || 0);
              const clicks = Number(adSet.clicks || 0);
              const linkClicks = Number(adSet.link_clicks || 0);
              const leads = Number(adSet.leads || 0);
              const messages = Number(adSet.messages || 0);
              const results = leads + messages;
              const reportHref = buildEntityReportUrl({
                scope: 'adset',
                platformIntegrationId,
                adAccountId,
                campaignId: adSet.campaign_id,
                adsetId: adSet.id,
                startDate: adSet.start_date,
                endDate: adSet.end_date,
              });

              return (
                <Table.Tr
                  key={adSet.id}
                  style={{ background: rowBg, cursor: 'pointer' }}
                  onClick={() => handleRowClick(adSet.id)}
                  onDoubleClick={() => onOpenAdSet?.(adSet.id)}
                >
                  <Table.Td ta="center">
                    <Tooltip
                      label={isSelected ? 'Selected ad set' : 'Select ad set'}
                      withArrow
                      withinPortal
                      openDelay={150}
                    >
                      <ActionIcon
                        aria-label={isSelected ? 'Selected ad set' : 'Select ad set'}
                        variant={isSelected ? 'filled' : 'default'}
                        color={isSelected ? platformColor : 'gray'}
                        radius="xl"
                        size="sm"
                        disabled={!onSelectAdSet}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectAdSet?.(adSet.id);
                        }}
                        onDoubleClick={(event) => event.stopPropagation()}
                      >
                        {isSelected ? <IconCheck size={14} /> : <IconCircle size={13} />}
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>

                  <Table.Td style={{ width: 320, maxWidth: 320 }}>
                    <Tooltip
                      label={adSet.name}
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
                        {adSet.name}
                      </Text>
                    </Tooltip>
                  </Table.Td>

                  <Table.Td>
                    <Group
                      gap="xs"
                      wrap="nowrap"
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <Switch
                        checked={delivery}
                        size="sm"
                        onLabel="ON"
                        offLabel="OFF"
                        color="green"
                        readOnly
                      />
                      <StatusBadge status={status} />
                    </Group>
                  </Table.Td>

                  <Table.Td><Text size="sm">{adSet.optimization_goal || adSet.objective || '—'}</Text></Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text size="sm">{adSet.start_date || '—'}</Text>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text size="sm">{adSet.end_date || 'Ongoing'}</Text>
                  </Table.Td>
                  <Table.Td><Text fw={500} size="sm">{fmt$(spend)}</Text></Table.Td>
                  <Table.Td><Text size="sm">{results > 0 ? `${results} Results` : '0 Results'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{results > 0 ? fmt$(spend / results) : '$0.00'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{ctr != null ? `${ctr}%` : '0%'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{cpc != null ? fmt$(cpc) : '—'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{cpm != null ? fmt$(cpm) : '—'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{reach}</Text></Table.Td>
                  <Table.Td><Text size="sm">{impressions}</Text></Table.Td>
                  <Table.Td><Text size="sm">{clicks}</Text></Table.Td>
                  <Table.Td><Text size="sm">{linkClicks}</Text></Table.Td>
                  <Table.Td><Text size="sm">{leads}</Text></Table.Td>
                  <Table.Td><Text size="sm">{messages}</Text></Table.Td>
                  <Table.Td><Text size="sm">{reach > 0 ? (impressions / reach).toFixed(2) : '0.00'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{leads > 0 ? fmt$(spend / leads) : '$0.00'}</Text></Table.Td>

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
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <Menu position="bottom-end" withArrow offset={4}>
                      <Menu.Target>
                        <ActionIcon variant="filled" color={platformColor}>
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconPencil size={16} />}
                          component="a"
                          href={`/adsets/${adSet.id}/edit`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          Edit Ad Set
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconChartBar size={16} />}
                          component="a"
                          href={reportHref}
                          onClick={(event) => event.stopPropagation()}
                        >
                          View Analytics
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={16} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            alert(`Delete Ad Set ${adSet.name}`);
                          }}
                        >
                          Delete Ad Set
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
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
