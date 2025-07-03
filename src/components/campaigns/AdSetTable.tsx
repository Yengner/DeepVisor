'use client';

import { useEffect, useState } from 'react';
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
  ThemeIcon,
  Skeleton,
  Tooltip,
  Checkbox
} from '@mantine/core';
import {
  IconDots,
  IconPencil,
  IconTrash,
  IconChartBar,
  IconTargetArrow,
  IconInfoCircle,
  IconCheck
} from '@tabler/icons-react';

interface AdSet {
  id: number;
  campaign_id: string;
  adset_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  clicks: number;
  impressions: number;
  spend: number;
  leads: number;
  reach: number;
  link_clicks: number;
  messages: number;
  cpm: number;
  ctr: number;
  cpc: number;
  raw_data: {
    id: string;
    name: string;
    status: string;
    optimization_goal: string;
  };
  created_at: string;
  updated_at: string;
  optimization_goal: string;
  platform_name: string;
}

interface AdSetTableProps {
  campaignId: string;
  onSelectAdSet?: (adsetId: string) => void;
  selectedAdSetId?: string | null;
}

export default function AdSetTable({ campaignId, onSelectAdSet, selectedAdSetId }: AdSetTableProps) {
  const [loading, setLoading] = useState(true);
  const [adSets, setAdSets] = useState<AdSet[]>([]);

  useEffect(() => {
    async function fetchAdSets() {
      setLoading(true);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/adsets`);
        if (response.ok) {
          const data = await response.json();
          setAdSets(data);
          
          // Auto-select first adset if available and none is currently selected
          if (data.length > 0 && onSelectAdSet && !selectedAdSetId) {
            onSelectAdSet(data[0].adset_id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch ad sets:", error);
        setAdSets([]);
      } finally {
        setLoading(false);
      }
    }

    if (campaignId) {
      fetchAdSets();
    } else {
      setLoading(false);
      setAdSets([]);
    }
  }, [campaignId, onSelectAdSet, selectedAdSetId]);

  const handleRowClick = (adsetId: string) => {
    if (onSelectAdSet) {
      onSelectAdSet(adsetId);
    }
  };

  if (loading) {
    return (
      <Paper p="md" radius="md">
        <Group justify="apart" mb="md">
          <Text size="lg" fw={500}>Ad Sets</Text>
          <Loader size="sm" />
        </Group>
        <Skeleton height={40} mb="sm" />
        <Skeleton height={40} mb="sm" />
        <Skeleton height={40} mb="sm" />
      </Paper>
    );
  }

  return (
    <Paper p="md" radius="md">
      <Group justify="apart" mb="md">
        <Group>
          <ThemeIcon color="blue" variant="light" size="lg" radius="xl">
            <IconTargetArrow size={20} />
          </ThemeIcon>
          <Text size="lg" fw={500}>
            Ad Sets for Campaign
          </Text>
        </Group>
        <Badge variant="outline" color="blue">
          {adSets.length} Ad Sets
        </Badge>
      </Group>

      <Table striped highlightOnHover>
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th>Ad Set Name</th>
            <th>Status</th>
            <th>Optimization Goal</th>
            <th>Spend</th>
            <th>Results</th>
            <th>Cost/Result</th>
            <th>Impressions</th>
            <th>Reach</th>
            <th>Frequency</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {adSets.length === 0 ? (
            <tr>
              <td colSpan={11} style={{ textAlign: 'center' }}>
                <Text c="dimmed">No ad sets found for this campaign</Text>
              </td>
            </tr>
          ) : (
            adSets.map((adSet) => {
              const conversionActions = adSet.leads + adSet.messages;
              const results = conversionActions > 0 ? `${conversionActions} ${conversionActions === 1 ? 'Lead' : 'Leads'}` : "0 Leads";
              const costPerResult = conversionActions > 0 ? `$${(adSet.spend / conversionActions).toFixed(2)}` : "$0.00";
              const frequency = adSet.reach > 0 ? (adSet.impressions / adSet.reach).toFixed(2) : "0";
              const isActive = adSet.status === "ACTIVE";
              const isSelected = selectedAdSetId === adSet.adset_id;

              return (
                <tr
                  key={adSet.adset_id}
                  onClick={() => handleRowClick(adSet.adset_id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined
                  }}
                >
                  {/* Selection indicator column */}
                  <td>
                    {isSelected && (
                      <ThemeIcon color="blue" radius="xl" size="sm">
                        <IconCheck size={14} />
                      </ThemeIcon>
                    )}
                  </td>
                  <td>
                    <Text size="sm" fw={isSelected ? 700 : 500}>
                      {adSet.name}
                    </Text>
                  </td>
                  <td>
                    <Group gap="xs">
                      <Switch
                        checked={isActive}
                        size="sm"
                        onLabel="ON"
                        offLabel="OFF"
                        color="green"
                        readOnly
                      />
                      <Badge
                        color={isActive ? "green" : "gray"}
                        variant="light"
                      >
                        {adSet.status}
                      </Badge>
                    </Group>
                  </td>
                  <td>
                    <Tooltip label="The result type this ad set is optimized for">
                      <Group gap="xs">
                        <Text size="sm">
                          {adSet.optimization_goal === "CONVERSATIONS" ? "Leads/Messages" :
                            adSet.optimization_goal === "LINK_CLICKS" ? "Link Clicks" :
                              adSet.optimization_goal}
                        </Text>
                        <IconInfoCircle size={14} style={{ opacity: 0.5 }} />
                      </Group>
                    </Tooltip>
                  </td>
                  <td>${adSet.spend.toFixed(2)}</td>
                  <td>{results}</td>
                  <td>{costPerResult}</td>
                  <td>{adSet.impressions.toLocaleString()}</td>
                  <td>{adSet.reach.toLocaleString()}</td>
                  <td>{frequency}</td>
                  <td>
                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <ActionIcon>
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={16} />}>
                          Edit Ad Set
                        </Menu.Item>
                        <Menu.Item leftSection={<IconChartBar size={16} />}>
                          View Analytics
                        </Menu.Item>
                        <Divider />
                        <Menu.Item color="red" leftSection={<IconTrash size={16} />}>
                          Delete Ad Set
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </Paper>
  );
}
