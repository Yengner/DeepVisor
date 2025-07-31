"use client";

import { Card, Box, Text, Group, Paper, SimpleGrid } from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import { KPI } from "../ReportsClient";

export interface KpiFrequencyChartProps {
    kpis: KPI[];
    frequencyValue?: number;
    frequencyMax?: number;
}

export default function KpiFrequencyChart({ kpis, frequencyValue = 2.04, frequencyMax = 8 }: KpiFrequencyChartProps) {
    return (
        <Group align="flex-start" mb="xl" style={{ width: '100%' }}>
            <SimpleGrid
                cols={5}
                spacing="md"
                style={{ flex: 1, width: '100%' }}
            >
                {/* Top row: 4 KPIs */}
                {kpis.slice(0, 4).map((kpi) => (
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
                            {/* Example: Add a trend below if you want */}
                            <Text size="xs" c="green" mt={4}>▲ 9.1%</Text>
                        </Box>
                    </Card>
                ))}
                {/* Bottom row: 4 KPIs */}
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
                {/* Frequency DonutChart always on the right */}
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
                        {/* Half-donut chart style */}
                        <Box style={{ width: 300, height: 150, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                            <DonutChart
                                h={200}
                                mt={50}
                                withTooltip={false}
                                data={[
                                    { name: 'Filled', value: frequencyMax - frequencyValue, color: 'blue' },
                                    { name: 'Empty', value: frequencyMax - (frequencyMax - frequencyValue), color: 'gray.1' },
                                ]}
                                startAngle={180}
                                endAngle={0}
                                thickness={28}
                                size={150}
                                withLabels={true}
                                style={{ width: '100%', height: '100%' }}
                            />
                            {/* Center value */}
                            <Text fw={700} size="xl" style={{ position: 'absolute', top: '50%', left: 0, width: '100%', textAlign: 'center', transform: 'translateY(-50%)', color: "#22223b" }}>
                                {frequencyValue}
                            </Text>
                            {/* Threshold line */}
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
        </Group>
    );
}