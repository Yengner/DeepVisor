'use client';

import { useState } from 'react';
import { Card, Group, Text, Button, SegmentedControl, Stack, RingProgress, ThemeIcon, SimpleGrid } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle, IconBrandTiktok, IconChartBar } from '@tabler/icons-react';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PlatformPerformanceProps {
    featuredPlatform: {
        leads: any;
        ctr: any;
        link_clicks: any;
        impressions: any;
        messages: any;
    };
    onViewAll: () => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */


export default function PlatformPerformance({ featuredPlatform, onViewAll }: PlatformPerformanceProps) {
    const [selectedMetric, setSelectedMetric] = useState<'leads' | 'ctr' | 'link_clicks' | 'impressions' | 'messages'>('leads');

    const topPlatform = featuredPlatform?.[selectedMetric] || {};

    const getPlatformIcon = (platform: string) => {
        switch (platform?.toLowerCase()) {
            case 'meta':
            case 'facebook':
                return <IconBrandFacebook size={24} />;
            case 'google':
                return <IconBrandGoogle size={24} />;
            case 'tiktok':
                return <IconBrandTiktok size={24} />;
            default:
                return <IconChartBar size={24} />;
        }
    };

    // Define what metrics to show based on selected metric
    const getMetricData = () => {
        if (!topPlatform) return [];

        switch (selectedMetric) {
            case 'leads':
                return [
                    { label: 'Leads', value: topPlatform.total_leads?.toLocaleString() || '0' },
                    { label: 'Conversion Rate', value: `${(topPlatform.total_conversions || 0).toFixed(2)}%` },
                    { label: 'Cost per Lead', value: `$${((topPlatform.total_spend || 0) / (topPlatform.total_leads || 1)).toFixed(2)}` }
                ];
            case 'ctr':
                return [
                    { label: 'CTR', value: `${topPlatform.total_ctr?.toFixed(2) || '0'}%` },
                    { label: 'Clicks', value: topPlatform.total_clicks?.toLocaleString() || '0' },
                    { label: 'Impressions', value: topPlatform.total_impressions?.toLocaleString() || '0' }
                ];
            case 'link_clicks':
                return [
                    { label: 'Link Clicks', value: topPlatform.total_link_clicks?.toLocaleString() || '0' },
                    { label: 'CPC', value: `$${((topPlatform.total_spend || 0) / (topPlatform.total_link_clicks || 1)).toFixed(2)}` },
                    { label: 'Click Rate', value: `${((topPlatform.total_link_clicks || 0) / (topPlatform.total_impressions || 1) * 100).toFixed(2)}%` }
                ];
            case 'impressions':
                return [
                    { label: 'Impressions', value: topPlatform.total_impressions?.toLocaleString() || '0' },
                    { label: 'CPM', value: `$${((topPlatform.total_spend || 0) / (topPlatform.total_impressions || 1000)).toFixed(2)}` },
                    { label: 'Reach', value: topPlatform.total_impressions?.toLocaleString() || '0' }
                ];
            case 'messages':
                return [
                    { label: 'Messages', value: topPlatform.total_messages?.toLocaleString() || '0' },
                    { label: 'Cost per Message', value: `$${((topPlatform.total_spend || 0) / (topPlatform.total_messages || 1)).toFixed(2)}` },
                    { label: 'Message Rate', value: `${((topPlatform.total_messages || 0) / (topPlatform.total_impressions || 1) * 100).toFixed(2)}%` }
                ];
            default:
                return [];
        }
    };

    const metrics = getMetricData();

    return (
        <Card withBorder>
            <Card.Section withBorder inheritPadding py="xs">
                <Group justify="apart">
                    <Text fw={500}>Platform Performance</Text>
                    <Button variant="subtle" size='compact-md' onClick={onViewAll}>View All</Button>
                </Group>
            </Card.Section>

            <Stack gap="md" pt="md">
                <SegmentedControl
                    value={selectedMetric}
                    onChange={(value) => setSelectedMetric(value as any)}
                    data={[
                        { label: 'Leads', value: 'leads' },
                        { label: 'CTR', value: 'ctr' },
                        { label: 'Link Clicks', value: 'link_clicks' },
                        { label: 'Impressions', value: 'impressions' },
                        { label: 'Messages', value: 'messages' },
                    ]}
                    fullWidth
                />

                {topPlatform?.platform_name ? (
                    <>
                        <Group justify="center" gap="xl">
                            <RingProgress
                                sections={[{ value: 65, color: 'blue' }]}
                                label={
                                    <Group justify="center">
                                        <ThemeIcon color="blue" variant="light" size="xl" radius="xl">
                                            {getPlatformIcon(topPlatform.platform_name)}
                                        </ThemeIcon>
                                    </Group>
                                }
                                size={150}
                                thickness={16}
                            />

                            <Stack gap={0}>
                                <Text size="xl" fw={700} tt="capitalize">
                                    {topPlatform.platform_name}
                                </Text>
                                <Text c="dimmed">Top Platform by {selectedMetric.replace('_', ' ')}</Text>
                                <Text size="sm" mt="md">Total Spend: ${topPlatform.total_spend?.toLocaleString() || '0'}</Text>
                            </Stack>
                        </Group>

                        <SimpleGrid cols={3}>
                            {metrics.map((metric) => (
                                <Stack key={metric.label} gap={0} align="center">
                                    <Text size="xl" fw={700}>{metric.value}</Text>
                                    <Text size="sm" c="dimmed">{metric.label}</Text>
                                </Stack>
                            ))}
                        </SimpleGrid>
                    </>
                ) : (
                    <Stack align="center" justify="center" h={200} gap="xs">
                        <Text c="dimmed">No platform data available</Text>
                    </Stack>
                )}
            </Stack>
        </Card>
    );
}