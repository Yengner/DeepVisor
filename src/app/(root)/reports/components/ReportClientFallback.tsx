'use client';

import { Card, Container, Grid, Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';

export default function ReportsClientFallback() {
  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Card withBorder radius="lg" p="xl">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs">
                <Skeleton height={26} width={220} radius="md" />
                <Skeleton height={40} width={320} radius="md" />
                <Skeleton height={18} width={180} radius="md" />
              </Stack>
              <Group gap="sm">
                <Skeleton height={36} width={96} radius="xl" />
                <Skeleton height={36} width={110} radius="xl" />
                <Skeleton height={36} width={110} radius="xl" />
              </Group>
            </Group>

            <Group gap="sm">
              <Skeleton height={32} width={58} radius="xl" />
              <Skeleton height={32} width={58} radius="xl" />
              <Skeleton height={32} width={58} radius="xl" />
              <Skeleton height={32} width={58} radius="xl" />
              <Skeleton height={32} width={58} radius="xl" />
              <Skeleton height={32} width={58} radius="xl" />
              <Skeleton height={36} width={260} radius="md" />
              <Skeleton height={36} width={120} radius="md" />
              <Skeleton height={36} width={180} radius="md" />
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="lg" p="xl">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Stack gap="sm">
                <Skeleton height={14} width={60} radius="sm" />
                <Skeleton height={28} width={220} radius="md" />
                <Skeleton height={18} width="100%" radius="sm" />
                <Skeleton height={18} width="94%" radius="sm" />
                <Group gap="xs">
                  <Skeleton height={28} width={150} radius="xl" />
                  <Skeleton height={28} width={120} radius="xl" />
                  <Skeleton height={28} width={110} radius="xl" />
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {[...Array(4)].map((_, index) => (
                  <Skeleton key={index} height={120} radius="md" />
                ))}
              </SimpleGrid>
            </Grid.Col>
          </Grid>
        </Card>

        <Card withBorder radius="lg" p="xl">
          <Stack gap="lg">
            <Group justify="space-between">
              <Stack gap="xs">
                <Skeleton height={14} width={60} radius="sm" />
                <Skeleton height={28} width={280} radius="md" />
                <Skeleton height={18} width={360} radius="sm" />
              </Stack>
              <Skeleton height={36} width={150} radius="xl" />
            </Group>

            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 8 }}>
                <Skeleton height={360} radius="md" />
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 4 }}>
                <Stack gap="sm">
                  {[...Array(3)].map((_, index) => (
                    <Skeleton key={index} height={110} radius="md" />
                  ))}
                </Stack>
              </Grid.Col>
            </Grid>

            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
              <Skeleton height={280} radius="md" />
              <Skeleton height={280} radius="md" />
            </SimpleGrid>
          </Stack>
        </Card>

        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between" mb="md">
            <Stack gap="xs">
              <Skeleton height={14} width={56} radius="sm" />
              <Skeleton height={28} width={320} radius="md" />
            </Stack>
            <Skeleton height={36} width={150} radius="xl" />
          </Group>

          <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} height={220} radius="md" />
            ))}
          </SimpleGrid>
        </Card>
      </Stack>
    </Container>
  );
}
