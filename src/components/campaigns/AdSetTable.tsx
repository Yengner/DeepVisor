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
  Checkbox,
  ScrollArea,
  Stack
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
import useSWR from 'swr'
import { fetcher } from '@/utils/fetcher';

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

  const { data: adSets, error, isLoading } = useSWR(
    campaignId ? `/api/campaigns/${campaignId}/adsets` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const handleRowClick = (adsetId: string) => {
    if (onSelectAdSet) {
      onSelectAdSet(adsetId);
    }
  };

  if (isLoading) {
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
            <Table.Th>Ad Set</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Date Range</Table.Th>
            <Table.Th>Budget</Table.Th>
            <Table.Th>Results</Table.Th>
            <Table.Th>KPI</Table.Th>
            <Table.Th style={{ width: 50 }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {adSets.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text ta="center" py="md" c="dimmed">
                  No ad sets found
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            adSets.map((adset) => (
              <Table.Tr
                key={adset.adset_id}
                style={{
                  background: selectedAdSetId === adset.adset_id ? `rgba(var(--mantine-color-blue-light-rgb), 0.2)` : 'transparent',
                  cursor: 'pointer'
                }}
                onClick={() => handleRowClick(adset.adset_id)}
              >
                <Table.Td>
                  {selectedAdSetId === adset.adset_id && (
                    <ThemeIcon radius="xl" size="sm" color='blue'>
                      <IconCheck size={14} />
                    </ThemeIcon>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {adset.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Switch
                      checked={adset.delivery}
                      // onChange={(event) => {
                      //   event.stopPropagation();
                      //   onToggleAdSet(adset.id, event.currentTarget.checked);
                      // }}
                      size="sm"
                      onLabel="ON"
                      offLabel="OFF"
                      color="green"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Badge
                      color={adset.status?.toUpperCase() === "ACTIVE" ? "green" : "gray"}
                      variant="light"
                    >
                      {adset.status}
                    </Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Stack gap={0}>
                    <Text size="xs">Start: {new Date(adset.startDate).toLocaleDateString()}</Text>
                    <Text size="xs">End: {adset.endDate ? new Date(adset.endDate).toLocaleDateString() : "Ongoing"}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text fw={500} size="sm">
                    ${Number(adset.budget || 0).toFixed(2)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{adset.results}</Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={0}>
                    <Text size="xs">CTR: {adset.ctr ? `${adset.ctr}%` : "0%"}</Text>
                    <Text size="xs">CPC: ${adset.cpc || "0.00"}</Text>
                    <Text size="xs">CPM: ${adset.cpm || "0.00"}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Menu position="bottom-end" withArrow offset={4}>
                    <Menu.Target>
                      <ActionIcon onClick={(e) => e.stopPropagation()}>
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconPencil size={16} />}
                        component="a"
                        href={`/adsets/${adset.adset_id}/edit`}
                      >
                        Edit Ad Set
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                      // onClick={(e) => {
                      //   e.stopPropagation();
                      //   if (confirm(`Are you sure you want to delete "${adset.name}"?`)) {
                      //     onDeleteAdSet(adset.id);
                      //   }
                      // }}
                      >
                        Delete Ad Set
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
