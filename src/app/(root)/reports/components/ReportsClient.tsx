"use client";

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import React, { useState } from 'react';
import {
    Container,
    Group,
    Select,
    Card,
    Text,
    Title,
    Grid,
    Divider,
    Table,
    ScrollArea,
    Button,
    Box,
    SimpleGrid,
    Progress,
    Badge,
    Paper,
    ActionIcon,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { IconArrowUp, IconArrowDown, IconCurrencyDollar, IconUser, IconEye, IconClick, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'; // Tabler Icons :contentReference[oaicite:5]{index=5}
import ReportsSidebar from './layout/ReportsSidebar';
import ReportsHeader from './layout/ReportsHeader';


export function ReportsClient() {
    const [campaign, setCampaign] = useState('all');
    const [dateRange, setDateRange] = useState<[Date, Date]>([
        new Date(new Date().setDate(new Date().getDate() - 30)),
        new Date(),
    ]);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Mock data for KPIs, chart, and campaigns
    const kpis = [
        { label: 'Spend', value: '$13,690', icon: <IconCurrencyDollar size={20} color="#22c55e" />, color: 'green' },
        { label: 'Leads', value: '1,420', icon: <IconUser size={20} color="#2563eb" />, color: 'blue' },
        { label: 'Reach', value: '1.2M', icon: <IconEye size={20} color="#14b8a6" />, color: 'teal' },
        { label: 'CTR', value: '2.34%', icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
    ];

    const chartData = [
        { name: 'Jan', Spend: 2000, Leads: 120, CTR: 1.2 },
        { name: 'Feb', Spend: 3000, Leads: 180, CTR: 1.5 },
        { name: 'Mar', Spend: 4000, Leads: 220, CTR: 1.8 },
        { name: 'Apr', Spend: 3500, Leads: 200, CTR: 2.0 },
        { name: 'May', Spend: 5000, Leads: 300, CTR: 2.2 },
        { name: 'Jun', Spend: 6000, Leads: 350, CTR: 2.5 },
    ];

    const campaigns = [
        { id: 1, name: 'Spring Sale', status: 'ACTIVE', spend: 1200, leads: 120, clicks: 300, impressions: 10000, ctr: 2.1 },
        { id: 2, name: 'Brand Awareness', status: 'PAUSED', spend: 800, leads: 80, clicks: 200, impressions: 8000, ctr: 1.5 },
        { id: 3, name: 'Holiday Promo', status: 'ACTIVE', spend: 1500, leads: 150, clicks: 350, impressions: 12000, ctr: 2.9 },
    ];

    return (
        <Container size="xl" py="md" style={{ position: 'relative', minHeight: '100vh' }}>
            {/* Top Bar */}
            <ReportsHeader />

            <Box style={{ display: 'flex', flexDirection: 'row', minHeight: 'calc(100vh - 60px)' }}>
                {/* Sidebar */}
                <Box style={{
                    transition: 'width 0.3s',
                    width: sidebarCollapsed ? 56 : 180,
                    minWidth: sidebarCollapsed ? 56 : 90,
                    maxWidth: sidebarCollapsed ? 56 : 260,
                    borderRight: '1px solid #e9ecef',

                    position: 'relative',
                    height: 'calc(100vh - 80px)',
                }}>
                    <Box
                        style={{
                            position: 'absolute',
                            top: 24,
                            right: -23,
                            zIndex: 10,
                        }}
                    >
                        <ActionIcon
                            variant="light"
                            size={36}
                            radius="xl"
                            style={{
                                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                                border: '1px solid #e9ecef',
                                background: '#f8f9fa',
                            }}
                            onClick={() => setSidebarCollapsed((c) => !c)}
                            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {sidebarCollapsed ? <IconChevronRight size={22} /> : <IconChevronLeft size={22} />}
                        </ActionIcon>
                    </Box>
                    {!sidebarCollapsed && <ReportsSidebar />}
                </Box>
                
                {/* Main Content */}
                <Box style={{
                    flex: 1,
                    padding: '25px 0 0 25px',
                    minHeight: '100%',
                }}>


                    {/* KPI Cards */}
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mb="xl">
                        {kpis.map((kpi) => (
                            <Card withBorder p="md" key={kpi.label}>
                                <Group justify="space-between">
                                    <Box>
                                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{kpi.label}</Text>
                                        <Text fw={700} size="xl">{kpi.value}</Text>
                                    </Box>
                                    <Paper radius="xl" p={6} bg={`${kpi.color}.0`}>{kpi.icon}</Paper>
                                </Group>
                            </Card>
                        ))}
                    </SimpleGrid>

                    {/* Trends Graph */}
                    <Paper withBorder p="md" mb="xl">
                        <Text fw={700} mb="sm">Monthly Trends</Text>
                        <Box style={{ width: '100%', minHeight: 260 }}>
                            <LineChart width={700} height={260} data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="Spend" stroke="#228be6" />
                                <Line type="monotone" dataKey="Leads" stroke="#40c057" />
                                <Line type="monotone" dataKey="CTR" stroke="#faad14" dot={false} />
                            </LineChart>
                        </Box>
                    </Paper>

                    {/* Top Campaigns Table */}
                    <Paper withBorder p="md">
                        <Text fw={700} mb="sm">Top Campaigns</Text>
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
                                {campaigns.map((c) => (
                                    <Table.Tr key={c.id}>
                                        <Table.Td>{c.name}</Table.Td>
                                        <Table.Td>
                                            <Badge color={c.status === 'ACTIVE' ? 'green' : 'gray'}>{c.status}</Badge>
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
                    </Paper>
                </Box>
            </Box>
        </Container>
    );
}