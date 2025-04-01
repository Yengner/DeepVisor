'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface LatestAdAccountResultProps {
    adAccountData: {
        ad_account_id: string;
        name: string;
        account_status: string;
        time_increment_metrics: {
            [key: string]: Array<{
                reach: number;
                spend: number;
                clicks: number;
                actions: {
                    [key: string]: number;
                };
                date_stop: string;
                date_start: string;
            }>;
        };
        platform: string;
    };
    isReportsSidebarOpen: boolean;
}

const AdAccountPerformanceMetrics: React.FC<LatestAdAccountResultProps> = ({ adAccountData, isReportsSidebarOpen }) => {
    const [selectedRange, setSelectedRange] = useState<'1' | '7' | '30'>('7');

    const timeIncrementMetrics = adAccountData.time_increment_metrics || {};
    const selectedData = timeIncrementMetrics[selectedRange] || [];
    const labels = selectedData.map((data) => data.date_start);
    const spendData = selectedData.map((data) => data.spend);
    const clicksData = selectedData.map((data) => data.clicks);
    const leadsData = selectedData.map((data) => data.actions?.['onsite_conversion.messaging_conversation_started_7d'] || 0);

    const series = [
        {
            name: 'Spend ($)',
            data: spendData,
        },
        {
            name: 'Clicks',
            data: clicksData,
        },
        {
            name: 'Leads',
            data: leadsData,
        },
    ];

    const chartOptions: ApexOptions = {
        chart: {
            type: 'line',
            toolbar: { show: false },
            zoom: { enabled: false },
        },
        stroke: {
            curve: 'smooth',
            width: 2,
        },
        xaxis: {
            categories: labels,
            title: {
                text: 'Date',
                style: { fontSize: '14px' },
            },
            labels: {
                rotate: -45,
            },
        },
        yaxis: {
            title: {
                text: 'Value',
                style: { fontSize: '14px' },
            },
        },
        colors: ['#4CAF50', '#2196F3', '#FF9800', '#E91E63'],
        legend: {
            position: 'top',
        },
        tooltip: {
            shared: true,
            intersect: false,
        },
        grid: {
            borderColor: '#e0e0e0',
            strokeDashArray: 4,
        },
    };

    return (
        <div className={`transition-all duration-300 bg-white shadow-lg p-6 pb-12 rounded-lg ${isReportsSidebarOpen ? 'w-[calc(100%-4rem)]' : 'w-[calc(100%-4rem)]'}`}>
            <div className="flex items-center justify-between -mb-8 z-20">
                <h2></h2>
                <select
                    value={selectedRange}
                    onChange={(e) => setSelectedRange(e.target.value as '1' | '7' | '30')}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
                >
                    <option value="1">1 Day</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                </select>
            </div>

            <div className="w-full h-64">
                <Chart options={chartOptions} series={series} type="line" height={300} width={isReportsSidebarOpen ? 990 : 1110} />
            </div>
        </div>
    );
};

export default AdAccountPerformanceMetrics;
