'use client';

import React from 'react';

interface GraphMetricCardProps {
  title: string;
  value: string | number;
}

const GraphMetricCard = ({ title, value }: GraphMetricCardProps) => {
  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow flex flex-col items-center justify-center">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-300">{title}</h3>
      <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{value}</p>
    </div>
  );
};

export default GraphMetricCard;
