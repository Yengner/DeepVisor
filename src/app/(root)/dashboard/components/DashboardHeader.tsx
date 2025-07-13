'use client';

import { AdAccountData } from '@/lib/api/platforms/types';
import { Box, Group, Card, Title, Text, Badge, Button, Menu, ActionIcon } from '@mantine/core';
import { IconRefresh, IconSettings, IconTarget, IconBell } from '@tabler/icons-react';

/**
 * DashboardHeader component displays the header section of the dashboard
 * @prop: 
 * - platformName: Name of the platform (e.g., Facebook, Google)
 * - businessName: Name of the business or user
 * - adAccountData: Data related to the ad account
 * - OnRefresh: Function to call when the refresh button is clicked
 * - refreshing: Boolean indicating if the dashboard is currently refreshing
 */
interface DashboardHeaderProps {
    platformName: string;
    businessName: string;
    adAccountData: AdAccountData;
    onRefresh: () => void;
    refreshing: boolean;
}

/**
 * Formats a timestamp into a readable date and time string
 * @param timestamp - ISO timestamp string (e.g., "2025-07-13T15:00:04")
 * @returns Formatted string (e.g., "July 13, 2025, 3:00 PM")
 */
export function formatLastSynced(timestamp: string): string {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
    };
    return date.toLocaleString('en-US', options);
}

export default function DashboardHeader({
    platformName,
    businessName,
    adAccountData,
    onRefresh,
    refreshing,
}: DashboardHeaderProps) {
    return (
        <Card withBorder mb="xl" p="lg">
            <Group justify="space-between" align="center">
                {/* Left Section */}
                <Box>
                    <Group gap="sm" mb="xs">
                        <Text size="sm" c="dimmed">Welcome back,</Text>
                        <Badge size="md" variant="light" color="blue">
                            {platformName}
                        </Badge>
                        <Badge size="md" variant="light" color="green">
                            {adAccountData.name}
                        </Badge>
                    </Group>
                    <Title order={2} size="h3">
                        {businessName} Dashboard
                    </Title>
                </Box>

                {/* Right Section */}
                <Group align="center">
                    <Text size="xs" c="dimmed">
                        Last refreshed: {formatLastSynced(adAccountData.last_synced)}
                    </Text>
                    <Button
                        leftSection={<IconRefresh size={16} />}
                        variant="light"
                        onClick={onRefresh}
                        loading={refreshing}
                    >
                        Refresh
                    </Button>
                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <ActionIcon variant="light" size="lg">
                                <IconSettings size={16} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item leftSection={<IconTarget size={14} />}>
                                Set Goals
                            </Menu.Item>
                            <Menu.Item leftSection={<IconBell size={14} />}>
                                Alert Settings
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Group>
        </Card>
    );
}