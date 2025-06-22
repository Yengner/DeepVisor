'use client';

import { SimpleGrid, Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconCoin, IconEye, IconClick, IconUserCheck } from '@tabler/icons-react';

interface StatsCardsProps {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalLeads: number;
}

export default function StatsCards({
    totalSpend,
    totalImpressions,
    totalClicks,
    totalLeads
}: StatsCardsProps) {
    const stats = [
        {
            title: 'Total Spend',
            value: `$${totalSpend.toLocaleString()}`,
            icon: <IconCoin size={24} />,
            color: 'green',
            change: 5.2,
            description: 'vs last 30 days'
        },
        {
            title: 'Impressions',
            value: totalImpressions.toLocaleString(),
            icon: <IconEye size={24} />,
            color: 'blue',
            change: 8.1,
            description: 'vs last 30 days'
        },
        {
            title: 'Clicks',
            value: totalClicks.toLocaleString(),
            icon: <IconClick size={24} />,
            color: 'violet',
            change: -2.3,
            description: 'vs last 30 days'
        },
        {
            title: 'Leads',
            value: totalLeads.toLocaleString(),
            icon: <IconUserCheck size={24} />,
            color: 'orange',
            change: 10.5,
            description: 'vs last 30 days'
        }
    ];

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {stats.map((stat) => (
                <Card key={stat.title} withBorder p="md">
                    <Group justify="apart">
                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                            {stat.title}
                        </Text>
                        <ThemeIcon color={stat.color} variant="light" size={38} radius="md">
                            {stat.icon}
                        </ThemeIcon>
                    </Group>

                    <Text fw={700} size="xl" mt="md">
                        {stat.value}
                    </Text>

                    <Group mt="md" justify="apart" gap="xs">
                        <Text c={stat.change > 0 ? 'teal' : 'red'} size="sm" fw={700}>
                            {stat.change > 0 ? '+' : ''}{stat.change}%
                        </Text>
                        <Text size="xs" c="dimmed">
                            {stat.description}
                        </Text>
                    </Group>
                </Card>
            ))}
        </SimpleGrid>
    );
}