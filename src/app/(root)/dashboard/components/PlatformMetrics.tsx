'use client';

import { Card, Group, Text, Table, ThemeIcon, Badge } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle, IconBrandTiktok, IconChartBar } from '@tabler/icons-react';

interface PlatformMetricsProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    platforms: any[];
}

export default function PlatformMetrics({ platforms }: PlatformMetricsProps) {
    const getPlatformIcon = (platform: string) => {
        switch (platform?.toLowerCase()) {
            case 'meta':
            case 'facebook':
                return <IconBrandFacebook size={18} />;
            case 'google':
                return <IconBrandGoogle size={18} />;
            case 'tiktok':
                return <IconBrandTiktok size={18} />;
            default:
                return <IconChartBar size={18} />;
        }
    };

    return (
        <Card withBorder>
            <Card.Section withBorder inheritPadding py="xs">
                <Text fw={500}>Platform Metrics</Text>
            </Card.Section>

            {platforms && platforms.length > 0 ? (
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Platform</Table.Th>
                            <Table.Th>Spend</Table.Th>
                            <Table.Th>Leads</Table.Th>
                            <Table.Th>Clicks</Table.Th>
                            <Table.Th>CTR</Table.Th>
                            <Table.Th>Impressions</Table.Th>
                            <Table.Th>Messages</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {platforms.map((platform) => (
                            <Table.Tr key={platform.platform_integration_id}>
                                <Table.Td>
                                    <Group gap="xs">
                                        <ThemeIcon size="md" variant="light">
                                            {getPlatformIcon(platform.platform_name)}
                                        </ThemeIcon>
                                        <Text fw={500} tt="capitalize">{platform.platform_name}</Text>
                                    </Group>
                                </Table.Td>
                                <Table.Td>
                                    <Badge color="green" variant="light">
                                        ${platform.total_spend?.toLocaleString() || '0'}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>{platform.total_leads?.toLocaleString() || '0'}</Table.Td>
                                <Table.Td>{platform.total_clicks?.toLocaleString() || '0'}</Table.Td>
                                <Table.Td>{platform.total_ctr?.toFixed(2) || '0'}%</Table.Td>
                                <Table.Td>{platform.total_impressions?.toLocaleString() || '0'}</Table.Td>
                                <Table.Td>{platform.total_messages?.toLocaleString() || '0'}</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            ) : (
                <Group justify="center" style={{ height: 200 }} gap="xs">
                    <Text c="dimmed">No platform data available</Text>
                </Group>
            )}
        </Card>
    );
}