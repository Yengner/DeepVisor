'use client';

import { Table, Group, Text, Badge, Switch, ActionIcon, Menu, ThemeIcon, ScrollArea, Tooltip, Stack } from '@mantine/core';
import { IconCheck, IconPencil, IconTrash, IconDots, IconChartBar, IconRobot } from '@tabler/icons-react';
import { useState } from 'react';

interface CampaignObject {
  id: string;
  name: string;
  delivery: boolean;
  type: string;
  status: string;
  objective: string;
  startDate: string;
  endDate: string;
  attribution: string;
  spend?: number;
  results?: string;
  reach?: number;
  clicks?: number;
  impressions?: number;
  frequency?: string;
  costPerResult?: string;
  cpm?: number;
  ctr?: number;
  cpc?: number;
  platform?: string;
  accountName?: string;
}

interface CampaignTableProps {
  campaigns: CampaignObject[];
  selectedCampaignId?: string;
  onSelectCampaign: (campaignId: string) => void;
  onToggleCampaign: (campaignId: string, newStatus: boolean) => void;
  onDeleteCampaign: (campaignId: string) => void;
  platformColor?: string;
}

export default function CampaignTable({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onToggleCampaign,
  onDeleteCampaign,
  platformColor = 'blue'
}: CampaignTableProps) {
  // Column visibility state
  const [columns] = useState({
    status: true,
    objective: true,
    dates: true,
    spend: true,
    results: true,
    metrics: true,
  });

  return (
    <ScrollArea h="auto" type="always" offsetScrollbars>
      <Table
        striped
        highlightOnHover
        border={1}
        withColumnBorders
        style={{ minWidth: 800 }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}></Table.Th>
            <Table.Th>Campaign</Table.Th>
            <Table.Th>Status</Table.Th>
            {columns.objective && <Table.Th>Objective</Table.Th>}
            {columns.dates && <Table.Th>Date Range</Table.Th>}
            {columns.spend && <Table.Th>Spend</Table.Th>}
            {columns.results && <Table.Th>Results</Table.Th>}
            {columns.metrics && <Table.Th>KPI</Table.Th>}
            <Table.Th style={{ width: 50 }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {campaigns.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={12}>
                <Text ta="center" py="md" c="dimmed">
                  No campaigns found
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            campaigns.map((campaign) => (
              <Table.Tr
                key={campaign.id}
                style={{
                  background: selectedCampaignId === campaign.id ? `rgba(var(--mantine-color-${platformColor}-light-rgb), 0.2)` : 'transparent',
                  cursor: 'pointer'
                }}
                onClick={() => onSelectCampaign(campaign.id)}
              >
                <Table.Td>
                  {selectedCampaignId === campaign.id && (
                    <ThemeIcon radius="xl" size="sm" color={platformColor}>
                      <IconCheck size={14} />
                    </ThemeIcon>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {campaign.name}
                    </Text>
                    {campaign.type === "AI Auto" && (
                      <Tooltip label="AI Optimized Campaign">
                        <ThemeIcon color={platformColor} variant="light" radius="xl" size="xs">
                          <IconRobot size={10} />
                        </ThemeIcon>
                      </Tooltip>
                    )}
                  </Group>
                  {campaign.accountName && (
                    <Text size="xs" color="dimmed">
                      Account: {campaign.accountName}
                    </Text>
                  )}
                </Table.Td>

                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Switch
                      checked={campaign.delivery}
                      onChange={(event) => {
                        event.stopPropagation();
                        onToggleCampaign(campaign.id, event.currentTarget.checked);
                      }}
                      size="sm"
                      onLabel="ON"
                      offLabel="OFF"
                      color="green"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Badge
                      color={campaign.status?.toUpperCase() === "ACTIVE" ? "green" : "gray"}
                      variant="light"
                    >
                      {campaign.status}
                    </Badge>
                  </Group>
                </Table.Td>

                {columns.objective && (
                  <Table.Td>
                    <Text size="sm">{campaign.objective}</Text>
                  </Table.Td>
                )}

                {columns.dates && (
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="xs">Start: {new Date(campaign.startDate).toLocaleDateString()}</Text>
                      <Text size="xs">End: {campaign.endDate !== "No End Date"
                        ? new Date(campaign.endDate).toLocaleDateString()
                        : "Ongoing"}
                      </Text>
                    </Stack>
                  </Table.Td>
                )}

                {columns.spend && (
                  <Table.Td>
                    <Text fw={500} size="sm">
                      ${Number(campaign.spend || 0).toFixed(2)}
                    </Text>
                  </Table.Td>
                )}

                {columns.results && (
                  <Table.Td>
                    <Text size="sm">{campaign.results}</Text>
                  </Table.Td>
                )}

                {columns.metrics && (
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="xs">CTR: {campaign.ctr ? `${campaign.ctr}%` : "0%"}</Text>
                      <Text size="xs">CPC: ${campaign.cpc || "0.00"}</Text>
                      <Text size="xs">CPM: ${campaign.cpm || "0.00"}</Text>
                    </Stack>
                  </Table.Td>
                )}

                <Table.Td>
                  <Menu
                    position="bottom-end"
                    withArrow
                    offset={4}
                  >
                    <Menu.Target>
                      <ActionIcon onClick={(e) => e.stopPropagation()}>
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconPencil size={16} />}
                        component="a"
                        href={`/campaigns/${campaign.id}/edit`}
                      >
                        Edit Campaign
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconChartBar size={16} />}
                        component="a"
                        href={`/campaigns/${campaign.id}/analytics`}
                      >
                        View Analytics
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
                            onDeleteCampaign(campaign.id);
                          }
                        }}
                      >
                        Delete Campaign
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
