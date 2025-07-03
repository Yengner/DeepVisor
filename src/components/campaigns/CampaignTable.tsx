'use client';

import { useState } from 'react';
import {
  Table,
  Switch,
  Avatar,
  Text,
  Group,
  ActionIcon,
  Menu,
  Badge,
  Box,
  ScrollArea,
  UnstyledButton,
  Tooltip,
  ThemeIcon,
  Divider,
  Stack
} from '@mantine/core';
import {
  IconDots,
  IconPencil,
  IconTrash,
  IconChartBar,
  IconCheck,
  IconRobot
} from '@tabler/icons-react';

interface CampaignObject {
  id: string;
  name: string;
  delivery: boolean;
  type: "AI Auto" | "Manual" | "Semi-Auto";
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
  auto_optimize: boolean;
}

interface CampaignTableProps {
  campaigns: CampaignObject[];
  selectedCampaignId?: string;
  onSelectCampaign: (campaignId: string) => void;
  onToggleCampaign: (campaignId: string, newStatus: boolean) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onAutoOptimize: (campaignId: string, autoOptimize: boolean) => void;
}

const getPlatformImage = (platform?: string) => {
  switch ((platform || "meta").toLowerCase()) {
    case "meta":
      return "/images/platforms/logo/meta.png";
    case "tiktok":
      return "/images/platforms/logo/tiktok.png";
    case "google":
      return "/images/platforms/logo/google.png";
    default:
      return "/images/platforms/logo/default.png";
  }
};

export default function CampaignTable({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onToggleCampaign,
  onDeleteCampaign,
  onAutoOptimize,
}: CampaignTableProps) {
  // Column visibility state
  const [columns, setColumns] = useState({
    platform: true,
    status: true,
    objective: true,
    dates: true,
    spend: true,
    results: true,
    reach: true,
    clicks: true,
    impressions: true,
    metrics: true,
  });

  return (
    <Box>
      <ScrollArea>
        <Table striped highlightOnHover w={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Campaign</th>
              {columns.platform && <th>Platform</th>}
              <th>Status</th>
              {columns.objective && <th>Objective</th>}
              {columns.dates && <th>Date Range</th>}
              {columns.spend && <th>Spend</th>}
              {columns.results && <th>Results</th>}
              {columns.metrics && <th>KPI</th>}
              <th>AI Optimize</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <Text ta="center" py="md" color="dimmed">
                    No campaigns found
                  </Text>
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  style={{
                    background: selectedCampaignId === campaign.id ? 'rgba(51, 154, 240, 0.1)' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSelectCampaign(campaign.id)}
                >
                  <td>
                    {selectedCampaignId === campaign.id && (
                      <ThemeIcon radius="xl" size="sm" color="blue">
                        <IconCheck size={14} />
                      </ThemeIcon>
                    )}
                  </td>
                  <td>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {campaign.name}
                      </Text>
                      {campaign.type === "AI Auto" && (
                        <Tooltip label="AI Optimized Campaign">
                          <ThemeIcon color="blue" variant="light" radius="xl" size="xs">
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
                  </td>

                  {columns.platform && (
                    <td>
                      <Avatar
                        src={getPlatformImage(campaign.platform)}
                        alt={campaign.platform || "Meta"}
                        size="sm"
                        radius="xl"
                      />
                    </td>
                  )}

                  <td>
                    <Group gap="xs" wrap='nowrap'>
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
                      />
                      <Badge
                        color={campaign.status?.toUpperCase() === "ACTIVE" ? "green" : "gray"}
                        variant="light"
                      >
                        {campaign.status}
                      </Badge>
                    </Group>
                  </td>

                  {columns.objective && (
                    <td>
                      <Text size="sm">{campaign.objective}</Text>
                    </td>
                  )}

                  {columns.dates && (
                    <td>
                      <Stack gap={0}>
                        <Text size="xs">Start: {new Date(campaign.startDate).toLocaleDateString()}</Text>
                        <Text size="xs">End: {campaign.endDate !== "No End Date"
                          ? new Date(campaign.endDate).toLocaleDateString()
                          : "Ongoing"}
                        </Text>
                      </Stack>
                    </td>
                  )}

                  {columns.spend && (
                    <td>
                      <Text fw={500} size="sm">
                        ${Number(campaign.spend || 0).toFixed(2)}
                      </Text>
                    </td>
                  )}

                  {columns.results && (
                    <td>
                      <Text size="sm">{campaign.results}</Text>
                    </td>
                  )}

                  {columns.metrics && (
                    <td>
                      <Stack gap={0}>
                        <Text size="xs">CTR: {campaign.ctr ? `${campaign.ctr}%` : "0%"}</Text>
                        <Text size="xs">CPC: ${campaign.cpc || "0.00"}</Text>
                        <Text size="xs">CPM: ${campaign.cpm || "0.00"}</Text>
                      </Stack>
                    </td>
                  )}

                  <td>
                    <Switch
                      checked={campaign.auto_optimize}
                      onChange={(event) => {
                        event.stopPropagation();
                        onAutoOptimize(campaign.id, event.currentTarget.checked);
                      }}
                      size="sm"
                      color="cyan"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>

                  <td>
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
                        <Divider />
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
