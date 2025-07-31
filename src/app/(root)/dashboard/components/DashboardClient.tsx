'use client';

import { useState } from 'react';
import {
    Container, SimpleGrid, Card, Group, Box, Text, Button, Paper, Stack, Progress, Alert
} from '@mantine/core';
import { IconAlertCircle, IconFileExport, IconList } from '@tabler/icons-react';
import DashboardHeader from './DashboardHeader';


export type DashboardClientProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userData: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    platform: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adAccountData: any;
}

export default function DashboardClient({
    userData,
    platform,
    adAccountData,
}: DashboardClientProps) {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        // Simulate refresh logic
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
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
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Future Action</Text>
                            <Text fw={700} size="xl">Placeholder</Text>
                        </Box>
                    </Group>
                </Card>
                <Card withBorder p="md">
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Progress</Text>
                            <Progress value={50} color="blue" size="lg" radius="xl" striped animated={true} />
                            <Text size="xs" mt={4}>50% Complete</Text>
                        </Box>
                    </Group>
                </Card>
                <Card withBorder p="md">
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Status</Text>
                            <Text fw={700} size="xl">Active</Text>
                        </Box>
                    </Group>
                </Card>
                <Card withBorder p="md">
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Updates</Text>
                            <Text fw={700} size="xl">No updates yet</Text>
                        </Box>
                    </Group>
                </Card>
            </SimpleGrid>

            <Group align="flex-start" gap="xl" mb="xl" wrap="nowrap">
                {/* Main content */}
                <Box style={{ flex: 3, minWidth: 0 }}>
                    <Paper withBorder p="md" mb="xl">
                        <Text fw={700} mb="sm">Trends & Analytics</Text>
                        <Box h={200} bg="#f8f9fa" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Text c="dimmed">[Trends Chart Placeholder]</Text>
                        </Box>
                    </Paper>

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mb="xl">
                        <Card withBorder p="md">
                            <Text size="xs" c="dimmed" mb={4}>Insight 1</Text>
                            <Text fw={700}>Placeholder</Text>
                        </Card>
                        <Card withBorder p="md">
                            <Text size="xs" c="dimmed" mb={4}>Insight 2</Text>
                            <Text fw={700}>Placeholder</Text>
                        </Card>
                        <Card withBorder p="md">
                            <Text size="xs" c="dimmed" mb={4}>Insight 3</Text>
                            <Text fw={700}>Placeholder</Text>
                        </Card>
                    </SimpleGrid>

                    <Paper withBorder p="md" mb="xl">
                        <Text fw={700} mb="sm">Metric Comparison</Text>
                        <SimpleGrid cols={3}>
                            <Box>
                                <Text size="sm" c="dimmed">Metric 1</Text>
                                <Text fw={700}>Placeholder</Text>
                            </Box>
                            <Box>
                                <Text size="sm" c="dimmed">Metric 2</Text>
                                <Text fw={700}>Placeholder</Text>
                            </Box>
                            <Box>
                                <Text size="sm" c="dimmed">Metric 3</Text>
                                <Text fw={700}>Placeholder</Text>
                            </Box>
                        </SimpleGrid>
                    </Paper>

                    <Paper withBorder p="md">
                        <Text fw={700} mb="sm">Top Campaigns</Text>
                        <Box h={120} bg="#f8f9fa" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Text c="dimmed">[Top Campaigns Table Placeholder]</Text>
                        </Box>
                    </Paper>
                </Box>

                {/* Sidebar: Notifications & Actions */}
                <Stack style={{ flex: 1, minWidth: 260 }}>
                    <Paper withBorder p="md" mb="md">
                        <Text fw={700} mb="sm">Quick Actions</Text>
                        <Stack>
                            <Button
                                leftSection={<IconList size={16} />}
                                variant="light"
                                fullWidth
                            >
                                View All Campaigns
                            </Button>
                            <Button
                                leftSection={<IconFileExport size={16} />}
                                variant="light"
                                fullWidth
                            >
                                Export Report
                            </Button>
                            <Button
                                variant="light"
                                color="blue"
                                fullWidth
                                onClick={handleRefresh}
                                loading={refreshing}
                            >
                                Refresh Data
                            </Button>
                        </Stack>
                    </Paper>
                    <Paper withBorder p="md">
                        <Text fw={700} mb="sm">Notifications</Text>
                        <Stack>
                            <Alert icon={<IconAlertCircle size={16} />} color="yellow" mb="xs">
                                No notifications yet.
                            </Alert>
                        </Stack>
                    </Paper>
                </Stack>
            </Group>
        </Container>
    );
}