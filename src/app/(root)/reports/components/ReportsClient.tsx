"use client";

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { useState } from 'react';
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
import { IconArrowUp, IconArrowDown, IconCurrencyDollar, IconUser, IconEye, IconClick, IconChevronLeft, IconChevronRight, IconMenu2 } from '@tabler/icons-react'; // Tabler Icons :contentReference[oaicite:5]{index=5}
import ReportsSidebar from './layout/ReportsSidebar';
import ReportsHeader from './layout/ReportsHeader';
import KpiFrequencyChart from './cards/KpiFrequencyChart';
import PerformanceTable from './cards/PerformanceTable';
import LineChartSection from './cards/LineChartSection';


export function ReportsClient({ data, viewType }: any) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    let sidebarContent;
    if (viewType === "adAccount") sidebarContent = <ReportsSidebar items={data.campaignsMetrics} paramKey="campaign_id" />;
    else if (viewType === "campaigns") sidebarContent = <ReportsSidebar items={data.adSetsMetrics} paramKey="campaign_id" />;
    else if (viewType === "adsets") sidebarContent = <ReportsSidebar items={data.adsMetrics} paramKey="adset_id" />;
    else if (viewType === "ads") {
        sidebarContent = null;
        if (!sidebarCollapsed) setSidebarCollapsed(true);
    }

    let mainContent;
    if (viewType === "adAccount") {
        const kpis = [
            { label: 'Spend', value: (data.adAccountData.aggregated_metrics.spend), icon: <IconCurrencyDollar size={20} color="#22c55e" />, color: 'green' },
            { label: 'Leads', value: (data.adAccountData.aggregated_metrics.leads).toLocaleString(), icon: <IconUser size={20} color="#2563eb" />, color: 'blue' },
            { label: 'Impressions', value: (data.adAccountData.aggregated_metrics.impressions).toLocaleString(), icon: <IconEye size={20} color="#845ef7" />, color: 'violet' },
            { label: 'Link Clicks', value: (data.adAccountData.aggregated_metrics.link_clicks).toLocaleString(), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'CTR (%)', value: (data.adAccountData.aggregated_metrics.ctr).toFixed(2), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'Total Clicks', value: (data.adAccountData.aggregated_metrics.clicks).toLocaleString(), icon: <IconClick size={20} color="#228be6" />, color: 'blue' },
            { label: 'CPM', value: (data.adAccountData.aggregated_metrics.cpm).toFixed(2), icon: <IconCurrencyDollar size={20} color="#e8590c" />, color: 'orange' },
            { label: 'CPC', value: (data.adAccountData.aggregated_metrics.cpc).toFixed(2), icon: <IconCurrencyDollar size={20} color="#fab005" />, color: 'yellow' },
        ]

        const tableRows = data.campaignsMetrics.map((campaign: any) => ({
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            spend: Number(campaign.spend) || 0,
            impressions: Number(campaign.impressions) || 0,
            clicks: Number(campaign.clicks) || 0,
            leads: Number(campaign.leads) || 0,
            reach: Number(campaign.reach) || 0,
            link_clicks: Number(campaign.link_clicks) || 0,
            messages: Number(campaign.messages) || 0,
        }));

        const columns = [
            { key: "name", label: "Campaign name" },
            { key: "status", label: "Status" },
            { key: "objective", label: "Objective" },
        ];

        const numericCols = [
            { key: "spend", label: "Spend", light: [220, 220, 220], dark: [80, 80, 80], format: v => `$${v.toLocaleString()}` },
            { key: "impressions", label: "Impressions", light: [234, 246, 250], dark: [24, 111, 175], format: v => v.toLocaleString() },
            { key: "reach", label: "Reach", light: [230, 220, 250], dark: [120, 80, 180], format: v => v.toLocaleString() },
            { key: "clicks", label: "Clicks", light: [223, 245, 225], dark: [33, 197, 117], format: v => v.toLocaleString() },
            { key: "link_clicks", label: "Link clicks", light: [245, 250, 247], dark: [34, 197, 117], format: v => v.toLocaleString() },
            { key: "leads", label: "Leads", light: [248, 215, 218], dark: [215, 38, 61], format: v => v },
            { key: "messages", label: "Messages", light: [255, 253, 231], dark: [184, 107, 42], format: v => v },
        ];

        const impressionsCpmData = data.timeIncrementArray.map(row => ({
            date: row.date_stop,
            Impressions: row.impressions,
            CPM: row.impressions ? row.spend / (row.impressions / 1000) : 0,
        }));

        const clicksCpcData = data.timeIncrementArray.map(row => ({
            date: row.date_stop,
            Clicks: row.clicks,
            CPC: row.clicks ? row.spend / row.clicks : 0,
        }));

        const spendData = data.timeIncrementArray.map(row => ({
            date: row.date_stop,
            Spend: row.spend,
        }));

        mainContent = (
            <>
                {/* KPIs, charts, and campaign table */}
                <KpiFrequencyChart kpis={kpis} frequencyValue={2.04} frequencyMax={8} />
                <PerformanceTable
                    title="Campaign performance"
                    rows={tableRows}
                    columns={columns}
                    numericCols={numericCols}
                />
                <LineChartSection
                    impressionsCpmData={impressionsCpmData}
                    clicksCpcData={clicksCpcData}
                    spendData={spendData}
                />

            </>
        );
    } else if (viewType === "campaigns") {
        const kpis = [
            { label: 'Spend', value: (data.campaignMetrics[0].spend), icon: <IconCurrencyDollar size={20} color="#22c55e" />, color: 'green' },
            { label: 'Leads', value: (data.campaignMetrics[0].leads).toLocaleString(), icon: <IconUser size={20} color="#2563eb" />, color: 'blue' },
            { label: 'Impressions', value: (data.campaignMetrics[0].impressions).toLocaleString(), icon: <IconEye size={20} color="#845ef7" />, color: 'violet' },
            { label: 'Link Clicks', value: (data.campaignMetrics[0].link_clicks).toLocaleString(), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'CTR (%)', value: Number(data.campaignMetrics[0].ctr).toFixed(2), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'Total Clicks', value: (data.campaignMetrics[0].clicks).toLocaleString(), icon: <IconClick size={20} color="#228be6" />, color: 'blue' },
            { label: 'CPM', value: Number(data.campaignMetrics[0].cpm).toFixed(2), icon: <IconCurrencyDollar size={20} color="#e8590c" />, color: 'orange' },
            { label: 'CPC', value: Number(data.campaignMetrics[0].cpc).toFixed(2), icon: <IconCurrencyDollar size={20} color="#fab005" />, color: 'yellow' },
        ];

        const tableRows = data.adSetsMetrics.map((adset: any) => ({
            name: adset.name,
            status: adset.status,
            bid_strategy: adset.bid_strategy,
            spend: Number(adset.spend) || 0,
            impressions: Number(adset.impressions) || 0,
            clicks: Number(adset.clicks) || 0,
            leads: Number(adset.leads) || 0,
            reach: Number(adset.reach) || 0,
            link_clicks: Number(adset.link_clicks) || 0,
            messages: Number(adset.messages) || 0,
        }));

        const columns = [
            { key: "name", label: "Ad Set name" },
            { key: "status", label: "Status" },
            { key: "bid_strategy", label: "Bid strategy" },
        ];

        const numericCols = [
            { key: "spend", label: "Spend", light: [220, 220, 220], dark: [80, 80, 80], format: v => `$${v.toLocaleString()}` },
            { key: "impressions", label: "Impressions", light: [234, 246, 250], dark: [24, 111, 175], format: v => v.toLocaleString() },
            { key: "reach", label: "Reach", light: [230, 220, 250], dark: [120, 80, 180], format: v => v.toLocaleString() },
            { key: "clicks", label: "Clicks", light: [223, 245, 225], dark: [33, 197, 117], format: v => v.toLocaleString() },
            { key: "link_clicks", label: "Link clicks", light: [245, 250, 247], dark: [34, 197, 117], format: v => v.toLocaleString() },
            { key: "leads", label: "Leads", light: [248, 215, 218], dark: [215, 38, 61], format: v => v },
            { key: "messages", label: "Messages", light: [255, 253, 231], dark: [184, 107, 42], format: v => v },
        ];

        // const impressionsCpmData = data.timeIncrementArray.map(row => ({
        //     date: row.date_stop,
        //     Impressions: row.impressions,
        //     CPM: row.impressions ? row.spend / (row.impressions / 1000) : 0,
        // }));

        // const clicksCpcData = data.timeIncrementArray.map(row => ({
        //     date: row.date_stop,
        //     Clicks: row.clicks,
        //     CPC: row.clicks ? row.spend / row.clicks : 0,
        // }));

        // const spendData = data.timeIncrementArray.map(row => ({
        //     date: row.date_stop,
        //     Spend: row.spend,
        // }));

        mainContent = (
            <>
                <KpiFrequencyChart kpis={kpis} frequencyValue={2.04} frequencyMax={8} />
                {/* <PerformanceTable
                    title="Ad set performance"
                    rows={tableRows}
                    columns={columns}
                    numericCols={numericCols}
                />
                <LineChartSection
                    impressionsCpmData={impressionsCpmData}
                    clicksCpcData={clicksCpcData}
                    spendData={spendData}
                /> */}
            </>
        );
    } else if (viewType === "adsets") {
        mainContent = (
            <>
                {/* KPIs, charts, and ads table for these ad sets */}
            </>
        );
    }

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
                    {!sidebarCollapsed && sidebarContent}
                </Box>

                {/* Main Content */}
                <Box style={{
                    flex: 1,
                    padding: '25px 0 0 25px',
                    minHeight: '100%',

                }}>
                    {mainContent}

                    {/* KPI Cards & Frequency Chart */}
                    {/* <Group align="flex-start" mb="xl" style={{ width: '100%' }}>
                        <SimpleGrid
                            cols={5}
                            spacing="md"
                            style={{ flex: 1, width: '100%' }}
                        >
                            {kpis.slice(0, 4).map((kpi) => (
                                <Card withBorder p={10} key={kpi.label} style={{ borderRadius: 16 }}>
                                    <Box >
                                        <Text size="sm" c="dimmed" fw={600} mb={2} lh={1.2}>
                                            {kpi.label}
                                        </Text>
                                        <Group gap={6} align="center">
                                            <Text fw={800} size="xl" style={{ color: "#1a1a2e", letterSpacing: 0 }}>
                                                {kpi.value}
                                            </Text>
                                            <Paper radius="xl" p={2} bg={`${kpi.color}.0`}>
                                                {kpi.icon}
                                            </Paper>
                                        </Group>
                                        <Text size="xs" c="green" mt={4}>▲ 9.1%</Text>
                                    </Box>
                                </Card>
                            ))}
                            {kpis.slice(4, 8).map((kpi) => (
                                <Card withBorder p={10} key={kpi.label} style={{ borderRadius: 16 }}>
                                    <Box>
                                        <Text size="sm" c="dimmed" fw={600} mb={2} lh={1.2}>
                                            {kpi.label}
                                        </Text>
                                        <Group gap={6} align="center">
                                            <Text fw={800} size="xl" style={{ color: "#1a1a2e", letterSpacing: 0 }}>
                                                {kpi.value}
                                            </Text>
                                            <Paper radius="xl" p={2} bg={`${kpi.color}.0`}>
                                                {kpi.icon}
                                            </Paper>
                                        </Group>
                                        <Text size="xs" c="green" mt={4}>▲ 9.1%</Text>
                                    </Box>
                                </Card>
                            ))}
                            <Card
                                withBorder
                                p="sm"
                                aria-rowspan={2}
                                style={{
                                    gridRow: '1 / span 2',
                                    gridColumn: '5 / span 10',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    borderRadius: 16,
                                    minHeight: 220,
                                    minWidth: 200
                                }}
                            >
                                <Group justify="space-between" style={{ width: '100%' }}>
                                    <Text fw={700} size="lg" style={{ color: "#22223b", marginBottom: 0 }}>
                                        Frequency
                                    </Text>
                                </Group>
                                <Box style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    marginTop: 'auto',
                                }}>
                                    <Box style={{ width: 300, height: 150, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                                        <DonutChart
                                            h={200}
                                            mt={50}
                                            withTooltip={false}
                                            data={[
                                                { name: 'Filled', value: 4.04, color: 'blue' },
                                                { name: 'Empty', value: 8 - 2.04, color: 'gray.1' },
                                            ]}
                                            startAngle={180}
                                            endAngle={0}
                                            thickness={28}
                                            size={150}
                                            withLabels={true}
                                            style={{ width: '100%', height: '100%' }}

                                        />
                                        <Text fw={700} size="xl" style={{ position: 'absolute', top: '50%', left: 0, width: '100%', textAlign: 'center', transform: 'translateY(-50%)', color: "#22223b" }}>
                                            2.04
                                        </Text>
                                        <Box
                                            style={{
                                                position: 'absolute',
                                                left: '50%',
                                                top: 25,
                                                width: 4,
                                                height: 28,
                                                background: '#e9b949',
                                                transform: 'translateX(-50%)',
                                                borderRadius: 2,
                                            }}
                                        />
                                    </Box>
                                </Box>
                            </Card>
                        </SimpleGrid>
                    </Group> */}

                    {/* Line Charts Section */}
                    {/* <Grid gutter="md" mb="xl">
                        <Grid.Col span={6}>
                            <Card withBorder p={12} style={{
                                borderRadius: 14,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: 0,
                                height: 260,
                            }}>
                                <Group justify="space-between" style={{ width: '100%' }}>
                                    <Text fw={700} size="md" style={{ color: "#22223b" }}>
                                        Impressions & CPM
                                    </Text>
                                    <ActionIcon variant="subtle" color="gray" size="md">
                                        <IconMenu2 size={20} />
                                    </ActionIcon>
                                </Group>
                                <Box style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    marginTop: 8,
                                }}>
                                    <LineChart width={510} height={210} data={[
                                        { date: '30 Jun', Impressions: 120000, CPM: 4.5 },
                                        { date: '7 Jul', Impressions: 135000, CPM: 4.0 },
                                        { date: '14 Jul', Impressions: 140000, CPM: 3.8 },
                                        { date: '21 Jul', Impressions: 125000, CPM: 4.2 },
                                    ]}>
                                        <XAxis dataKey="date" />
                                        <YAxis yAxisId="left" />
                                        <YAxis yAxisId="right" orientation="right" />
                                        <Tooltip />
                                        <Legend />
                                        <Line yAxisId="left" type="monotone" dataKey="Impressions" stroke="#228be6" />
                                        <Line yAxisId="right" type="monotone" dataKey="CPM" stroke="#d7263d" />
                                    </LineChart>
                                </Box>
                            </Card>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Card withBorder p={12} style={{
                                borderRadius: 14,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: 0,
                                height: 260,
                            }}>
                                <Group justify="space-between" style={{ width: '100%' }}>
                                    <Text fw={700} size="md" style={{ color: "#22223b" }}>
                                        Clicks & CPC
                                    </Text>
                                    <ActionIcon variant="subtle" color="gray" size="md">
                                        <IconMenu2 size={20} />
                                    </ActionIcon>
                                </Group>
                                <Box style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    marginTop: 8,
                                }}>
                                    <LineChart width={510} height={210} data={[
                                        { date: '30 Jun', Clicks: 400, CPC: 1.2 },
                                        { date: '7 Jul', Clicks: 600, CPC: 1.0 },
                                        { date: '14 Jul', Clicks: 700, CPC: 0.9 },
                                        { date: '21 Jul', Clicks: 800, CPC: 1.1 },
                                    ]}>
                                        <XAxis dataKey="date" />
                                        <YAxis yAxisId="left" />
                                        <YAxis yAxisId="right" orientation="right" />
                                        <Tooltip />
                                        <Legend />
                                        <Line yAxisId="left" type="monotone" dataKey="Clicks" stroke="#fab005" />
                                        <Line yAxisId="right" type="monotone" dataKey="CPC" stroke="#7950f2" />
                                    </LineChart>
                                </Box>
                            </Card>
                        </Grid.Col>
                        <Grid.Col span={12}>
                            <Card withBorder p={12} style={{
                                borderRadius: 14,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: 0,
                                height: 280,
                            }}>
                                <Group justify="space-between" style={{ width: '100%' }}>
                                    <Text fw={700} size="md" style={{ color: "#22223b" }}>
                                        Spend dynamics
                                    </Text>
                                    <ActionIcon variant="subtle" color="gray" size="md">
                                        <IconMenu2 size={20} />
                                    </ActionIcon>
                                </Group>
                                <Box style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    marginTop: 8,

                                }}>
                                    <LineChart width={1000} height={230} data={[
                                        { date: '26 Jun', Spend: 600 },
                                        { date: '28 Jun', Spend: 1350 },
                                        { date: '30 Jun', Spend: 400 },
                                        { date: '2 Jul', Spend: 520 },
                                        { date: '4 Jul', Spend: 410 },
                                        { date: '6 Jul', Spend: 430 },
                                        { date: '8 Jul', Spend: 600 },
                                        { date: '10 Jul', Spend: 520 },
                                        { date: '12 Jul', Spend: 410 },
                                        { date: '14 Jul', Spend: 430 },
                                        { date: '16 Jul', Spend: 600 },
                                        { date: '18 Jul', Spend: 520 },
                                        { date: '20 Jul', Spend: 410 },
                                        { date: '22 Jul', Spend: 430 },
                                        { date: '24 Jul', Spend: 350 },
                                    ]}>
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="Spend" stroke="#40c057" />
                                    </LineChart>
                                </Box>
                            </Card>
                        </Grid.Col>
                    </Grid> */}

                    {/* Top Campaigns Table */}
                    {/* <Card withBorder p={16} style={{
                        borderRadius: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        alignItems: 'flex-start',
                        marginBottom: 32,
                    }}>
                        <Text fw={700} size="xl" style={{ color: "#22223b", marginBottom: 12 }}>
                            Campaign performance
                        </Text>
                        <Table.ScrollContainer minWidth={400} maxHeight={300} type="native" style={{ width: '100%' }}>
                            <Table striped highlightOnHover withColumnBorders>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th style={{ fontWeight: 700 }}>Campaign name</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Status</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Objective</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Spend</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Impressions</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Clicks</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Leads</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>CPM</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Link clicks</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Messages</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>Start date</Table.Th>
                                        <Table.Th style={{ fontWeight: 700 }}>End date</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {tableRows.map((row, idx) => (
                                        <Table.Tr key={row.name}>
                                            <Table.Td style={{
                                                fontWeight: 500,
                                                maxWidth: 130,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>{row.name}</Table.Td>
                                            <Table.Td>{row.status}</Table.Td>
                                            <Table.Td>{row.objective}</Table.Td>
                                            {numericCols.map(col => {
                                                const { min, max } = minMax[col.key];
                                                const factor = min === max ? 0 : (row[col.key] - min) / (max - min);
                                                return (
                                                    <Table.Td
                                                        key={col.key}
                                                        style={{
                                                            background: interpolateColor(col.light, col.dark, factor),
                                                            color: factor > 0.6 ? "#fff" : "#22223b",
                                                            fontWeight: col.key === "spend" || col.key === "cpm" ? 600 : 500,
                                                        }}
                                                    >
                                                        {col.format(row[col.key])}
                                                    </Table.Td>
                                                );
                                            })}
                                            <Table.Td style={{ background: "#f3f3f3" }}>{row.start_date}</Table.Td>
                                            <Table.Td style={{ background: "#f3f3f3" }}>{row.end_date}</Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    </Card> */}

                </Box>
            </Box>
        </Container>
    );
}