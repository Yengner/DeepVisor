"use client";

import '@mantine/charts/styles.css';
import { Grid, Card, Group, Text, ActionIcon, Box } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { IconMenu2 } from "@tabler/icons-react";

interface ChartData {
    date: string;
    [key: string]: number | string;
}

interface LineChartSectionProps {
    impressionsCpmData: ChartData[];
    clicksCpcData: ChartData[];
    spendData: ChartData[];
}

export default function LineChartSection({
    impressionsCpmData,
    clicksCpcData,
    spendData,
}: LineChartSectionProps) {
    return (
        <Grid gutter="md" mb="xl">
            <Grid.Col span={6}>
                <Card withBorder p={12} style={{ borderRadius: 14, height: 300 }}>
                    <Group justify="space-between" style={{ width: "100%" }}>
                        <Text fw={700} size="md" style={{ color: "#22223b" }}>
                            Impressions & CPM
                        </Text>
                        <ActionIcon variant="subtle" color="gray" size="md">
                            <IconMenu2 size={20} />
                        </ActionIcon>
                    </Group>
                    <Box mt={8}>
                        <LineChart
                            h={230}
                            data={impressionsCpmData}
                            dataKey="date"
                            withLegend
                            legendProps={{ verticalAlign: 'top', height: 30 }}
                            curveType="linear"
                            tooltipAnimationDuration={200}
                            gridAxis="xy"
                            series={[
                                { name: "Impressions", color: "blue.6" },
                                { name: "CPM", color: "grape.6", yAxisId: "right" },
                            ]}
                            withRightYAxis
                            valueFormatter={(value) => value.toLocaleString()}
                        />
                    </Box>
                </Card>
            </Grid.Col>
            <Grid.Col span={6}>
                <Card withBorder p={12} style={{ borderRadius: 14, height: 300 }}>
                    <Group justify="space-between" style={{ width: "100%" }}>
                        <Text fw={700} size="md" style={{ color: "#22223b" }}>
                            Clicks & CPC
                        </Text>
                        <ActionIcon variant="subtle" color="gray" size="md">
                            <IconMenu2 size={20} />
                        </ActionIcon>
                    </Group>
                    <Box mt={8}>
                        <LineChart
                            h={230}
                            data={clicksCpcData}
                            dataKey="date"
                            withLegend
                            legendProps={{ verticalAlign: 'top', height: 30 }}
                            tooltipAnimationDuration={200}
                            curveType="linear"
                            gridAxis="xy"
                            series={[
                                { name: "Clicks", color: "green.6" },
                                { name: "CPC", color: "violet.6", yAxisId: "right" },
                            ]}
                            withRightYAxis
                            valueFormatter={(value) => value.toLocaleString()}
                        />
                    </Box>
                </Card>
            </Grid.Col>
            <Grid.Col span={12}>
                <Card withBorder p={12} style={{ borderRadius: 14, height: 320 }}>
                    <Group justify="space-between" style={{ width: "100%" }}>
                        <Text fw={700} size="md" style={{ color: "#22223b" }}>
                            Spend dynamics
                        </Text>
                        <ActionIcon variant="subtle" color="gray" size="md">
                            <IconMenu2 size={20} />
                        </ActionIcon>
                    </Group>
                    <Box mt={8}>
                        <LineChart
                            h={250}
                            data={spendData}
                            dataKey="date"
                            withLegend
                            legendProps={{ verticalAlign: 'top', height: 30 }}
                            curveType="linear"
                            gridAxis="xy"
                            series={[{ name: "Spend", color: "green.6" }]}
                            valueFormatter={(value) => `$${value.toLocaleString()}`}
                        />
                    </Box>
                </Card>
            </Grid.Col>
        </Grid>
    );
}