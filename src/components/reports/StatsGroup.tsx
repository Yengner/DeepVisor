import { Group, Paper, SimpleGrid, Text, Box } from '@mantine/core';
import { IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react';

interface StatsGroupProps {
  data: { title: string; value: string; diff: number; icon: 'up' | 'down' }[];
}

export function StatsGroup({ data }: StatsGroupProps) {
  const stats = data.map((stat) => {
    const DiffIcon = stat.icon === 'up' ? IconArrowUpRight : IconArrowDownRight;

    return (
      <Paper withBorder p="md" radius="md" key={stat.title}>
        <Group justify="space-between">
          <div>
            <Text c="dimmed" size="xs" fw={700} tt="uppercase">
              {stat.title}
            </Text>
            <Text fz={24} fw={700} lh={1} mt="xs">
              {stat.value}
            </Text>
          </div>
          <DiffIcon
            color={stat.icon === 'up' ? 'teal' : 'red'}
            size="1.4rem"
            stroke={1.5}
          />
        </Group>
        <Text c={stat.icon === 'up' ? 'teal' : 'red'} size="sm" mt="md" fw={500}>
          <span>{stat.diff}%</span>
          <span> from previous period</span>
        </Text>
      </Paper>
    );
  });

  return (
    <Box mb="md">
      <SimpleGrid cols={4} breakpoints={[{ maxWidth: 'sm', cols: 1 }]}>
        {stats}
      </SimpleGrid>
    </Box>
  );
}