'use client';

import { useState } from 'react';
import {
    Container,
    SimpleGrid,
    Card,
    Group,
    Box,
    Text,
    Button,
    Paper,
    Stack,
    Progress,
    Alert,
    Badge,
    ActionIcon,
    Grid,
} from '@mantine/core';
import {
    IconAlertCircle,
    IconFileExport,
    IconList,
    IconCurrencyDollar,
    IconUsers,
    IconMouse,
    IconChartLine,
    IconArrowUpRight,
    IconClock,
} from '@tabler/icons-react';
import DashboardHeader, { formatLastSynced } from './DashboardHeader';


export type DashboardClientProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userData: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    platform: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adAccountData: any;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

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

const toPercentNumber = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return 0;
    if (value === 0) return 0;
    const normalized = value < 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, normalized));
};

export default function DashboardClient({
    userData,
    platform,
    adAccountData,
}: DashboardClientProps) {
    const [refreshing, setRefreshing] = useState(false);
    const aggregatedMetrics = adAccountData?.aggregated_metrics || {};

    const messageRate = aggregatedMetrics.clicks
        ? aggregatedMetrics.messages / aggregatedMetrics.clicks
        : 0;
    const leadRate = aggregatedMetrics.clicks ? aggregatedMetrics.leads / aggregatedMetrics.clicks : 0;

    const handleRefresh = async () => {
        setRefreshing(true);
        // Simulate refresh logic
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    };

    const statCards = [
        {
            label: 'Spend',
            value: formatCurrency(aggregatedMetrics.spend),
            helper: 'Total tracked spend',
            icon: IconCurrencyDollar,
            color: 'cyan',
        },
        {
            label: 'Leads',
            value: formatNumber(aggregatedMetrics.leads),
            helper: `${formatNumber(aggregatedMetrics.messages)} messages`,
            icon: IconUsers,
            color: 'teal',
        },
        {
            label: 'CTR',
            value: formatPercent(aggregatedMetrics.ctr),
            helper: `${formatNumber(aggregatedMetrics.clicks)} clicks`,
            icon: IconMouse,
            color: 'violet',
        },
        {
            label: 'Reach',
            value: formatNumber(aggregatedMetrics.reach ?? aggregatedMetrics.impressions),
            helper: `${formatNumber(aggregatedMetrics.impressions)} impressions`,
            icon: IconChartLine,
            color: 'blue',
        },
    ];

    const secondaryMetrics = [
        { label: 'Avg CPC', value: formatCurrency(aggregatedMetrics.cpc) },
        { label: 'Avg CPM', value: formatCurrency(aggregatedMetrics.cpm) },
        {
            label: 'Link clicks',
            value: formatNumber(aggregatedMetrics.link_clicks ?? aggregatedMetrics.clicks),
        },
    ];

    const qualitySignals = [
        {
            label: 'Click-through rate',
            value: formatPercent(aggregatedMetrics.ctr),
            progress: toPercentNumber(aggregatedMetrics.ctr),
            color: 'teal',
            caption: 'Clicks relative to impressions',
        },
        {
            label: 'Message rate',
            value: formatPercent(messageRate),
            progress: toPercentNumber(messageRate),
            color: 'blue',
            caption: 'Messages per click (proxy for intent)',
        },
        {
            label: 'Lead rate',
            value: formatPercent(leadRate),
            progress: toPercentNumber(leadRate),
            color: 'violet',
            caption: 'Leads generated per click',
        },
    ];

    const campaignPlaceholders = [
        { title: 'Campaign pacing', value: 'Awaiting fresh data', badge: 'Momentum' },
        { title: 'Creative fatigue', value: 'No signals yet', badge: 'Quality' },
        { title: 'Audience insights', value: 'Populating after next sync', badge: 'Reach' },
    ];

    return (
        <Container size="xl" py="md">
            <DashboardHeader
                businessName={userData.business_name || userData?.full_name + "'s Business"}
                platformName={platform.platform_name}
                adAccountData={adAccountData}
                onRefresh={handleRefresh}
                refreshing={refreshing}
            />

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
                {statCards.map((card) => (
                    <Card
                        key={card.label}
                        withBorder
                        radius="lg"
                        p="lg"
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(14,165,233,0.02))',
                        }}
                    >
                        <Group justify="space-between" mb="sm">
                            <Badge size="sm" variant="light" color={card.color}>
                                {card.label}
                            </Badge>
                            <ActionIcon variant="subtle" color={card.color}>
                                <card.icon size={16} />
                            </ActionIcon>
                        </Group>
                        <Text fw={800} size="xl">
                            {card.value}
                        </Text>
                        <Text size="sm" c="dimmed">
                            {card.helper}
                        </Text>
                    </Card>
                ))}
            </SimpleGrid>

            <Grid columns={12} gutter="xl" mb="xl">
                <Grid.Col span={{ base: 12, lg: 8 }}>
                    <Stack gap="lg">
                        <Paper withBorder radius="lg" p="lg">
                            <Group justify="space-between" align="center" mb="sm">
                                <div>
                                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                        Performance pulse
                                    </Text>
                                    <Text fw={700} size="lg">
                                        Acquisition overview
                                    </Text>
                                </div>
                                <Badge color="blue" variant="light">
                                    Live view
                                </Badge>
                            </Group>

                            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
                                {secondaryMetrics.map((metric) => (
                                    <Card key={metric.label} withBorder radius="md" p="md">
                                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                            {metric.label}
                                        </Text>
                                        <Text fw={700} size="lg">
                                            {metric.value}
                                        </Text>
                                    </Card>
                                ))}
                            </SimpleGrid>

                            <Box
                                h={220}
                                p="md"
                                style={{
                                    position: 'relative',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    background:
                                        'linear-gradient(180deg, rgba(14,165,233,0.08), rgba(15,23,42,0.55))',
                                    border: '1px dashed var(--mantine-color-gray-5)',
                                }}
                            >
                                <Box
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background:
                                            'radial-gradient(circle at 20% 30%, rgba(14,165,233,0.18), transparent 38%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.18), transparent 30%)',
                                        opacity: 0.7,
                                    }}
                                />
                                <Stack align="center" justify="center" h="100%" gap={4}>
                                    <Text c="dimmed" size="sm">
                                        Performance chart will populate after your next sync.
                                    </Text>
                                    <Group gap="xs" align="center">
                                        <IconArrowUpRight size={14} color="var(--mantine-color-blue-5)" />
                                        <Text size="xs" c="dimmed">
                                            We keep this view live against your ad accounts.
                                        </Text>
                                    </Group>
                                </Stack>
                            </Box>
                        </Paper>

                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                            <Paper withBorder radius="lg" p="lg">
                                <Group justify="space-between" mb="sm">
                                    <div>
                                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                            Quality
                                        </Text>
                                        <Text fw={700}>Engagement health</Text>
                                    </div>
                                    <Badge color="teal" variant="light">
                                        Real-time
                                    </Badge>
                                </Group>
                                <Stack gap="md">
                                    {qualitySignals.map((signal) => (
                                        <Box key={signal.label}>
                                            <Group justify="space-between">
                                                <Text size="sm" fw={600}>
                                                    {signal.label}
                                                </Text>
                                                <Text size="sm" c="dimmed">
                                                    {signal.value}
                                                </Text>
                                            </Group>
                                            <Progress
                                                value={signal.progress}
                                                color={signal.color}
                                                size="lg"
                                                radius="xl"
                                            />
                                            <Text size="xs" c="dimmed" mt={4}>
                                                {signal.caption}
                                            </Text>
                                        </Box>
                                    ))}
                                </Stack>
                            </Paper>

                            <Paper withBorder radius="lg" p="lg">
                                <Group justify="space-between" mb="sm">
                                    <div>
                                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                            Campaigns
                                        </Text>
                                        <Text fw={700}>Snapshot</Text>
                                    </div>
                                    <ActionIcon variant="subtle" color="blue">
                                        <IconArrowUpRight size={16} />
                                    </ActionIcon>
                                </Group>
                                <Stack gap="sm">
                                    {campaignPlaceholders.map((item) => (
                                        <Group
                                            key={item.title}
                                            justify="space-between"
                                            style={{
                                                border: '1px solid var(--mantine-color-gray-3)',
                                                borderRadius: 12,
                                                padding: '12px 14px',
                                            }}
                                        >
                                            <div>
                                                <Text fw={600}>{item.title}</Text>
                                                <Text size="sm" c="dimmed">
                                                    {item.value}
                                                </Text>
                                            </div>
                                            <Badge variant="light" color="gray">
                                                {item.badge}
                                            </Badge>
                                        </Group>
                                    ))}
                                    <Text size="xs" c="dimmed">
                                        We will surface pacing, creative fatigue, and CPA movements here once data flows.
                                    </Text>
                                </Stack>
                            </Paper>
                        </SimpleGrid>
                    </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, lg: 4 }}>
                    <Stack gap="lg">
                        <Paper
                            withBorder
                            radius="lg"
                            p="lg"
                            style={{
                                background:
                                    'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.04))',
                            }}
                        >
                            <Group justify="space-between" mb="sm">
                                <div>
                                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                        Quick actions
                                    </Text>
                                    <Text fw={700}>Keep momentum</Text>
                                </div>
                                <Badge color="blue" variant="light">
                                    Recommended
                                </Badge>
                            </Group>
                            <Stack>
                                <Button
                                    leftSection={<IconList size={16} />}
                                    variant="gradient"
                                    gradient={{ from: 'blue', to: 'cyan' }}
                                    fullWidth
                                >
                                    View all campaigns
                                </Button>
                                <Button
                                    leftSection={<IconFileExport size={16} />}
                                    variant="light"
                                    color="gray"
                                    fullWidth
                                >
                                    Export snapshot
                                </Button>
                                <Button
                                    variant="light"
                                    color="blue"
                                    fullWidth
                                    onClick={handleRefresh}
                                    loading={refreshing}
                                    leftSection={<IconArrowUpRight size={16} />}
                                >
                                    Refresh data
                                </Button>
                            </Stack>
                            <Group gap="xs" mt="md">
                                <IconClock size={14} color="var(--mantine-color-gray-6)" />
                                <Text size="xs" c="dimmed">
                                    Last synced {formatLastSynced(adAccountData.last_synced)}
                                </Text>
                            </Group>
                        </Paper>

                        <Paper withBorder radius="lg" p="lg">
                            <Group justify="space-between" mb="sm">
                                <Text fw={700}>Notifications</Text>
                                <Badge color="yellow" variant="light">
                                    Quiet
                                </Badge>
                            </Group>
                            <Stack>
                                <Alert icon={<IconAlertCircle size={16} />} color="yellow" mb="xs">
                                    No notifications yet.
                                </Alert>
                                <Text size="xs" c="dimmed">
                                    Performance and delivery alerts will show up here once campaigns begin pacing.
                                </Text>
                            </Stack>
                        </Paper>
                    </Stack>
                </Grid.Col>
            </Grid>
        </Container>
    );
}
