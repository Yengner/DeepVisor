'use client';

import { useState } from 'react';
import {
    Title,
    Text,
    Group,
    SimpleGrid,
    Card,
    Button,
    Badge,
    Stack,
    Tabs,
    rem,
    useMantineTheme,
    ThemeIcon,
    ActionIcon
} from '@mantine/core';
import {
    IconRefresh,
    IconChartBar,
    IconBrandFacebook,
    IconBrandGoogle,
    IconBrandTiktok,
    IconAlertCircle,
    IconArrowUp,
    IconArrowDown,
    IconPresentationAnalytics,
    IconChartPie,
    IconBulb,
    IconCoin,
    IconClick,
    IconEye
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import StatsCards from './StatsCards';
import PlatformPerformance from './PlatformPerformance';
import TopCampaigns from './TopCampaigns';
import Recommendations from './Recommendations';
import PlatformMetrics from './PlatformMetrics';


interface DashboardClientProps {
    userData: any;
    businessName: string;
    platforms: any[];
    featuredPlatform: any;
    platformMetrics: any[];
    campaigns: any[];
    recommendations: any[];
}

export default function DashboardClient({
    userData,
    businessName,
    platforms,
    featuredPlatform,
    platformMetrics,
    campaigns,
    recommendations
}: DashboardClientProps) {
    const router = useRouter();
    const theme = useMantineTheme();
    const [refreshing, setRefreshing] = useState(false);

    // Calculate aggregated stats
    const totalSpend = platformMetrics.reduce((sum, p) => sum + (p.total_spend || 0), 0);
    const totalImpressions = platformMetrics.reduce((sum, p) => sum + (p.total_impressions || 0), 0);
    const totalClicks = platformMetrics.reduce((sum, p) => sum + (p.total_clicks || 0), 0);
    const totalLeads = platformMetrics.reduce((sum, p) => sum + (p.total_leads || 0), 0);

    const handleRefresh = async () => {
        setRefreshing(true);
        // Add your refresh logic here
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    };

    return (
        <Stack gap="xl">
            {/* Header Section */}
            <Group justify="apart">
                <div>
                    <Title order={2}>{businessName} Dashboard</Title>
                    <Text c="dimmed">Overview of your advertising performance</Text>
                </div>
                <Button
                    leftSection={<IconRefresh size={16} />}
                    variant="light"
                    onClick={handleRefresh}
                    loading={refreshing}
                >
                    Refresh Data
                </Button>
            </Group>

            {/* Stats Cards */}
            <StatsCards
                totalSpend={totalSpend}
                totalImpressions={totalImpressions}
                totalClicks={totalClicks}
                totalLeads={totalLeads}
            />

            {/* Tab Navigation */}
            <Tabs defaultValue="overview">
                <Tabs.List>
                    <Tabs.Tab
                        value="overview"
                        leftSection={<IconChartPie size={16} />}
                    >
                        Overview
                    </Tabs.Tab>
                    <Tabs.Tab
                        value="platforms"
                        leftSection={<IconBrandFacebook size={16} />}
                    >
                        Platforms
                    </Tabs.Tab>
                    <Tabs.Tab
                        value="campaigns"
                        leftSection={<IconPresentationAnalytics size={16} />}
                    >
                        Campaigns
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="overview" pt="md">
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        {/* Platform Performance */}
                        <PlatformPerformance
                            featuredPlatform={featuredPlatform}
                            onViewAll={() => router.push('/dashboard/platforms')}
                        />

                        {/* Top Campaigns */}
                        <TopCampaigns
                            campaigns={campaigns.slice(0, 5)}
                            onViewAll={() => router.push('/campaigns')}
                        />
                    </SimpleGrid>

                    {/* Recommendations */}
                    <Card withBorder mt="md">
                        <Card.Section withBorder inheritPadding py="xs">
                            <Group justify="apart">
                                <Group>
                                    <ThemeIcon color="yellow" size="md" variant="light">
                                        <IconBulb size={16} />
                                    </ThemeIcon>
                                    <Text fw={500}>AI Recommendations</Text>
                                </Group>
                            </Group>
                        </Card.Section>

                        <Recommendations recommendations={recommendations} />
                    </Card>
                </Tabs.Panel>

                <Tabs.Panel value="platforms" pt="md">
                    <PlatformMetrics platforms={platformMetrics} />
                </Tabs.Panel>

                <Tabs.Panel value="campaigns" pt="md">
                    <TopCampaigns
                        campaigns={campaigns}
                        onViewAll={() => router.push('/campaigns')}
                        showAll
                    />
                </Tabs.Panel>
            </Tabs>
        </Stack>
    );
}