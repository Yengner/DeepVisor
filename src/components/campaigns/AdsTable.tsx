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
  Avatar,
  Box,
  Tooltip
} from '@mantine/core';
import {
  IconDots,
  IconPencil,
  IconTrash,
  IconChartBar,
  IconPhoto,
  IconEye
} from '@tabler/icons-react';

// Updated interface to match actual ads_metrics data
interface Ad {
  id: number;
  campaign_id: string;
  adset_id: string;
  ad_id: string;
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
    creative?: {
      image_url?: string;
      video_url?: string;
    };
  };
  created_at: string;
  updated_at: string;
  platform_name: string;
}

// Changed prop from campaignId to adsetId
interface AdsTableProps {
  adsetId: string;
}

export default function AdsTable({ adsetId }: AdsTableProps) {
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    async function fetchAds() {
      setLoading(true);
      try {
        const response = await fetch(`/api/campaigns/[campaignId]/${adsetId}/ads`);
        if (response.ok) {
          const data = await response.json();
          setAds(data);
        }
      } catch (error) {
        console.error("Failed to fetch ads:", error);
        setAds([]);
      } finally {
        setLoading(false);
      }
    }

    if (adsetId) {
      fetchAds();
    } else {
      setLoading(false);
      setAds([]);
    }
  }, [adsetId]);
  
  if (loading) {
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
    <Paper p="md" radius="md">
      <Group justify="apart" mb="md">
        <Group>
          <ThemeIcon color="blue" variant="light" size="lg" radius="xl">
            <IconPhoto size={20} />
          </ThemeIcon>
          <Text size="lg" fw={500}>
            Ads for Ad Set
          </Text>
        </Group>
        <Badge variant="outline" color="blue">
          {ads.length} Ads
        </Badge>
      </Group>

      <Table striped highlightOnHover>
        <thead>
          <tr>
            <th>Ad Name</th>
            <th>Preview</th>
            <th>Status</th>
            <th>Spend</th>
            <th>Results</th>
            <th>Cost/Result</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ads.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ textAlign: 'center' }}>
                <Text c="dimmed">No ads found for this ad set</Text>
              </td>
            </tr>
          ) : (
            ads.map((ad) => {
              // Calculate derived metrics from raw data
              const conversionActions = ad.leads + ad.messages;
              const results = conversionActions > 0 ? `${conversionActions} ${conversionActions === 1 ? 'Lead' : 'Leads'}` : "0 Leads";
              const costPerResult = conversionActions > 0 ? `$${(ad.spend / conversionActions).toFixed(2)}` : "$0.00";
              const ctr = ad.clicks > 0 && ad.impressions > 0 ? `${(ad.clicks / ad.impressions * 100).toFixed(2)}%` : "0.00%";
              const isActive = ad.status === "ACTIVE";

              // Get preview image if available
              const previewImage = ad.raw_data?.creative?.image_url || ad.raw_data?.creative?.video_url || null;

              return (
                <tr key={ad.ad_id}>
                  <td>
                    <Text size="sm" fw={500}>
                      {ad.name}
                    </Text>
                  </td>
                  <td>
                    <Box w={{ width: 40 }}>
                      <Avatar src={previewImage} radius="sm">
                        <IconPhoto size={16} />
                      </Avatar>
                    </Box>
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
                        {ad.status}
                      </Badge>
                    </Group>
                  </td>
                  <td>${ad.spend.toFixed(2)}</td>
                  <td>{results}</td>
                  <td>{costPerResult}</td>
                  <td>{ad.impressions.toLocaleString()}</td>
                  <td>{ad.clicks.toLocaleString()}</td>
                  <td>{ad.ctr > 0 ? `${(ad.ctr * 100).toFixed(2)}%` : "0.00%"}</td>
                  <td>
                    <Group gap={8}>
                      {previewImage && (
                        <Tooltip label="Preview Ad">
                          <ActionIcon color="blue" variant="light" component="a" href={previewImage} target="_blank">
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
