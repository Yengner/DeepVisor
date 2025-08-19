'use client';

import { FormattedCampaign } from '@/app/(root)/campaigns/page';
import {
  Table, Group, Text, Badge, Switch, ActionIcon, Menu, ThemeIcon,
  ScrollArea, Tooltip, Stack
} from '@mantine/core';
import {
  IconCheck, IconPencil, IconTrash, IconDots, IconChartBar, IconRobot, IconAlertTriangle
} from '@tabler/icons-react';
import React from 'react';

interface CampaignTableProps {
  campaigns: FormattedCampaign[];
  selectedCampaignId?: string;
  onSelectCampaign: (campaignId: string) => void;
  onToggleCampaign: (campaignId: string, newStatus: boolean) => void;
  onDeleteCampaign: (campaignId: string) => void;
  platformColor?: string;
}

const BG = 'var(--mantine-color-body)';
const BORDER = 'var(--mantine-color-gray-3)';
const Z_HEADER = 2;
const Z_STICKY_RIGHT = 4;
const RIGHT_COL_WIDTH = 24;


export default function CampaignTable({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onToggleCampaign,
  onDeleteCampaign,
  platformColor = 'dark',
}: CampaignTableProps) {
  const fmt$ = (n?: number) => `$${Number(n || 0).toFixed(2)}`;

  const maxRowsBeforeScroll = 12;
  const headerH = 44;
  const rowH = 48;
  const rows = campaigns.length;
  const tableHeight = Math.min(rows, maxRowsBeforeScroll) * rowH + headerH + 8;

  return (
    <ScrollArea
      h={rows > maxRowsBeforeScroll ? tableHeight : undefined}
      type="always"
      style={{ borderRadius: 8 }}
      offsetScrollbars="x"
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
            <Table.Th />
            <Table.Th style={{ width: 320, maxWidth: 320 }} >Campaign</Table.Th>
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
          {campaigns.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={25}>
                <Text ta="center" py="md" c="dimmed">
                  No campaigns found
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            campaigns.map((c) => {
              const selected = selectedCampaignId === c.id;
              const needs = !!c.review?.needsReview;
              const pending = Number(c.review?.pendingCount || 0);
              const reviewHref = c.review?.lastDecisionId
                ? `/optimizer/review/${c.review.lastDecisionId}?campaign=${c.id}`
                : undefined;

              const rowBg = selected
                ? `var(--mantine-color-${platformColor}-1)`
                : 'transparent';

              return (
                <Table.Tr
                  key={c.id}
                  style={{ background: rowBg, cursor: 'pointer' }}
                  onClick={() => onSelectCampaign(c.id)}
                >
                  <Table.Td>
                    {selected && (
                      <ThemeIcon radius="xl" size="sm" color={platformColor}>
                        <IconCheck size={14} />
                      </ThemeIcon>
                    )}
                  </Table.Td>

                  <Table.Td style={{ width: 320, maxWidth: 320 }}>
                    {/* compute review helpers for this row */}
                    {(() => {
                      const needs = !!c.review?.needsReview;
                      const pending = Number(c.review?.pendingCount || 0);
                      const reviewHref = c.review?.lastDecisionId
                        ? `/optimizer/review/${c.review.lastDecisionId}?campaign=${c.id}`
                        : undefined;

                      return (
                        <>
                          <Group gap="xs" wrap="nowrap" align="center" style={{ minWidth: 0 }}>
                            {/* truncated name with tooltip */}
                            <Tooltip
                              label={c.name}
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
                                {c.name}
                              </Text>
                            </Tooltip>

                            {/* review badge/icon (clickable, doesn’t select the row) */}
                            {needs && (
                              <Tooltip label="This campaign has actions waiting for review" withArrow>
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
                                  Review{pending > 0 ? ` • ${pending}` : ''}
                                </Badge>
                              </Tooltip>
                            )}
                          </Group>

                          {/* account name (also truncated with tooltip) */}
                          {c.accountName && (
                            <Tooltip
                              label={c.accountName}
                              multiline
                              withArrow
                              withinPortal
                              position="top-start"
                              maw={420}
                              openDelay={200}
                            >
                              <Text
                                size="xs"
                                c="dimmed"
                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                Account: {c.accountName}
                              </Text>
                            </Tooltip>
                          )}
                        </>
                      );
                    })()}
                  </Table.Td>

                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={c.delivery}
                        onChange={(ev) => onToggleCampaign(c.id, ev.currentTarget.checked)}
                        size="sm"
                        onLabel="ON"
                        offLabel="OFF"
                        color="green"
                      />
                      <Badge color={c.status?.toUpperCase() === 'ACTIVE' ? 'green' : 'gray'} variant="light">
                        {c.status}
                      </Badge>
                    </Group>
                  </Table.Td>

                  <Table.Td><Text size="sm">{c.objective}</Text></Table.Td>

                  {/* Start */}
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text size="sm">{c.startDate}</Text>
                  </Table.Td>

                  {/* End */}
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text size="sm">
                      {c.endDate && c.endDate !== 'No End Date' ? c.endDate : 'Ongoing'}
                    </Text>
                  </Table.Td>


                  <Table.Td><Text fw={500} size="sm">{fmt$(c.spend)}</Text></Table.Td>
                  <Table.Td><Text size="sm">{c.results}</Text></Table.Td>

                  <Table.Td><Text size="sm">{c.ctr != null ? `${c.ctr}%` : '0%'}</Text>
                  </Table.Td>
                  <Table.Td><Text size="sm">{c.cpc != null ? fmt$(c.cpc) : '—'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{c.cpm != null ? fmt$(c.cpm) : '—'}</Text></Table.Td>

                  {/* Extra metrics */}
                  <Table.Td><Text size="sm">{c.reach ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{c.impressions ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{c.clicks ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{c.link_clicks ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{c.leads ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{c.messages ?? 0}</Text></Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {c.reach && c.impressions ? (Number(c.impressions) / Number(c.reach)).toFixed(2) : '0.00'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {Number(c.leads) > 0 ? fmt$(Number(c.spend || 0) / Number(c.leads)) : '$0.00'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {Number(c.messages) > 0 ? fmt$(Number(c.spend || 0) / Number(c.messages)) : '$0.00'}
                    </Text>
                  </Table.Td>

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
                    <Menu position="bottom-end" withArrow offset={4} >
                      <Menu.Target>
                        <ActionIcon
                        variant="filled"
                        color={platformColor}
                        ><IconDots size={16} /></ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {needs && reviewHref && (
                          <Menu.Item
                            leftSection={<IconAlertTriangle size={16} />}
                            component="a"
                            href={reviewHref}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Review pending actions{pending > 0 ? ` (${pending})` : ''}
                          </Menu.Item>
                        )}
                        <Menu.Item
                          leftSection={<IconPencil size={16} />}
                          component="a"
                          href={`/campaigns/${c.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Edit Campaign
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconChartBar size={16} />}
                          component="a"
                          href={`/campaigns/${c.id}/analytics`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Analytics
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={16} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCampaign(c.id);
                          }}
                        >
                          Delete Campaign
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
