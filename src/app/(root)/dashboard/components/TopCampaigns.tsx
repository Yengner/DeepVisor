'use client';

import { Card, Group, Text, Button, Badge, Table, ThemeIcon } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle, IconBrandTiktok, IconChartBar } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface TopCampaignsProps {
    campaigns: any[];
    onViewAll: () => void;
    showAll?: boolean;
}

export default function TopCampaigns({ campaigns, onViewAll, showAll = false }: TopCampaignsProps) {
    const router = useRouter();

    const getPlatformIcon = (platform: string) => {
        switch (platform?.toLowerCase()) {
            case 'meta':
            case 'facebook':
                return <IconBrandFacebook size={16} />;
            case 'google':
                return <IconBrandGoogle size={16} />;
            case 'tiktok':
                return <IconBrandTiktok size={16} />;
            default:
                return <IconChartBar size={16} />;
        }
    };

    // Helper function to determine badge color based on campaign status
    const getStatusColor = (status: string): string => {
        switch (status?.toLowerCase()) {
            case 'active':
                return 'green';
            case 'paused':
                return 'yellow';
            case 'completed':
                return 'blue';
            case 'scheduled':
                return 'violet';
            case 'failed':
            case 'rejected':
                return 'red';
            default:
                return 'gray';
        }
    };

    return (
        <Card withBorder h="100%">
            <Card.Section withBorder inheritPadding py="xs">
                <Group justify="apart">
                    <Text fw={500}>Top Campaigns</Text>
                    {!showAll && <Button variant="subtle" size='compact-md' onClick={onViewAll}>View All</Button>}
                </Group>
            </Card.Section>

            {campaigns && campaigns.length > 0 ? (
                <Table verticalSpacing="sm">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Campaign</Table.Th>
                            <Table.Th>Platform</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Conv.</Table.Th>
                            <Table.Th>Clicks</Table.Th>
                            <Table.Th>Spend</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {campaigns.map((campaign) => (
                            <Table.Tr key={campaign.campaign_id || campaign.id}>
                                <Table.Td>
                                    <Text size="sm" fw={500}>
                                        {campaign.campaign_name || campaign.name}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Group gap="xs">
                                        <ThemeIcon size="sm" variant="light">
                                            {getPlatformIcon(campaign.platform_name)}
                                        </ThemeIcon>
                                        <Text size="sm">{campaign.platform_name}</Text>
                                    </Group>
                                </Table.Td>
                                <Table.Td>
                                    <Badge color={getStatusColor(campaign.status)} size="sm">
                                        {campaign.status}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>{campaign.conversion || 0}</Table.Td>
                                <Table.Td>{campaign.clicks?.toLocaleString() || 0}</Table.Td>
                                <Table.Td>${campaign.spend?.toLocaleString() || '0'}</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            ) : (
                <Group justify="center" style={{ height: 200 }} gap="xs">
                    <Text c="dimmed">No campaigns found</Text>
                    <Button variant="light" size="sm" onClick={() => router.push('/campaigns/new')}>
                        Create Campaign
                    </Button>
                </Group>
            )}
        </Card>
    );
}