'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface GraphMetricCardProps {
  title: string;
  value: string | number;
  isSelected: boolean;
  onClick: () => void;
}

const GraphMetricCard = ({ title, value, isSelected, onClick }: GraphMetricCardProps) => (
  <button
    onClick={onClick}
    className={`p-4 border rounded-lg ${isSelected ? 'bg-[#b3be5ec5] dark:bg-blue-700' : 'bg-[#7e8649c5] dark:bg-gray-800'
      } shadow-sm text-left hover:bg-[#b3ba78c5] dark:hover:bg-gray-700 transition`}
  >
    <h3 className="text-sm font-medium text-[#fbfbe9]">{title}</h3>
    <p className="text-lg font-bold text-[#fbfbe9] mt-2">{value}</p>
  </button>
);

interface TrendDataPoint {
  date: string;
  cost: number;
  impressions: number;
  clicks: number;
  leads: number;
  messagingConversationsStarted: number;
  reach: number;
  ctr: number;
  cpc: number;
}

interface PerformanceMetricsGraphProps {
  graphInsights: {
    cost: number;
    impressions: number;
    clicks: number;
    leads: number;
    messagingConversationsStarted: number;
    reach: number;
    ctr: number;
    cpc: number;
    trendData: TrendDataPoint[];
  };
}

const PerformanceMetricsGraph = ({ graphInsights }: PerformanceMetricsGraphProps) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['cost', 'clicks']);

  const toggleMetric = (metric: string) => {
    if (selectedMetrics.includes(metric)) {
      return; // Prevent unselecting if only two metrics are selected
    }
    if (selectedMetrics.length === 2) {
      // Replace the first selected metric if two are already selected
      setSelectedMetrics((prev) => [prev[1], metric]);
    } else {
      // Add the new metric if less than two are selected
      setSelectedMetrics((prev) => [...prev, metric]);
    }
  };
  
  if (!graphInsights || !graphInsights.trendData) {
    return <p>No data available for the selected metrics.</p>;
  }

  const graphData = selectedMetrics.map((metric) => ({
    name: metric.charAt(0).toUpperCase() + metric.slice(1),
    data: graphInsights.trendData.map((point) =>
      Number(point[metric as keyof TrendDataPoint]) || 0
    ),
  }));

  const graphOptions: ApexOptions = {
    chart: {
      type: 'line',
      height: 350,
      toolbar: { show: false },
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    xaxis: {
      categories: graphInsights.trendData.map((point) => point.date),
      labels: {
        style: {
          fontSize: '12px',
          colors: ['#888'],
        },
      },
    },
    yaxis: [
      {
        title: {
          text: selectedMetrics[0].charAt(0).toUpperCase() + selectedMetrics[0].slice(1),
          style: {
            color: '#138749',
            fontSize: '14px',
            fontWeight: 'bold',
          },
        },
        labels: {
          style: {
            colors: ['#138749'],
            fontSize: '12px',
          },
        },
      },
      {
        opposite: true, // Align the second Y-axis on the right
        title: {
          text: selectedMetrics[1].charAt(0).toUpperCase() + selectedMetrics[1].slice(1),
          style: {
            color: '#c9a918',
            fontSize: '14px',
            fontWeight: 'bold',
          },
        },
        labels: {
          style: {
            colors: ['#c9a918'],
            fontSize: '12px',
          },
        },
      },
    ],
    tooltip: {
      theme: 'dark',
      x: { format: 'yyyy-MM-dd' },
      shared: true,
    },
    grid: {
      borderColor: '#f1f1f1',
    },
    colors: ['#138749', '#c9a918'],
    markers: {
      size: 4,
      colors: ['#fff'],
      strokeColors: ['#138749', '#c9a918'],
      strokeWidth: 2,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '14px',
      labels: {
        colors: ['#000000'],
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Metrics Selection */}
      <div className="grid grid-cols-8 gap-4">
        {[
          { key: 'cost', label: 'Cost', value: `$${graphInsights.cost.toFixed(2)}` },
          { key: 'impressions', label: 'Impressions', value: graphInsights.impressions },
          { key: 'clicks', label: 'Clicks', value: graphInsights.clicks },
          { key: 'leads', label: 'Leads', value: graphInsights.leads },
          { key: 'messagingConversationsStarted', label: 'Messages', value: graphInsights.messagingConversationsStarted },
          { key: 'reach', label: 'Reach', value: graphInsights.reach },
          { key: 'ctr', label: 'CTR', value: graphInsights.ctr.toFixed(2) + '%' },
          { key: 'cpc', label: 'CPC', value: graphInsights.cpc.toFixed(2) },
        ].map((metric) => (
          <GraphMetricCard
            key={metric.key}
            title={metric.label}
            value={metric.value}
            isSelected={selectedMetrics.includes(metric.key)}
            onClick={() => toggleMetric(metric.key)}
          />
        ))}
      </div>
  
      {/* Metrics Graph */}
      <div className="bg-[#fbfbd8] dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">
          Performance Over Time
        </h2>
        <Chart
          key={selectedMetrics.join('-')}
          options={graphOptions}
          series={graphData}
          type="line"
          height={250}
        />
      </div>
    </div>
  );
  
};

export default PerformanceMetricsGraph;