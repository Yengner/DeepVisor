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
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconDots, IconPencil, IconTrash } from '@tabler/icons-react';
import StatusBadge from './StatusBadge';

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
  platformColor?: string;
  fillHeight?: boolean;
}

export default function AdSetTable({
  adSets = [],
  loading = false,
  onSelectAdSet,
  onOpenAdSet,
  selectedAdSetId,
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
    <ScrollArea
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
            <Table.Th style={{ width: 40 }} />
            <Table.Th style={{ width: 320, maxWidth: 320 }}>Ad Set</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Status</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Objective</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Start</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>End</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Spend</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Results</Table.Th>
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
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Cost/Msg</Table.Th>
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

              return (
                <Table.Tr
                  key={adSet.id}
                  style={{ background: rowBg, cursor: 'pointer' }}
                  onClick={() => handleRowClick(adSet.id)}
                  onDoubleClick={() => onOpenAdSet?.(adSet.id)}
                >
                  <Table.Td>
                    {isSelected && (
                      <ThemeIcon radius="xl" size="sm" color={platformColor}>
                        <IconCheck size={14} />
                      </ThemeIcon>
                    )}
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
                  <Table.Td><Text size="sm">{leads + messages > 0 ? `${leads + messages} Results` : '0 Results'}</Text></Table.Td>
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
                  <Table.Td><Text size="sm">{messages > 0 ? fmt$(spend / messages) : '$0.00'}</Text></Table.Td>

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
  );
}
