'use client';

import React, { useState } from 'react';

interface Metrics {
    cpc: number;
    cpm: number;
    ctr: number;
    leads: number;
    reach: number;
    spend: number;
    clicks: number;
    messages: string | number;
    impressions: number;
    link_clicks: string | number;
}

interface CampaignMetricsProps {
    campaignName: string;
    today_metrics: Metrics;
    yesterday_metrics: Metrics;
    last_7d_metrics: Metrics;
    last_30d_metrics: Metrics;
    this_month_metrics: Metrics;
    last_month_metrics: Metrics;
}

interface CampaignDataProp {
    campaignData: CampaignMetricsProps;
    isReportsSidebarOpen: boolean;
}

const LatestCampaignResults: React.FC<CampaignDataProp> = ({ campaignData, isReportsSidebarOpen }) => {
    const { campaignName, today_metrics, yesterday_metrics, last_7d_metrics, last_30d_metrics, this_month_metrics, last_month_metrics } = campaignData;

    const metricCategories = [
        { label: 'Today', value: 'today', data: today_metrics },
        { label: 'Yesterday', value: 'yesterday', data: yesterday_metrics },
        { label: 'Last 7 Days', value: 'last_7d', data: last_7d_metrics },
        { label: 'Last 30 Days', value: 'last_30d', data: last_30d_metrics },
        { label: 'This Month', value: 'this_month', data: this_month_metrics },
        { label: 'Last Month', value: 'last_month', data: last_month_metrics },
    ];

    const [selectedRange, setSelectedRange] = useState('today');
    const selectedMetrics = metricCategories.find((item) => item.value === selectedRange)?.data;

    return (
        <div className={`transition-all duration-300 bg-white shadow-lg p-6 rounded-lg ${isReportsSidebarOpen ? 'w-[calc(90%-4rem)]' : 'w-[calc(100%-4rem)]'}`}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-800">{campaignName} Metrics</h2>
                {/* Dropdown Selector */}
                <select
                    value={selectedRange}
                    onChange={(e) => setSelectedRange(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {metricCategories.map(({ label, value }) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Selected Metrics Display */}
            {selectedMetrics ? (
                <div className="p-4 bg-gray-100 rounded-lg shadow-sm">
                    <div className="space-y-1">
                        <p className="text-sm"><span className="font-medium">Spend:</span> ${selectedMetrics.spend.toFixed(2)}</p>
                        <p className="text-sm"><span className="font-medium">Leads:</span> {selectedMetrics.leads}</p>
                        <p className="text-sm"><span className="font-medium">Reach:</span> {selectedMetrics.reach.toLocaleString()}</p>
                        <p className="text-sm"><span className="font-medium">Impressions:</span> {selectedMetrics.impressions.toLocaleString()}</p>
                        <p className="text-sm"><span className="font-medium">CTR:</span> {selectedMetrics.ctr.toFixed(2)}%</p>
                        <p className="text-sm"><span className="font-medium">CPC:</span> ${selectedMetrics.cpc.toFixed(2)}</p>
                        <p className="text-sm"><span className="font-medium">CPM:</span> ${selectedMetrics.cpm.toFixed(2)}</p>
                        <p className="text-sm"><span className="font-medium">Clicks:</span> {selectedMetrics.clicks}</p>
                        <p className="text-sm"><span className="font-medium">Messages:</span> {selectedMetrics.messages}</p>
                        <p className="text-sm"><span className="font-medium">Link Clicks:</span> {selectedMetrics.link_clicks}</p>
                    </div>
                </div>
            ) : (
                <p className="text-gray-500 text-sm italic">No data available</p>
            )}
        </div>
    );
};

export default LatestCampaignResults;
