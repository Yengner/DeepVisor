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
  ThemeIcon,
  Skeleton,
  ScrollArea,
  Stack,
  Button,
  Tooltip,
} from '@mantine/core';
import { IconDots, IconPencil, IconTrash, IconCheck, IconPlus, IconAlertTriangle } from '@tabler/icons-react';
import React from 'react';

const BG = 'var(--mantine-color-body)';
const BORDER = 'var(--mantine-color-gray-3)';
const Z_HEADER = 2;
const Z_STICKY_RIGHT = 4;
const RIGHT_COL_WIDTH = 24;

export default function AdSetTable({
  campaignId,
  adSets,
  loading = false,
  onSelectAdSet,
  selectedAdSetId,
  platformColor,
}: {
  campaignId: string;
  adSets: any[];
  loading?: boolean;
  onSelectAdSet?: (id: string) => void;
  selectedAdSetId?: string | null;
  platformColor?: string;
}) {

  const fmt$ = (n?: number) => `$${Number(n || 0).toFixed(2)}`;

  const maxRowsBeforeScroll = 12;
  const headerH = 44;
  const rowH = 48;
  const rows = Array.isArray(adSets) ? adSets.length : 0;
  const tableHeight = Math.min(rows, maxRowsBeforeScroll) * rowH + headerH + 8;


  const handleAddAdSet = () => {
    alert('Add Ad Set for campaign: ' + campaignId);
  };

  const handleRowClick = (adsetId: string) => {
    onSelectAdSet?.(adsetId);
  };

  if (loading) {
    return (
      <Paper p="md" radius="md">
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
      <Group justify="space-between" align="center" px="md" py="sm" mb="sm" style={{ background: '#f8fafc', borderRadius: 8 }}>
        <Text size="lg" fw={600}>Ad Sets</Text>
        <Button
          leftSection={<IconPlus size={18} />}
          color="blue"
          variant="light"
          radius="xl"
          onClick={handleAddAdSet}
          style={{ fontWeight: 500 }}
        >
          Add New Ad Set
        </Button>
      </Group>

      <ScrollArea
        h={rows > maxRowsBeforeScroll ? tableHeight : undefined}
        type="always"
        offsetScrollbars="x"
        style={{ borderRadius: 8 }}
      >
        <Table
          striped
          highlightOnHover
          withColumnBorders
          stickyHeader
          style={{ minWidth: 1400, tableLayout: 'auto' }}  // matches campaign table
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
            {(!adSets || adSets.length === 0) ? (
              <Table.Tr>
                <Table.Td colSpan={25}>
                  <Text ta="center" py="md" c="dimmed">No ad sets found</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              adSets.map((a: any) => {
                const isSelected = selectedAdSetId === a.id;
                const rowBg = isSelected ? `var(--mantine-color-${platformColor}-1)` : 'transparent';

                const id = a.id;
                const name = a.name ?? '—';
                const status = (a.status || '').toString();
                const delivery = a.delivery ?? status.toUpperCase() === 'ACTIVE';
                const objective = a.optimization_goal || a.objective || '—';
                const start = a.start_date ?? a.startDate ?? null;
                const end = a.end_date ?? a.endDate ?? null;

                const spend = Number(a.spend || 0);
                const ctr = a.ctr != null ? Number(a.ctr) : null;
                const cpc = a.cpc != null ? Number(a.cpc) : null;
                const cpm = a.cpm != null ? Number(a.cpm) : null;

                const reach = Number(a.reach || 0);
                const impressions = Number(a.impressions || 0);
                const clicks = Number(a.clicks || 0);
                const link_clicks = Number(a.link_clicks || 0);
                const leads = Number(a.leads || 0);
                const messages = Number(a.messages || 0);

                const freq = reach > 0 ? (impressions / reach).toFixed(2) : '0.00';
                const cpl = leads > 0 ? fmt$(spend / leads) : '$0.00';
                const cpmg = messages > 0 ? fmt$(spend / messages) : '$0.00';

                // optional: adset-level review flags if you have them
                const needsReview = !!a.review?.needsReview;
                const pendingCount = Number(a.review?.pendingCount || 0);
                const reviewHref = a.review?.lastDecisionId
                  ? `/optimizer/review/${a.review.lastDecisionId}?adset=${id}&campaign=${campaignId}`
                  : undefined;

                return (
                  <Table.Tr
                    key={id}
                    style={{ background: rowBg, cursor: 'pointer' }}
                    onClick={() => handleRowClick(id)}
                  >
                    <Table.Td>
                      {isSelected && (
                        <ThemeIcon radius="xl" size="sm" color={platformColor}>
                          <IconCheck size={14} />
                        </ThemeIcon>
                      )}
                    </Table.Td>

                    {/* name with truncation + tooltip; optional review badge */}
                    <Table.Td style={{ width: 320, maxWidth: 320 }}>
                      <Group gap="xs" wrap="nowrap" align="center" style={{ minWidth: 0 }}>
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

                        {needsReview && (
                          <Tooltip label="This ad set has actions waiting for review" withArrow>
                            <Badge
                              leftSection={<IconAlertTriangle size={10} />}
                              color="yellow"
                              variant="filled"
                              size="xs"
                              component={reviewHref ? 'a' : 'div'}
                              href={reviewHref}
                              onClick={(e: any) => e.stopPropagation()}
                              style={{ cursor: reviewHref ? 'pointer' : 'default', flexShrink: 0 }}
                            >
                              Review{pendingCount > 0 ? ` • ${pendingCount}` : ''}
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>

                    {/* status + toggle */}
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={!!delivery}
                          size="sm"
                          onLabel="ON"
                          offLabel="OFF"
                          color="green"
                        // onChange handler left out intentionally (wire to your toggle API)
                        />
                        <Badge color={status.toUpperCase() === 'ACTIVE' ? 'green' : 'gray'} variant="light">
                          {status || '—'}
                        </Badge>
                      </Group>
                    </Table.Td>

                    <Table.Td><Text size="sm">{objective}</Text></Table.Td>

                    {/* Start */}
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      <Text size="sm">{start ? new Date(start).toLocaleDateString() : '—'}</Text>
                    </Table.Td>

                    {/* End */}
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      <Text size="sm">{end ? new Date(end).toLocaleDateString() : 'Ongoing'}</Text>
                    </Table.Td>

                    <Table.Td><Text fw={500} size="sm">{fmt$(spend)}</Text></Table.Td>

                    <Table.Td>
                      <Text size="sm">
                        {leads + messages > 0 ? `${leads + messages} Results` : '0 Results'}
                      </Text>
                    </Table.Td>

                    <Table.Td><Text size="sm">{ctr != null ? `${ctr}%` : '0%'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{cpc != null ? fmt$(cpc) : '—'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{cpm != null ? fmt$(cpm) : '—'}</Text></Table.Td>

                    {/* extra metrics */}
                    <Table.Td><Text size="sm">{reach}</Text></Table.Td>
                    <Table.Td><Text size="sm">{impressions}</Text></Table.Td>
                    <Table.Td><Text size="sm">{clicks}</Text></Table.Td>
                    <Table.Td><Text size="sm">{link_clicks}</Text></Table.Td>
                    <Table.Td><Text size="sm">{leads}</Text></Table.Td>
                    <Table.Td><Text size="sm">{messages}</Text></Table.Td>
                    <Table.Td><Text size="sm">{freq}</Text></Table.Td>
                    <Table.Td><Text size="sm">{cpl}</Text></Table.Td>
                    <Table.Td><Text size="sm">{cpmg}</Text></Table.Td>

                    {/* sticky RIGHT actions cell */}
                    <Table.Td
                      style={{
                        width: RIGHT_COL_WIDTH,
                        minWidth: RIGHT_COL_WIDTH,
                        position: 'sticky',
                        right: 0,
                        zIndex: Z_STICKY_RIGHT,
                        background: BG,
                        boxShadow: `inset 1px 0 0 ${BORDER}`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Menu position="bottom-end" withArrow offset={4}>
                        <Menu.Target>
                          <ActionIcon
                            variant="filled"
                            color={platformColor}
                          ><IconDots size={16} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {needsReview && reviewHref && (
                            <Menu.Item
                              leftSection={<IconAlertTriangle size={16} />}
                              component="a"
                              href={reviewHref}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Review pending actions{pendingCount > 0 ? ` (${pendingCount})` : ''}
                            </Menu.Item>
                          )}
                          <Menu.Item
                            leftSection={<IconPencil size={16} />}
                            component="a"
                            href={`/adsets/${id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Edit Ad Set
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              // wire to delete flow
                              alert(`Delete Ad Set ${name}`);
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
