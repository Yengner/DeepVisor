'use client';

import { AdAccountData } from '@/lib/server/data/types';
import { Box, Group, Card, Title, Text, Badge, Button, Menu, ActionIcon, Stack } from '@mantine/core';
import { IconRefresh, IconSettings, IconTarget, IconBell, IconClock, IconArrowUpRight } from '@tabler/icons-react';

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
export function formatLastSynced(timestamp: string | null): string {
    if (!timestamp) {
        return 'Not synced yet';
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return 'Not synced yet';
    }

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

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});

const formatCurrency = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '$0';
    return currencyFormatter.format(value);
};

const formatNumber = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '0';
    return numberFormatter.format(value);
};

const formatPercent = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '—';
    const normalized = value < 1 ? value * 100 : value;
    return `${normalized.toFixed(normalized >= 10 ? 0 : 1)}%`;
};

export default function DashboardHeader({
    platformName,
    businessName,
    adAccountData,
    onRefresh,
    refreshing,
}: DashboardHeaderProps) {
    const aggregated = adAccountData?.aggregated_metrics || {};
    const accountStatus = adAccountData?.account_status?.replace(/_/g, ' ') || 'Active';

    const highlightMetrics = [
        { label: 'Spend to date', value: formatCurrency(aggregated.spend), tone: 'blue' },
        { label: 'CTR', value: formatPercent(aggregated.ctr), tone: 'teal' },
        {
            label: 'Reach',
            value: formatNumber(aggregated.reach ?? aggregated.impressions),
            tone: 'gray',
        },
    ];

    return (
        <Card
            withBorder
            radius="lg"
            mb="xl"
            p="xl"
            style={{
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(120deg, #0f172a 0%, #111827 50%, #0ea5e9 130%)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
        >
            <Box
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(circle at 20% 20%, rgba(14,165,233,0.2), transparent 32%), radial-gradient(circle at 80% 10%, rgba(14,165,233,0.25), transparent 26%)',
                }}
            />
            <Group justify="space-between" align="flex-start" pos="relative">
                <Stack gap="sm">
                    <Group gap="xs">
                        <Badge size="md" variant="light" color="cyan">
                            {platformName}
                        </Badge>
                        <Badge size="md" variant="outline" color="gray" fw={600}>
                            {accountStatus}
                        </Badge>
                        <Badge size="md" variant="light" color="green">
                            {adAccountData.name}
                        </Badge>
                    </Group>
                    <Title order={2} size="h2" c="white">
                        {businessName} dashboard
                    </Title>
                    <Text size="sm" c="gray.3">
                        Connected to {adAccountData.platform_name} · Account {adAccountData.ad_account_id}
                    </Text>
                    <Group gap="sm" mt="sm">
                        <Button
                            leftSection={<IconRefresh size={16} />}
                            variant="white"
                            color="dark"
                            onClick={onRefresh}
                            loading={refreshing}
                        >
                            Refresh data
                        </Button>
                        <Button
                            variant="outline"
                            color="gray"
                            leftSection={<IconArrowUpRight size={16} />}
                        >
                            Open performance view
                        </Button>
                        <Menu shadow="md" width={200}>
                            <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" size="lg">
                                    <IconSettings size={16} />
                                </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item leftSection={<IconTarget size={14} />}>
                                    Set goals
                                </Menu.Item>
                                <Menu.Item leftSection={<IconBell size={14} />}>
                                    Alert settings
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </Group>
                </Stack>

                <Stack gap={8} align="flex-end">
                    <Group gap={6}>
                        <IconClock size={16} color="var(--mantine-color-gray-3)" />
                        <Text size="sm" c="gray.2">
                            Last synced {formatLastSynced(adAccountData.last_synced)}
                        </Text>
                    </Group>
                    <Badge variant="light" color="blue">
                        Live syncing
                    </Badge>
                </Stack>
            </Group>

            <Group mt="lg" gap="md" align="stretch" wrap="wrap" pos="relative">
                {highlightMetrics.map((metric) => (
                    <Box
                        key={metric.label}
                        p="md"
                        style={{
                            minWidth: 200,
                            flex: '1 1 0',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 12,
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        <Text size="xs" c="gray.3" tt="uppercase" fw={700}>
                            {metric.label}
                        </Text>
                        <Text fw={800} size="xl" c="white">
                            {metric.value}
                        </Text>
                        <Badge mt={8} size="sm" color={metric.tone} variant="light">
                            Updated with last sync
                        </Badge>
                    </Box>
                ))}
            </Group>
        </Card>
    );
}
