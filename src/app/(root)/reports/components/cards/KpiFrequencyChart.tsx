"use client";

import { Card, Box, Text, Group, Paper, SimpleGrid, ThemeIcon, Stack, Badge } from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import { KPI } from "../ReportsClient";

export interface KpiFrequencyChartProps {
    kpis: KPI[];
    frequencyValue?: number;
    frequencyMax?: number;
}

export default function KpiFrequencyChart({ kpis, frequencyValue = 2.04, frequencyMax = 8 }: KpiFrequencyChartProps) {
    return (
        <Group align="stretch" justify="space-between" gap="md" mb="lg" style={{ width: '100%' }}>
            <SimpleGrid
                cols={{ base: 1, sm: 2, md: 3, lg: 4 }}
                spacing="md"
                style={{ flex: 1, width: '100%' }}
            >
                {kpis.map((kpi) => (
                    <Card
                        key={kpi.label}
                        withBorder
                        radius="md"
                        p="md"
                        style={{
                            borderColor: 'var(--mantine-color-gray-3)',
                            background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(14,165,233,0.02))',
                        }}
                    >
                        <Group justify="space-between" mb={6}>
                            <Group gap="xs">
                                <ThemeIcon variant="light" color={kpi.color} radius="md">
                                    {kpi.icon}
                                </ThemeIcon>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                    {kpi.label}
                                </Text>
                            </Group>
                            <Badge variant="light" color={kpi.color}>Live</Badge>
                        </Group>
                        <Text fw={800} size="xl">
                            {kpi.value}
                        </Text>
                        <Text size="xs" c="green" mt={4}>▲ 9.1%</Text>
                    </Card>
                ))}
            </SimpleGrid>

            <Card
                withBorder
                p="md"
                radius="lg"
                style={{
                    minWidth: 260,
                    maxWidth: 320,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(180deg, rgba(14,165,233,0.1), rgba(14,165,233,0.04))',
                    borderColor: 'var(--mantine-color-gray-3)',
                }}
            >
                <Group justify="space-between" mb="sm">
                    <Text fw={700} size="lg">
                        Frequency
                    </Text>
                    <Paper radius="md" p={6} withBorder>
                        <Text size="xs" fw={600}>{frequencyValue} / {frequencyMax}</Text>
                    </Paper>
                </Group>
                <Stack align="center" justify="center" gap={8}>
                    <Box style={{ width: '100%', height: 180, position: 'relative' }}>
                        <DonutChart
                            h={180}
                            withTooltip={false}
                            data={[
                                { name: 'Filled', value: frequencyValue, color: 'blue' },
                                { name: 'Empty', value: Math.max(0, frequencyMax - frequencyValue), color: 'gray.1' },
                            ]}
                            thickness={28}
                            size={180}
                        />
                        <Text fw={800} size="xl" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {frequencyValue}
                        </Text>
                    </Box>
                    <Text size="sm" c="dimmed">
                        Avg frequency across the selected range.
                    </Text>
                </Stack>
            </Card>
        </Group>
    );
}
