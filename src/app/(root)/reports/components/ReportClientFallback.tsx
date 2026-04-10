'use client';

import { Card, Container, Grid, Group, SimpleGrid, Skeleton, Stack, Table } from '@mantine/core';
import classes from './ReportsClient.module.css';

export default function ReportsClientFallback() {
  return (
    <Container fluid px={6} py={0} className={`${classes.page} reports-page-shell`}>
      <Stack gap="md" className={classes.shell}>
        <Card withBorder radius="xl" p={{ base: 'md', md: 'lg' }} className={classes.headerCard}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap="xs">
                <Group gap="xs">
                  <Skeleton height={24} width={120} radius="xl" />
                  <Skeleton height={24} width={110} radius="xl" />
                  <Skeleton height={24} width={150} radius="xl" />
                </Group>
                <Skeleton height={34} width={320} radius="md" />
                <Skeleton height={16} width={220} radius="md" />
              </Stack>
              <Group gap="sm">
                <Skeleton height={38} width={105} radius="xl" />
                <Skeleton height={38} width={120} radius="xl" />
                <Skeleton height={38} width={110} radius="xl" />
                <Skeleton height={38} width={38} circle />
              </Group>
            </Group>

            <Group gap="sm" className={classes.controlBar}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} height={28} width={48} radius="xl" />
              ))}
              <Skeleton height={36} width={260} radius="md" />
              <Skeleton height={36} width={120} radius="md" />
              <Skeleton height={28} width={190} radius="xl" />
            </Group>
          </Stack>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} withBorder radius="xl" p="md" className={classes.kpiCard}>
              <Skeleton height={12} width={100} mb={14} />
              <Skeleton height={32} width={120} mb={12} />
              <Skeleton height={24} width={86} radius="xl" />
            </Card>
          ))}
        </SimpleGrid>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, xl: 8 }}>
            <Card withBorder radius="xl" p="lg" className={classes.reportCard}>
              <Group justify="space-between" className={classes.cardHeader}>
                <Stack gap="xs">
                  <Skeleton height={12} width={80} />
                  <Skeleton height={26} width={240} />
                  <Skeleton height={16} width={360} />
                </Stack>
                <Skeleton height={24} width={120} radius="xl" />
              </Group>
              <Skeleton height={340} radius="lg" mt="md" />
              <Skeleton height={82} radius="lg" mt="md" />
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Card withBorder radius="xl" p="lg" className={classes.reportCard}>
              <Stack gap="sm">
                <Skeleton height={28} width={210} />
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} height={92} radius="lg" />
                ))}
                <Skeleton height={38} width={170} radius="xl" />
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
          <Skeleton height={300} radius="xl" />
          <Skeleton height={300} radius="xl" />
        </SimpleGrid>

        <Card withBorder radius="xl" p="lg" className={classes.reportCard}>
          <Group justify="space-between" mb="md">
            <Stack gap="xs">
              <Skeleton height={12} width={120} />
              <Skeleton height={28} width={260} />
            </Stack>
            <Group gap="xs">
              <Skeleton height={24} width={120} radius="xl" />
              <Skeleton height={24} width={140} radius="xl" />
            </Group>
          </Group>
          <Table.ScrollContainer minWidth={1100}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  {Array.from({ length: 12 }).map((_, index) => (
                    <Table.Th key={index}>
                      <Skeleton height={12} width={index === 0 ? 160 : 70} />
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Array.from({ length: 8 }).map((_, rowIndex) => (
                  <Table.Tr key={rowIndex}>
                    {Array.from({ length: 12 }).map((__, cellIndex) => (
                      <Table.Td key={cellIndex}>
                        <Skeleton height={14} width={cellIndex === 0 ? 220 : 70} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    </Container>
  );
}
