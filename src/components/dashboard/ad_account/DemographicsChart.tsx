'use client';

import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DemographicsBarChartProps {
  data: { age: string; gender: string; impressions: string };
}

const DemographicsBarChart = ({ data }: DemographicsBarChartProps) => {

  if (!Array.isArray(data) || data.length === 0) {
    return <div>No data available to display.</div>;
  }

  const uniqueAges = [...new Set(data.map((item) => item.age))];
  const genders = ['male', 'female', 'unknown'];

  const series = genders.map((gender) => ({
    name: gender.charAt(0).toUpperCase() + gender.slice(1),
    data: uniqueAges.map(
      (age) =>
        parseInt(data.find((item) => item.age === age && item.gender === gender)?.impressions) || 0
    ),
  }));

  const chartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      stacked: true,
      toolbar: { show: false },
      fontFamily: 'Satoshi, sans-serif',
    },
    xaxis: {
      categories: uniqueAges,
      title: { text: 'Age Groups', style: { fontSize: '14px', fontWeight: 'bold' } },
    },
    yaxis: {
      title: { text: 'Impressions', style: { fontSize: '14px', fontWeight: 'bold' } },
      labels: { formatter: (value) => `${value.toLocaleString()}` },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        dataLabels: { position: 'top' },
        barHeight: '70%',
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'center',
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value.toLocaleString()} impressions`,
      },
    },
    colors: ['#5a93a8', '#eb7a81', '#6f79a3'], // Male: Blue, Female: Red, Unknown: Purple
  };

  return (
    <div className="bg-[#fbfbd8] dark:bg-gray-800 shadow rounded-lg p-6">
      <Chart options={chartOptions} series={series} type="bar" height={250} />
    </div>
  );
};

export default DemographicsBarChart;
