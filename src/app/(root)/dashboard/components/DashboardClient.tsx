'use client';

import { useState } from 'react';
import {
    Container, SimpleGrid, Card, Group, Box, Text, Badge, ThemeIcon, Paper, Table, Progress, Button, Alert, Stack, Divider
} from '@mantine/core';
import {
    IconCurrencyDollar, IconUser, IconEye, IconClick, IconAlertCircle, IconFileExport, IconList
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import DashboardHeader from './DashboardHeader';
import { syncAdAccounts } from '@/lib/actions/sync/ad_accounts/syncAdAccounts';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardClientProps {
    userData: any;
    platform: any;
    adAccountData: any;
    topAdAccountCampaigns: any[];
}


export default function DashboardClient({
    userData,
    platform,
    adAccountData,
    topAdAccountCampaigns,
}: DashboardClientProps) {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    // Prepare trend data for graphs
    const monthly = adAccountData.time_increment_metrics?.["30"] || [];

    // For quick insights
    const bestMonth = monthly.reduce((best, curr) => (curr.leads > (best?.leads || 0) ? curr : best), null);
    const highestCTRMonth = monthly.reduce((best, curr) => {
        const ctr = curr.impressions ? (curr.clicks / curr.impressions) * 100 : 0;
        const bestCtr = best && best.impressions ? (best.clicks / best.impressions) * 100 : 0;
        return ctr > bestCtr ? curr : best;
    }, null);

    // Budget utilization
    let budgetMin = 0, budgetMax = 0;
    if (userData.monthly_budget) {
        const [min, max] = userData.monthly_budget.split('_').map(Number);
        budgetMin = min;
        budgetMax = max;
    }
    const budgetUsed = adAccountData.aggregated_metrics.spend;
    const budgetPercent = budgetMax ? Math.min(100, (budgetUsed / budgetMax) * 100) : 0;

    // Metric comparison (this month vs last month)
    const thisMonth = monthly[monthly.length - 1];
    const lastMonth = monthly[monthly.length - 2];
    const compare = (metric: string) =>
        thisMonth && lastMonth
            ? ((thisMonth[metric] - lastMonth[metric]) / (lastMonth[metric] || 1)) * 100
            : 0;

    // Prepare data for recharts
    const chartData = monthly.map((m) => ({
        name: `${m.date_start.slice(0, 7)}`,
        Spend: m.spend,
        Leads: m.actions?.lead ?? m.actions?.["onsite_conversion.lead_grouped"] ?? 0,
        Clicks: m.clicks,
        Impressions: m.impressions,
        Reach: m.reach,
        CTR: m.impressions ? (m.clicks / m.impressions) * 100 : 0,
    }));

    // Notifications
    const today = new Date();
    const notifications = topAdAccountCampaigns
        .filter(c => c.end_date && new Date(c.end_date) < today && c.status !== 'ACTIVE')
        .map(c => ({
            type: 'finished',
            message: `Campaign "${c.name}" just finished on ${c.end_date}.`,
        }));

    // Quick Actions (less prominent)
    const quickActions = [
        {
            label: 'View All Campaigns',
            icon: <IconList size={16} />,
            onClick: () => router.push('/campaigns'),
        },
        {
            label: 'Export Report',
            icon: <IconFileExport size={16} />,
            onClick: () => {/* implement export logic */ },
        },
    ];


    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            console.log('Starting ad account sync...');
            await syncAdAccounts(userData.id, adAccountData.ad_account_id, platform.id);
            console.log('Ad account sync completed successfully.');
            router.refresh(); // Refresh the page after syncing
        } catch (error) {
            console.error('Error syncing ad account:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    return (
        <Container size="xl" py="md">
            <DashboardHeader
                businessName={userData.business_name || userData?.full_name + "'s Business"}
                platformName={platform.platform_name}
                adAccountData={adAccountData}
                onRefresh={handleRefresh}
                refreshing={refreshing}
            />

            <SimpleGrid cols={{ base: 1, md: 4 }} spacing="lg" mb="xl">
                <Card withBorder p="md">
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Spend</Text>
                            <Text fw={700} size="xl">${adAccountData.aggregated_metrics.spend.toFixed(2)}</Text>
                        </Box>
                        <ThemeIcon size="lg" variant="light" color="green"><IconCurrencyDollar size={20} /></ThemeIcon>
                    </Group>
                </Card>
                <Card withBorder p="md">
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Leads</Text>
                            <Text fw={700} size="xl">{formatNumber(adAccountData.aggregated_metrics.leads)}</Text>
                        </Box>
                        <ThemeIcon size="lg" variant="light" color="blue"><IconUser size={20} /></ThemeIcon>
                    </Group>
                </Card>
                <Card withBorder p="md">
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Reach</Text>
                            <Text fw={700} size="xl">{formatNumber(adAccountData.aggregated_metrics.reach)}</Text>
                        </Box>
                        <ThemeIcon size="lg" variant="light" color="teal"><IconEye size={20} /></ThemeIcon>
                    </Group>
                </Card>
                <Card withBorder p="md">
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>CTR</Text>
                            <Text fw={700} size="xl">{adAccountData.aggregated_metrics.ctr.toFixed(2)}%</Text>
                        </Box>
                        <ThemeIcon size="lg" variant="light" color="orange"><IconClick size={20} /></ThemeIcon>
                    </Group>
                </Card>
            </SimpleGrid>

            <Group align="flex-start" gap="xl" mb="xl" wrap="nowrap">
                {/* Main content */}
                <Box style={{ flex: 3, minWidth: 0 }}>
                    {/* Trends Graph */}
                    <Paper withBorder p="md" mb="xl">
                        <Text fw={700} mb="sm">Monthly Trends</Text>
                        {chartData.length === 0 ? (
                            <Text c="dimmed" size="sm">No monthly data available.</Text>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={chartData}>
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="Spend" stroke="#228be6" />
                                    <Line type="monotone" dataKey="Leads" stroke="#40c057" />
                                    <Line type="monotone" dataKey="CTR" stroke="#faad14" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </Paper>

                    {/* Quick Insights */}
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mb="xl">
                        <Card withBorder p="md">
                            <Text size="xs" c="dimmed" mb={4}>Best Month (Leads)</Text>
                            <Text fw={700}>
                                {bestMonth
                                    ? `${bestMonth.date_start.slice(0, 7)}: ${bestMonth.actions?.lead ?? bestMonth.actions?.["onsite_conversion.lead_grouped"] ?? 0} leads`
                                    : 'N/A'}
                            </Text>
                        </Card>
                        <Card withBorder p="md">
                            <Text size="xs" c="dimmed" mb={4}>Highest CTR Month</Text>
                            <Text fw={700}>
                                {highestCTRMonth
                                    ? `${highestCTRMonth.date_start.slice(0, 7)}: ${((highestCTRMonth.clicks / (highestCTRMonth.impressions || 1)) * 100).toFixed(2)}%`
                                    : 'N/A'}
                            </Text>
                        </Card>
                        <Card withBorder p="md">
                            <Text size="xs" c="dimmed" mb={4}>Budget Utilization</Text>
                            <Progress value={budgetPercent} color={budgetPercent > 90 ? 'red' : 'blue'} size="lg" radius="xl" striped animated={true} />
                            <Text size="xs" mt={4}>{`$${budgetUsed.toFixed(2)} / $${budgetMax || 'N/A'}`}</Text>
                        </Card>
                    </SimpleGrid>

                    {/* Metric Comparison */}
                    <Paper withBorder p="md" mb="xl">
                        <Text fw={700} mb="sm">This Month vs Last Month</Text>
                        <SimpleGrid cols={3}>
                            <Box>
                                <Text size="sm" c="dimmed">Spend</Text>
                                <Text fw={700} c={compare('spend') >= 0 ? 'green' : 'red'}>
                                    {thisMonth && lastMonth
                                        ? `${compare('spend').toFixed(1)}%`
                                        : 'N/A'}
                                </Text>
                            </Box>
                            <Box>
                                <Text size="sm" c="dimmed">Leads</Text>
                                <Text fw={700} c={compare('leads') >= 0 ? 'green' : 'red'}>
                                    {thisMonth && lastMonth
                                        ? `${compare('leads').toFixed(1)}%`
                                        : 'N/A'}
                                </Text>
                            </Box>
                            <Box>
                                <Text size="sm" c="dimmed">CTR</Text>
                                <Text fw={700} c={compare('CTR') >= 0 ? 'green' : 'red'}>
                                    {thisMonth && lastMonth
                                        ? `${compare('CTR').toFixed(1)}%`
                                        : 'N/A'}
                                </Text>
                            </Box>
                        </SimpleGrid>
                    </Paper>

                    {/* Top Campaigns */}
                    <Paper withBorder p="md">
                        <Text fw={700} mb="sm">Top Campaigns</Text>
                        {topAdAccountCampaigns.length === 0 ? (
                            <Text c="dimmed" size="sm">No campaigns found.</Text>
                        ) : (
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Name</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Spend</Table.Th>
                                        <Table.Th>Leads</Table.Th>
                                        <Table.Th>Clicks</Table.Th>
                                        <Table.Th>Impressions</Table.Th>
                                        <Table.Th>CTR</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {topAdAccountCampaigns.map((c) => (
                                        <Table.Tr key={c.id}>
                                            <Table.Td>{c.name}</Table.Td>
                                            <Table.Td>
                                                <Badge color={c.status === 'ACTIVE' ? 'green' : 'gray'}>
                                                    {c.status}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>${c.spend.toFixed(2)}</Table.Td>
                                            <Table.Td>{c.leads}</Table.Td>
                                            <Table.Td>{c.clicks}</Table.Td>
                                            <Table.Td>{c.impressions}</Table.Td>
                                            <Table.Td>{c.ctr.toFixed(2)}%</Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Paper>
                </Box>

                {/* Sidebar: Notifications & Actions */}
                <Stack style={{ flex: 1, minWidth: 260 }}>
                    <Paper withBorder p="md" mb="md">
                        <Text fw={700} mb="sm">Quick Actions</Text>
                        <Stack>
                            {quickActions.map((action, idx) => (
                                <Button
                                    key={idx}
                                    leftSection={action.icon}
                                    variant="light"
                                    onClick={action.onClick}
                                    fullWidth
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </Stack>
                    </Paper>
                    {notifications.length > 0 && (
                        <Paper withBorder p="md">
                            <Text fw={700} mb="sm">Notifications</Text>
                            <Stack>
                                {notifications.map((n, i) => (
                                    <Alert key={i} icon={<IconAlertCircle size={16} />} color="yellow" mb="xs">
                                        {n.message}
                                    </Alert>
                                ))}
                            </Stack>
                        </Paper>
                    )}
                </Stack>
            </Group>
        </Container>
    );
}