"use client";

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { useState } from 'react';
import {
    Container,
    Box,
    ActionIcon,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconCurrencyDollar, IconUser, IconEye, IconClick } from '@tabler/icons-react';
import ReportsSidebar from './layout/ReportsSidebar';
import ReportsHeader from './layout/ReportsHeader';
import KpiFrequencyChart from './cards/KpiFrequencyChart';
import PerformanceTable from './cards/PerformanceTable';
import LineChartSection from './cards/LineChartSection';

// Utility types for metrics
type MetricRow = {
    name: string;
    status: string;
    objective?: string;
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    reach?: number;
    link_clicks: number;
    messages: number;
    ad_format?: string;
    start_date?: string;
    end_date?: string;
};

type NumericCol = {
    key: string;
    label: string;
    light: [number, number, number];
    dark: [number, number, number];
    format: (v: number) => string | number;
};

type Column = {
    key: string;
    label: string;
};

export type KPI = {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
};

type ReportsClientProps = {
    data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    viewType: "adAccount" | "campaigns" | "adsets" | "ads";
};

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
};

export function ReportsClient({ data, viewType }: ReportsClientProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    /**
     * Header content based on view type
     */
    let headerContent: React.ReactNode = null;
    if (viewType === "adAccount") {
        headerContent = <ReportsHeader title={data.adAccountData.name} type="adAccount" />;
    } else if (viewType === "campaigns") {
        headerContent = <ReportsHeader title={data.campaignMetrics[0].name} type="campaigns" />;
    } else if (viewType === "adsets") {
        headerContent = <ReportsHeader title={data.adSetMetrics[0].name} type="adsets" />;
    } else if (viewType === "ads") {
        headerContent = <ReportsHeader title={data.adMetrics[0].name} type="ads" />;
    }

    /**
     * Sidebar content based on view type
     */
    let sidebarContent: React.ReactNode = null;
    if (viewType === "adAccount") sidebarContent = <ReportsSidebar items={data.campaignsMetrics} paramKey="campaign_id" />;
    else if (viewType === "campaigns") sidebarContent = <ReportsSidebar items={data.adSetsMetrics} paramKey="adset_id" />;
    else if (viewType === "adsets") sidebarContent = <ReportsSidebar items={data.adsMetrics} paramKey="ad_id" />;
    else if (viewType === "ads") sidebarContent = <ReportsSidebar items={data.adMetrics} paramKey="ad_id" />;

    let mainContent: React.ReactNode = null;

    /**
     * Main content based on view type
     */
    if (viewType === "adAccount") {
        const kpis: KPI[] = [
            { label: 'Spend', value: data.adAccountData.aggregated_metrics.spend, icon: <IconCurrencyDollar size={20} color="#22c55e" />, color: 'green' },
            { label: 'Leads', value: data.adAccountData.aggregated_metrics.leads.toLocaleString(), icon: <IconUser size={20} color="#2563eb" />, color: 'blue' },
            { label: 'Impressions', value: data.adAccountData.aggregated_metrics.impressions.toLocaleString(), icon: <IconEye size={20} color="#845ef7" />, color: 'violet' },
            { label: 'Link Clicks', value: data.adAccountData.aggregated_metrics.link_clicks.toLocaleString(), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'CTR (%)', value: data.adAccountData.aggregated_metrics.ctr.toFixed(2), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'Total Clicks', value: data.adAccountData.aggregated_metrics.clicks.toLocaleString(), icon: <IconClick size={20} color="#228be6" />, color: 'blue' },
            { label: 'CPM', value: data.adAccountData.aggregated_metrics.cpm.toFixed(2), icon: <IconCurrencyDollar size={20} color="#e8590c" />, color: 'orange' },
            { label: 'CPC', value: data.adAccountData.aggregated_metrics.cpc.toFixed(2), icon: <IconCurrencyDollar size={20} color="#fab005" />, color: 'yellow' },
        ];

        const tableRows: MetricRow[] = data.campaignsMetrics.map((campaign: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
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

        const columns: Column[] = [
            { key: "name", label: "Campaign name" },
            { key: "status", label: "Status" },
            { key: "objective", label: "Objective" },
        ];

        const numericCols: NumericCol[] = [
            { key: "spend", label: "Spend", light: [220, 220, 220], dark: [80, 80, 80], format: v => `$${v.toLocaleString()}` },
            { key: "impressions", label: "Impressions", light: [234, 246, 250], dark: [24, 111, 175], format: v => v.toLocaleString() },
            { key: "reach", label: "Reach", light: [230, 220, 250], dark: [120, 80, 180], format: v => v.toLocaleString() },
            { key: "clicks", label: "Clicks", light: [223, 245, 225], dark: [33, 197, 117], format: v => v.toLocaleString() },
            { key: "link_clicks", label: "Link clicks", light: [245, 250, 247], dark: [34, 197, 117], format: v => v.toLocaleString() },
            { key: "leads", label: "Leads", light: [248, 215, 218], dark: [215, 38, 61], format: v => v },
            { key: "messages", label: "Messages", light: [255, 253, 231], dark: [184, 107, 42], format: v => v },
        ];

        const impressionsCpmData = data.timeIncrementArray.map((row: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            date: row.date_stop,
            Impressions: row.impressions,
            CPM: row.impressions ? row.spend / (row.impressions / 1000) : 0,
        }));

        const clicksCpcData = data.timeIncrementArray.map((row: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            date: row.date_stop,
            Clicks: row.clicks,
            CPC: row.clicks ? row.spend / row.clicks : 0,
        }));

        const spendData = data.timeIncrementArray.map((row: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            date: row.date_stop,
            Spend: row.spend,
        }));

        mainContent = (
            <>
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
        const kpis: KPI[] = [
            { label: 'Spend', value: data.campaignMetrics[0].spend, icon: <IconCurrencyDollar size={20} color="#22c55e" />, color: 'green' },
            { label: 'Leads', value: data.campaignMetrics[0].leads.toLocaleString(), icon: <IconUser size={20} color="#2563eb" />, color: 'blue' },
            { label: 'Impressions', value: data.campaignMetrics[0].impressions.toLocaleString(), icon: <IconEye size={20} color="#845ef7" />, color: 'violet' },
            { label: 'Link Clicks', value: data.campaignMetrics[0].link_clicks.toLocaleString(), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'CTR (%)', value: Number(data.campaignMetrics[0].ctr).toFixed(2), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'Total Clicks', value: data.campaignMetrics[0].clicks.toLocaleString(), icon: <IconClick size={20} color="#228be6" />, color: 'blue' },
            { label: 'CPM', value: Number(data.campaignMetrics[0].cpm).toFixed(2), icon: <IconCurrencyDollar size={20} color="#e8590c" />, color: 'orange' },
            { label: 'CPC', value: Number(data.campaignMetrics[0].cpc).toFixed(2), icon: <IconCurrencyDollar size={20} color="#fab005" />, color: 'yellow' },
        ];

        const tableRows: MetricRow[] = data.adSetsMetrics.map((adset: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            name: adset.name,
            status: adset.status,
            start_date: formatDate(adset.start_date),
            end_date: formatDate(adset.end_date),
            spend: Number(adset.spend) || 0,
            impressions: Number(adset.impressions) || 0,
            clicks: Number(adset.clicks) || 0,
            leads: Number(adset.leads) || 0,
            link_clicks: Number(adset.link_clicks) || 0,
            messages: Number(adset.messages) || 0,
        }));

        const columns: Column[] = [
            { key: "name", label: "Ad Set name" },
            { key: "status", label: "Status" },
            { key: "start_date", label: "Start Date" },
            { key: "end_date", label: "End Date" },
        ];

        const numericCols: NumericCol[] = [
            { key: "spend", label: "Spend", light: [220, 220, 220], dark: [80, 80, 80], format: v => `$${v.toLocaleString()}` },
            { key: "impressions", label: "Impressions", light: [234, 246, 250], dark: [24, 111, 175], format: v => v.toLocaleString() },
            { key: "clicks", label: "Clicks", light: [223, 245, 225], dark: [33, 197, 117], format: v => v.toLocaleString() },
            { key: "link_clicks", label: "Link clicks", light: [245, 250, 247], dark: [34, 197, 117], format: v => v.toLocaleString() },
            { key: "leads", label: "Leads", light: [248, 215, 218], dark: [215, 38, 61], format: v => v },
            { key: "messages", label: "Messages", light: [255, 253, 231], dark: [184, 107, 42], format: v => v },
        ];

        mainContent = (
            <>
                <KpiFrequencyChart kpis={kpis} frequencyValue={2.04} frequencyMax={8} />
                <PerformanceTable
                    title="Ad set performance"
                    rows={tableRows}
                    columns={columns}
                    numericCols={numericCols}
                />
            </>
        );
    } else if (viewType === "adsets") {
        const kpis: KPI[] = [
            { label: 'Spend', value: (data.adSetMetrics[0]?.spend ?? 0), icon: <IconCurrencyDollar size={20} color="#22c55e" />, color: 'green' },
            { label: 'Leads', value: (data.adSetMetrics[0]?.leads ?? 0).toLocaleString(), icon: <IconUser size={20} color="#2563eb" />, color: 'blue' },
            { label: 'Impressions', value: (data.adSetMetrics[0]?.impressions ?? 0).toLocaleString(), icon: <IconEye size={20} color="#845ef7" />, color: 'violet' },
            { label: 'Link Clicks', value: (data.adSetMetrics[0]?.link_clicks ?? 0).toLocaleString(), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'CTR (%)', value: Number(data.adSetMetrics[0]?.ctr ?? 0).toFixed(2), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'Total Clicks', value: (data.adSetMetrics[0]?.clicks ?? 0).toLocaleString(), icon: <IconClick size={20} color="#228be6" />, color: 'blue' },
            { label: 'CPM', value: Number(data.adSetMetrics[0]?.cpm ?? 0).toFixed(2), icon: <IconCurrencyDollar size={20} color="#e8590c" />, color: 'orange' },
            { label: 'CPC', value: Number(data.adSetMetrics[0]?.cpc ?? 0).toFixed(2), icon: <IconCurrencyDollar size={20} color="#fab005" />, color: 'yellow' },
        ];

        const tableRows: MetricRow[] = data.adsMetrics.map((ad: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            name: ad.name,
            status: ad.status,
            ad_format: ad.ad_format,
            spend: Number(ad.spend) || 0,
            impressions: Number(ad.impressions) || 0,
            clicks: Number(ad.clicks) || 0,
            leads: Number(ad.leads) || 0,
            link_clicks: Number(ad.link_clicks) || 0,
            messages: Number(ad.messages) || 0,
            start_date: formatDate(ad.start_date),
            end_date: formatDate(ad.end_date),
        }));

        const columns: Column[] = [
            { key: "name", label: "Ad name" },
            { key: "status", label: "Status" },
            { key: "ad_format", label: "Ad Format" },
            { key: "start_date", label: "Start Date" },
            { key: "end_date", label: "End Date" },
        ];

        const numericCols: NumericCol[] = [
            { key: "spend", label: "Spend", light: [220, 220, 220], dark: [80, 80, 80], format: v => `$${v.toLocaleString()}` },
            { key: "impressions", label: "Impressions", light: [234, 246, 250], dark: [24, 111, 175], format: v => v.toLocaleString() },
            { key: "clicks", label: "Clicks", light: [223, 245, 225], dark: [33, 197, 117], format: v => v.toLocaleString() },
            { key: "link_clicks", label: "Link clicks", light: [245, 250, 247], dark: [34, 197, 117], format: v => v.toLocaleString() },
            { key: "leads", label: "Leads", light: [248, 215, 218], dark: [215, 38, 61], format: v => v },
            { key: "messages", label: "Messages", light: [255, 253, 231], dark: [184, 107, 42], format: v => v },
        ];

        mainContent = (
            <>
                <KpiFrequencyChart kpis={kpis} frequencyValue={2.04} frequencyMax={8} />
                <PerformanceTable
                    title="Ad performance"
                    rows={tableRows}
                    columns={columns}
                    numericCols={numericCols}
                />
            </>
        );
    } else if (viewType === "ads") {
        const kpis: KPI[] = [
            { label: 'Spend', value: (data.adMetrics[0]?.spend ?? 0), icon: <IconCurrencyDollar size={20} color="#22c55e" />, color: 'green' },
            { label: 'Leads', value: (data.adMetrics[0]?.leads ?? 0).toLocaleString(), icon: <IconUser size={20} color="#2563eb" />, color: 'blue' },
            { label: 'Impressions', value: (data.adMetrics[0]?.impressions ?? 0).toLocaleString(), icon: <IconEye size={20} color="#845ef7" />, color: 'violet' },
            { label: 'Link Clicks', value: (data.adMetrics[0]?.link_clicks ?? 0).toLocaleString(), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'CTR (%)', value: Number(data.adMetrics[0]?.ctr ?? 0).toFixed(2), icon: <IconClick size={20} color="#f59e42" />, color: 'orange' },
            { label: 'Total Clicks', value: (data.adMetrics[0]?.clicks ?? 0).toLocaleString(), icon: <IconClick size={20} color="#228be6" />, color: 'blue' },
            { label: 'CPM', value: Number(data.adMetrics[0]?.cpm ?? 0).toFixed(2), icon: <IconCurrencyDollar size={20} color="#e8590c" />, color: 'orange' },
            { label: 'CPC', value: Number(data.adMetrics[0]?.cpc ?? 0).toFixed(2), icon: <IconCurrencyDollar size={20} color="#fab005" />, color: 'yellow' },
        ];

        mainContent = (
            <>
                <KpiFrequencyChart kpis={kpis} frequencyValue={2.04} frequencyMax={8} />
            </>
        );
    }

    return (
        <Container size="xl" py="md" style={{ position: 'relative', minHeight: '100vh' }}>
            {headerContent}
            <Box style={{ display: 'flex', flexDirection: 'row', minHeight: 'calc(100vh - 60px)' }}>
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
                <Box style={{
                    flex: 1,
                    padding: '25px 0 0 25px',
                    minHeight: '100%',
                }}>
                    {mainContent}
                </Box>
            </Box>
        </Container>
    );
}