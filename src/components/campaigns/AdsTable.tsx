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
  Button
} from '@mantine/core';
import {
  IconDots,
  IconPencil,
  IconTrash,
  IconChartBar,
  IconPhoto,
  IconEye,
  IconPlus
} from '@tabler/icons-react';
import useSWR from 'swr';
import { fetcher } from '@/utils/fetcher';

// Changed prop from campaignId to adsetId
interface AdsTableProps {
  adsetId: string;
}

export default function AdsTable({ adsetId }: AdsTableProps) {
  const { data: ads, error, isLoading } = useSWR(
    adsetId ? `/api/campaigns/[campaignId]/${adsetId}/ads` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  if (error) {
    return (
      <Paper p="md" radius="md">
        <Text c="red">Failed to load ads: {error.message}</Text>
      </Paper>
    );
  }

  const handleAddAd = () => {
    // Replace with your modal or form logic
    alert('Add Ad for ad set: ' + adsetId);
  };

  if (isLoading) {
    return (
      <Paper p="md" radius="md">
        <Group justify="apart" mb="md">
          <Text size="lg" fw={500}>Ads</Text>
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
      <Group justify="space-between" align="center" px="md" py="sm" mb="sm" style={{ background: "#f8fafc", borderRadius: 8 }}>
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
            <Table.Th>Ad Name</Table.Th>
            <Table.Th>Preview</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Spend</Table.Th>
            <Table.Th>Results</Table.Th>
            <Table.Th>Cost/Result</Table.Th>
            <Table.Th>Impressions</Table.Th>
            <Table.Th>Clicks</Table.Th>
            <Table.Th>CTR</Table.Th>
            <Table.Th style={{ width: 50 }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ads.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={11}>
                <Text ta="center" py="md" c="dimmed">
                  No ads found for this ad set
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ads.map((ad: any) => {
              const conversionActions = ad.leads + ad.messages;
              const results = conversionActions > 0 ? `${conversionActions} ${conversionActions === 1 ? 'Lead' : 'Leads'}` : "0 Leads";
              const costPerResult = conversionActions > 0 ? `$${(ad.spend / conversionActions).toFixed(2)}` : "$0.00";
              const isActive = ad.status === "ACTIVE";
              const previewImage = ad.raw_data?.creative?.image_url || ad.raw_data?.creative?.video_url || null;

              return (
                <Table.Tr
                  key={ad.ad_id}
                  style={{
                    cursor: 'pointer'
                  }}
                >
                  <Table.Td></Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {ad.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Box w={40}>
                      <Avatar src={previewImage} radius="sm">
                        <IconPhoto size={16} />
                      </Avatar>
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Switch
                        checked={isActive}
                        size="sm"
                        onLabel="ON"
                        offLabel="OFF"
                        color="green"
                        readOnly
                        onClick={e => e.stopPropagation()}
                      />
                      <Badge
                        color={isActive ? "green" : "gray"}
                        variant="light"
                      >
                        {ad.status}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>${ad.spend.toFixed(2)}</Table.Td>
                  <Table.Td>{results}</Table.Td>
                  <Table.Td>{costPerResult}</Table.Td>
                  <Table.Td>{ad.impressions.toLocaleString()}</Table.Td>
                  <Table.Td>{ad.clicks.toLocaleString()}</Table.Td>
                  <Table.Td>{ad.ctr > 0 ? `${(ad.ctr * 100).toFixed(2)}%` : "0.00%"}</Table.Td>
                  <Table.Td>
                    <Group gap={8}>
                      {previewImage && (
                        <Tooltip label="Preview Ad">
                          <ActionIcon color="blue" variant="light" component="a" href={previewImage} target="_blank" onClick={e => e.stopPropagation()}>
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon onClick={e => e.stopPropagation()}>
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
