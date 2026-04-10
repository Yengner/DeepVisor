'use client';

import {
  Box,
  Card,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Table,
} from '@mantine/core';
import classes from '@/components/campaigns/CampaignDashboard.module.css';

export default function CampaignClientFallback() {
  return (
    <div className={`${classes.pageShell} campaigns-page-shell`}>
      <Card withBorder radius="xl" p={0} className={classes.tableSurface}>
        <div className={classes.tableHeader}>
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
            <Stack gap="xs" style={{ flex: 1, minWidth: 280 }}>
              <Group gap="xs">
                <Skeleton height={24} width={90} radius="xl" />
                <Skeleton height={24} width={110} radius="xl" />
                <Skeleton height={24} width={170} radius="xl" />
              </Group>
              <Skeleton height={34} width={250} />
              <Group gap="xs">
                <Skeleton height={24} width={90} radius="xl" />
                <Skeleton height={24} width={100} radius="xl" />
                <Skeleton height={24} width={120} radius="xl" />
                <Skeleton height={24} width={100} radius="xl" />
              </Group>
            </Stack>

            <Group gap="sm">
              <Skeleton height={38} width={150} radius="xl" />
              <Skeleton height={38} width={38} circle />
            </Group>
          </Group>

          <Group justify="space-between" mt="md" gap="md" wrap="wrap">
            <Group gap="xs">
              <Skeleton height={34} width={110} radius="xl" />
              <Skeleton height={34} width={90} radius="xl" />
              <Skeleton height={34} width={72} radius="xl" />
            </Group>
            <Group gap="xs">
              <Skeleton height={24} width={110} radius="xl" />
              <Skeleton height={24} width={115} radius="xl" />
              <Skeleton height={24} width={95} radius="xl" />
            </Group>
          </Group>

          <Box className={classes.filterBar} mt="md">
            <Group gap="sm">
              <Skeleton height={36} style={{ flex: 1, minWidth: 220 }} radius="md" />
              <Skeleton height={36} width={164} radius="md" />
              <Skeleton height={36} width={164} radius="md" />
            </Group>
          </Box>
        </div>

        <div className={classes.tableBody}>
          <div className={classes.tablePanelInner}>
            <ScrollArea h="100%" type="always" offsetScrollbars="x" style={{ borderRadius: 8, height: '100%' }}>
              <Table stickyHeader style={{ minWidth: 1200 }}>
                <Table.Thead>
                  <Table.Tr>
                    {Array.from({ length: 18 }).map((_, index) => (
                      <Table.Th key={index}>
                        <Skeleton height={12} width={index === 1 ? 180 : 80} />
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Array.from({ length: 12 }).map((_, rowIndex) => (
                    <Table.Tr key={rowIndex}>
                      {Array.from({ length: 18 }).map((__, cellIndex) => (
                        <Table.Td key={cellIndex}>
                          <Skeleton height={14} width={cellIndex === 1 ? 240 : 72} />
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  );
}
