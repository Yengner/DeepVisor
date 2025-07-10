import { useMemo } from 'react';
import { useElementSize } from '@mantine/hooks';
import {
    ResponsiveContainer,
    ComposedChart,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
    Bar,
    Line,
} from 'recharts';

interface CampaignPerformanceChartProps {
    data?: never[]; // you can pass real data here
    height?: number;
}

export function CampaignPerformanceChart({ height = 300 }: CampaignPerformanceChartProps) {
    const { ref, width } = useElementSize();

    // Generate sample time-series data (replace with real props.data)
    const chartData = useMemo(() => {
        return Array.from({ length: 14 }).map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (13 - i));
            return {
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                spend: Math.floor(Math.random() * 500) + 100,
                impressions: Math.floor(Math.random() * 10000) + 1000,
            };
        });
    }, []);

    return (
        <div ref={ref} style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} />

                    {/* Bar series on left axis */}
                    <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#8884d8" />

                    {/* Line series on right axis */}
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="impressions"
                        name="Impressions"
                        stroke="#82ca9d"
                        strokeWidth={2}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
