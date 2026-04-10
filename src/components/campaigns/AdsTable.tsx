'use client';

import type { AdLifetimeRow } from '@/lib/server/data';
import { asRecord, asString } from '@/lib/shared/utils/format';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Divider,
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
import {
  IconChartBar,
  IconDots,
  IconEye,
  IconPencil,
  IconPhoto,
  IconTrash,
} from '@tabler/icons-react';

const BG = 'var(--mantine-color-body)';
const BORDER = 'var(--mantine-color-gray-3)';
const Z_HEADER = 2;
const Z_STICKY_RIGHT = 4;
const RIGHT_COL_WIDTH = 24;

const fmt$ = (n?: number) => `$${Number(n || 0).toFixed(2)}`;
const fmtPct = (n?: number) => {
  if (n == null) {
    return '0%';
  }

  const value = n <= 1 ? n * 100 : n;
  return `${value.toFixed(2)}%`;
};

interface AdsTableProps {
  ads?: AdLifetimeRow[];
  loading?: boolean;
  platformColor?: string;
  fillHeight?: boolean;
}

export default function AdsTable({
  ads = [],
  loading = false,
  platformColor = 'dark',
  fillHeight = false,
}: AdsTableProps) {
  const maxRowsBeforeScroll = 12;
  const headerH = 44;
  const rowH = 48;
  const rows = ads.length;
  const tableHeight = Math.min(rows, maxRowsBeforeScroll) * rowH + headerH + 8;
  const scrollHeight = fillHeight ? '100%' : rows > maxRowsBeforeScroll ? tableHeight : undefined;
  const rowBg = `var(--mantine-color-${platformColor}-1)`;

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
              const reach = Number(ad.reach || 0);
              const linkClicks = Number(ad.link_clicks || 0);
              const leads = Number(ad.leads || 0);
              const messages = Number(ad.messages || 0);
              const conversions = leads + messages;
              const raw = asRecord(ad.raw_data);
              const creative = asRecord(raw.creative);
              const previewImage =
                asString(creative.image_url) ||
                asString(creative.video_url) ||
                asString(raw.image_url) ||
                null;

              return (
                <Table.Tr key={id} style={{ cursor: 'pointer' }}>
                  <Table.Td />
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
                    <Box w={40} mx="auto">
                      <Avatar src={previewImage} radius="sm">
                        <IconPhoto size={16} />
                      </Avatar>
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
                      <Switch
                        checked={(ad.status || '').toUpperCase() === 'ACTIVE'}
                        size="sm"
                        onLabel="ON"
                        offLabel="OFF"
                        color="green"
                        readOnly
                      />
                      <Badge color={(ad.status || '').toUpperCase() === 'ACTIVE' ? 'green' : 'gray'} variant="light">
                        {ad.status || '—'}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>{fmt$(spend)}</Table.Td>
                  <Table.Td>{conversions > 0 ? `${conversions} ${conversions === 1 ? 'Result' : 'Results'}` : '0 Results'}</Table.Td>
                  <Table.Td>{conversions > 0 ? fmt$(spend / conversions) : '$0.00'}</Table.Td>
                  <Table.Td>{fmtPct(ad.ctr != null ? Number(ad.ctr) : 0)}</Table.Td>
                  <Table.Td>{ad.cpc != null ? fmt$(Number(ad.cpc)) : '—'}</Table.Td>
                  <Table.Td>{ad.cpm != null ? fmt$(Number(ad.cpm)) : '—'}</Table.Td>
                  <Table.Td>{impressions.toLocaleString()}</Table.Td>
                  <Table.Td>{clicks.toLocaleString()}</Table.Td>
                  <Table.Td>{reach.toLocaleString()}</Table.Td>
                  <Table.Td>{linkClicks.toLocaleString()}</Table.Td>
                  <Table.Td>{leads.toLocaleString()}</Table.Td>
                  <Table.Td>{messages.toLocaleString()}</Table.Td>

                  <Table.Td
                    style={{
                      width: RIGHT_COL_WIDTH,
                      minWidth: RIGHT_COL_WIDTH,
                      position: 'sticky',
                      right: 0,
                      zIndex: Z_STICKY_RIGHT,
                      background: rowBg || BG,
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
                          <Menu.Item leftSection={<IconPencil size={16} />}>
                            Edit Ad
                          </Menu.Item>
                          <Menu.Item leftSection={<IconChartBar size={16} />}>
                            View Analytics
                          </Menu.Item>
                          <Divider />
                          <Menu.Item color="red" leftSection={<IconTrash size={16} />}>
                            Delete Ad
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
  );
}
