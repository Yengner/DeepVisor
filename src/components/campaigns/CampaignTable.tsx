'use client';

import type { FormattedCampaign } from '@/app/(root)/campaigns/page';
import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  ScrollArea,
  Switch,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconChartBar,
  IconCheck,
  IconDots,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';

interface CampaignTableProps {
  campaigns: FormattedCampaign[];
  selectedCampaignId?: string;
  onSelectCampaign: (campaignId: string) => void;
  onOpenCampaign?: (campaignId: string) => void;
  onToggleCampaign: (campaignId: string, newStatus: boolean) => void;
  onDeleteCampaign: (campaignId: string) => void;
  platformColor?: string;
  fillHeight?: boolean;
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
  onOpenCampaign,
  onToggleCampaign,
  onDeleteCampaign,
  platformColor = 'dark',
  fillHeight = false,
}: CampaignTableProps) {
  const fmt$ = (n?: number) => `$${Number(n || 0).toFixed(2)}`;

  const maxRowsBeforeScroll = 12;
  const headerH = 44;
  const rowH = 48;
  const rows = campaigns.length;
  const tableHeight = Math.min(rows, maxRowsBeforeScroll) * rowH + headerH + 8;
  const scrollHeight = fillHeight ? '100%' : rows > maxRowsBeforeScroll ? tableHeight : undefined;

  return (
    <ScrollArea
      h={scrollHeight}
      type="always"
      style={{ borderRadius: 8, height: fillHeight ? '100%' : undefined }}
      offsetScrollbars
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
            <Table.Th />
            <Table.Th style={{ width: 320, maxWidth: 320 }}>Campaign</Table.Th>
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
            campaigns.map((campaign) => {
              const selected = selectedCampaignId === campaign.id;
              const rowBg = selected ? `var(--mantine-color-${platformColor}-1)` : 'transparent';

              return (
                <Table.Tr
                  key={campaign.id}
                  style={{ background: rowBg, cursor: 'pointer' }}
                  onClick={() => onSelectCampaign(campaign.id)}
                  onDoubleClick={() => onOpenCampaign?.(campaign.id)}
                >
                  <Table.Td>
                    {selected && (
                      <ThemeIcon radius="xl" size="sm" color={platformColor}>
                        <IconCheck size={14} />
                      </ThemeIcon>
                    )}
                  </Table.Td>

                  <Table.Td style={{ width: 320, maxWidth: 320 }}>
                    <Tooltip
                      label={campaign.name}
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
                        {campaign.name}
                      </Text>
                    </Tooltip>

                    {campaign.accountName && (
                      <Tooltip
                        label={campaign.accountName}
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
                          Account: {campaign.accountName}
                        </Text>
                      </Tooltip>
                    )}
                  </Table.Td>

                  <Table.Td>
                    <Group
                      gap="xs"
                      wrap="nowrap"
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <Switch
                        checked={campaign.delivery}
                        onChange={(event) => onToggleCampaign(campaign.id, event.currentTarget.checked)}
                        size="sm"
                        onLabel="ON"
                        offLabel="OFF"
                        color="green"
                      />
                      <Badge
                        color={campaign.status?.toUpperCase() === 'ACTIVE' ? 'green' : 'gray'}
                        variant="light"
                      >
                        {campaign.status}
                      </Badge>
                    </Group>
                  </Table.Td>

                  <Table.Td><Text size="sm">{campaign.objective}</Text></Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}><Text size="sm">{campaign.startDate}</Text></Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text size="sm">
                      {campaign.endDate && campaign.endDate !== 'No End Date' ? campaign.endDate : 'Ongoing'}
                    </Text>
                  </Table.Td>
                  <Table.Td><Text fw={500} size="sm">{fmt$(campaign.spend)}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.results}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.ctr != null ? `${campaign.ctr}%` : '0%'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.cpc != null ? fmt$(campaign.cpc) : '—'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.cpm != null ? fmt$(campaign.cpm) : '—'}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.reach ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.impressions ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.clicks ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.link_clicks ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.leads ?? 0}</Text></Table.Td>
                  <Table.Td><Text size="sm">{campaign.messages ?? 0}</Text></Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {campaign.reach && campaign.impressions
                        ? (Number(campaign.impressions) / Number(campaign.reach)).toFixed(2)
                        : '0.00'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {Number(campaign.leads) > 0 ? fmt$(Number(campaign.spend || 0) / Number(campaign.leads)) : '$0.00'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {Number(campaign.messages) > 0
                        ? fmt$(Number(campaign.spend || 0) / Number(campaign.messages))
                        : '$0.00'}
                    </Text>
                  </Table.Td>

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
                          href={`/campaigns/${campaign.id}/edit`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          Edit Campaign
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconChartBar size={16} />}
                          component="a"
                          href={`/campaigns/${campaign.id}/analytics`}
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
                            onDeleteCampaign(campaign.id);
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
