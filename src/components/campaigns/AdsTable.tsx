'use client';

import {
  Table,
  Group,
  Text,
  Switch,
  Loader,
  Paper,
  Badge,
  ActionIcon,
  Menu,
  Divider,
  Skeleton,
  Avatar,
  Box,
  Tooltip,
  ScrollArea,
  Button,
} from '@mantine/core';
import {
  IconDots,
  IconPencil,
  IconTrash,
  IconChartBar,
  IconPhoto,
  IconEye,
  IconPlus,
} from '@tabler/icons-react';
import useSWR from 'swr';
import { fetcher } from '@/utils/fetcher';
import React from 'react';

const BG = 'var(--mantine-color-body)';
const BORDER = 'var(--mantine-color-gray-3)';
const Z_HEADER = 2;
const Z_STICKY_RIGHT = 4;
const RIGHT_COL_WIDTH = 24;

const fmt$ = (n?: number) => `$${Number(n || 0).toFixed(2)}`;
const fmtPct = (n?: number) => {
  if (n == null) return '0%';
  const val = n <= 1 ? n * 100 : n;
  return `${val.toFixed(2)}%`;
};

export default function AdsTable({
  adsetId,
  ads,
  loading = false,
  platformColor = 'dark',

}: {
  adsetId: string;
  ads: any[];
  loading?: boolean;
  platformColor?: string;

}) {
  const maxRowsBeforeScroll = 12;
  const headerH = 44;
  const rowH = 48;
  const rows = Array.isArray(ads) ? ads.length : 0;
  const tableHeight = Math.min(rows, maxRowsBeforeScroll) * rowH + headerH + 8;
  const rowBg = `var(--mantine-color-${platformColor}-1)`;
  const handleAddAd = () => {
    alert('Add Ad for ad set: ' + adsetId);
  };

  if (loading) {
    return (
      <Paper p="md" radius="md">
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
      <Group justify="space-between" align="center" px="md" py="sm" mb="sm" style={{ background: '#f8fafc', borderRadius: 8 }}>
        <Text size="lg" fw={600}>Ads</Text>
        <Button
          leftSection={<IconPlus size={18} />}
          color="blue"
          variant="light"
          radius="xl"
          onClick={handleAddAd}
          style={{ fontWeight: 500 }}
        >
          Add New Ad
        </Button>
      </Group>

      <ScrollArea
        h={rows > maxRowsBeforeScroll ? tableHeight : undefined}
        type="always"
        offsetScrollbars='x'
        style={{ borderRadius: 8 }}
      >
        <Table
          striped
          highlightOnHover
          withColumnBorders
          stickyHeader
          style={{ minWidth: 1400, tableLayout: 'auto' }}
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

              {/* sticky right header (actions) */}
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
            {!ads || ads.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={20}>
                  <Text ta="center" py="md" c="dimmed">No ads found for this ad set</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ads.map((ad: any) => {
                const id = ad.ad_id ?? ad.id;
                const name = ad.name ?? '—';
                const isActive = (ad.status || '').toUpperCase() === 'ACTIVE';

                const spend = Number(ad.spend || 0);
                const clicks = Number(ad.clicks || 0);
                const impressions = Number(ad.impressions || 0);
                const reach = Number(ad.reach || 0);
                const linkClicks = Number(ad.link_clicks || 0);
                const leads = Number(ad.leads || 0);
                const messages = Number(ad.messages || 0);

                const ctr = ad.ctr != null ? Number(ad.ctr) : null;
                const cpc = ad.cpc != null ? Number(ad.cpc) : null;
                const cpm = ad.cpm != null ? Number(ad.cpm) : null;

                const conversions = leads + messages;
                const results = conversions > 0 ? `${conversions} ${conversions === 1 ? 'Result' : 'Results'}` : '0 Results';
                const costPerResult = conversions > 0 ? fmt$(spend / conversions) : '$0.00';

                const previewImage =
                  ad.raw_data?.creative?.image_url ||
                  ad.raw_data?.creative?.video_url ||
                  ad.raw_data?.image_url ||
                  null;

                return (
                  <Table.Tr key={id} style={{ cursor: 'pointer' }}>
                    <Table.Td />

                    {/* Name (truncate + tooltip) */}
                    <Table.Td style={{ width: 340, maxWidth: 340 }}>
                      <Tooltip
                        label={name}
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
                          {name}
                        </Text>
                      </Tooltip>
                    </Table.Td>

                    {/* Preview */}
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Box w={40} mx="auto">
                        <Avatar src={previewImage} radius="sm">
                          <IconPhoto size={16} />
                        </Avatar>
                      </Box>
                    </Table.Td>

                    {/* Status + toggle (read-only here; wire later if needed) */}
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={isActive}
                          size="sm"
                          onLabel="ON"
                          offLabel="OFF"
                          color="green"
                          readOnly
                        />
                        <Badge color={isActive ? 'green' : 'gray'} variant="light">
                          {ad.status || '—'}
                        </Badge>
                      </Group>
                    </Table.Td>

                    <Table.Td>{fmt$(spend)}</Table.Td>
                    <Table.Td>{results}</Table.Td>
                    <Table.Td>{costPerResult}</Table.Td>

                    <Table.Td>{fmtPct(ctr ?? 0)}</Table.Td>
                    <Table.Td>{cpc != null ? fmt$(cpc) : '—'}</Table.Td>
                    <Table.Td>{cpm != null ? fmt$(cpm) : '—'}</Table.Td>

                    <Table.Td>{impressions.toLocaleString()}</Table.Td>
                    <Table.Td>{clicks.toLocaleString()}</Table.Td>
                    <Table.Td>{reach.toLocaleString()}</Table.Td>
                    <Table.Td>{linkClicks.toLocaleString()}</Table.Td>
                    <Table.Td>{leads.toLocaleString()}</Table.Td>
                    <Table.Td>{messages.toLocaleString()}</Table.Td>

                    {/* sticky RIGHT actions cell */}
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
                      onClick={(e) => e.stopPropagation()}
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
    </>
  );
}
