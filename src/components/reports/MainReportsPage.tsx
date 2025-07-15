"use client";

import { useState } from "react";
import {
  Container, Card, Group, Title, Text, Select, Paper, Stack, Divider, SegmentedControl, Tabs, Grid, ThemeIcon, Badge
} from "@mantine/core";
import { DatePickerInput } from '@mantine/dates';
import {
  IconTable, IconChartLine, IconCalendar, IconChartBar, IconTrendingUp, IconTrendingDown
} from "@tabler/icons-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

// --- Mock Data ---
const summaryStats = [
  { title: "Total Spend", value: "$12,450", diff: 8, icon: "up" },
  { title: "Impressions", value: "1,245,000", diff: 5, icon: "up" },
  { title: "Clicks", value: "45,200", diff: 2, icon: "up" },
  { title: "Avg CTR", value: "3.63%", diff: -1, icon: "down" }
];

const mockTrends = [
  { date: "2024-07-01", spend: 120, clicks: 400, impressions: 10000, ctr: 4.0 },
  { date: "2024-07-02", spend: 150, clicks: 420, impressions: 11000, ctr: 3.8 },
  { date: "2024-07-03", spend: 180, clicks: 500, impressions: 12000, ctr: 4.2 },
  { date: "2024-07-04", spend: 90, clicks: 300, impressions: 9000, ctr: 3.3 },
  { date: "2024-07-05", spend: 200, clicks: 600, impressions: 13000, ctr: 4.6 },
];

const mockBar = [
  { name: "Campaign A", spend: 500, clicks: 2000, impressions: 50000, ctr: 4.0 },
  { name: "Campaign B", spend: 300, clicks: 1200, impressions: 30000, ctr: 4.0 },
  { name: "Campaign C", spend: 200, clicks: 800, impressions: 20000, ctr: 4.0 },
];

const mockPivot = [
  { group: "2024-07-01", spend: 120, clicks: 400, impressions: 10000, ctr: 4.0 },
  { group: "2024-07-02", spend: 150, clicks: 420, impressions: 11000, ctr: 3.8 },
  { group: "2024-07-03", spend: 180, clicks: 500, impressions: 12000, ctr: 4.2 },
  { group: "2024-07-04", spend: 90, clicks: 300, impressions: 9000, ctr: 3.3 },
  { group: "2024-07-05", spend: 200, clicks: 600, impressions: 13000, ctr: 4.6 },
];

export default function ReportsClient() {
  // State
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date()
  ]);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [vizType, setVizType] = useState<"pivot" | "bar" | "trend">("trend");
  const [metric, setMetric] = useState("spend");
  const [groupBy, setGroupBy] = useState("day");

  // Visualization data selection
  let vizData = [];
  if (vizType === "trend") vizData = mockTrends;
  else if (vizType === "bar") vizData = mockBar;
  else vizData = mockPivot;

  // Metric label
  const metricLabel = {
    spend: "Spend ($)",
    clicks: "Clicks",
    impressions: "Impressions",
    ctr: "CTR (%)"
  }[metric];

  // Group by options
  const groupByOptions = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "campaign", label: "Campaign" },
    { value: "adset", label: "Ad Set" },
    { value: "ad", label: "Ad" },
  ];

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Card withBorder p="lg" radius="md" mb="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={2} mb="xs">Analytics & Reports</Title>
            <Text size="sm" c="dimmed">
              Platform: <b>Meta</b> &nbsp;|&nbsp; Ad Account: <b>Ada's Secrets Salon Ad account</b>
            </Text>
          </div>
          <Group>
            <DatePickerInput
              type="range"
              label="Date Range"
              placeholder="Select date range"
              value={dateRange}
              onChange={setDateRange}
              clearable={false}
              maw={400}
              leftSection={<IconCalendar size="1.1rem" stroke={1.5} />}
              size="md"
            />
          </Group>
        </Group>
      </Card>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartLine size={16} />}>Analytics</Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <Grid gutter="md">
            {summaryStats.map((stat, i) => (
              <Grid.Col span={{ base: 12, xs: 6, md: 3 }} key={stat.title}>
                <Card p="md" radius="md" withBorder>
                  <Group justify="apart">
                    <div>
                      <Text c="dimmed" size="xs" fw={500} tt="uppercase">{stat.title}</Text>
                      <Text size="xl" fw={700}>{stat.value}</Text>
                    </div>
                    <ThemeIcon color={stat.icon === "up" ? "teal" : "red"} variant="light" size="xl" radius="xl">
                      {stat.icon === "up" ? <IconTrendingUp size="1.4rem" stroke={1.5} /> : <IconTrendingDown size="1.4rem" stroke={1.5} />}
                    </ThemeIcon>
                  </Group>
                  <Group gap={5} mt="md">
                    <Text c={stat.icon === "up" ? "teal" : "red"} size="sm" fw={500}>
                      {stat.icon === "up" ? "+" : ""}{stat.diff}%
                    </Text>
                    <Text size="xs" c="dimmed">vs. previous period</Text>
                  </Group>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
          <Paper withBorder p="md" mt="md">
            <Text fw={700} mb="sm">Trends</Text>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={mockTrends}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="spend" name="Spend ($)" stroke="#228be6" strokeWidth={2} />
                <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#40c057" strokeWidth={2} />
                <Line type="monotone" dataKey="ctr" name="CTR (%)" stroke="#faad14" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Tabs.Panel>

        {/* Analytics Tab */}
        <Tabs.Panel value="analytics" pt="md">
          <Paper withBorder p="md" mb="md" radius="md">
            <Group gap="md" wrap="wrap">
              <SegmentedControl
                value={vizType}
                onChange={v => setVizType(v as any)}
                data={[
                  { label: <><IconTable size={16} /> Pivot Table</>, value: "pivot" },
                  { label: <><IconChartBar size={16} /> Bar</>, value: "bar" },
                  { label: <><IconChartLine size={16} /> Trend</>, value: "trend" },
                ]}
              />
              <Select
                label="Metric"
                value={metric}
                onChange={v => setMetric(v!)}
                data={[
                  { value: "spend", label: "Spend" },
                  { value: "clicks", label: "Clicks" },
                  { value: "impressions", label: "Impressions" },
                  { value: "ctr", label: "CTR" },
                ]}
                maw={160}
              />
              <Select
                label="Group By"
                value={groupBy}
                onChange={v => setGroupBy(v!)}
                data={groupByOptions}
                maw={160}
              />
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            {vizType === "trend" && (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={vizData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={metric} name={metricLabel} stroke="#228be6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {vizType === "bar" && (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={vizData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={metric} name={metricLabel} fill="#228be6" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {vizType === "pivot" && (
              <Stack>
                <Group>
                  <Text fw={700}>Pivot Table</Text>
                  <Text size="sm" c="dimmed">{metricLabel} by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</Text>
                </Group>
                <Divider />
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8 }}>{groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</th>
                      <th style={{ textAlign: "left", padding: 8 }}>{metricLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vizData.map((row: any, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: 8 }}>{row.group || row.date || row.name}</td>
                        <td style={{ padding: 8 }}>{row[metric]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
