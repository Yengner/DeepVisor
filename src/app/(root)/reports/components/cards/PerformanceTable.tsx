"use client";

import { Badge, Card, Group, Table, Text } from "@mantine/core";
import type { ReportBreakdownRow } from "@/lib/server/reports/types";

interface PerformanceTableProps {
  title: string;
  rows: ReportBreakdownRow[];
  currencyCode: string | null;
}

function formatCurrency(value: number, currencyCode: string | null) {
  if (!currencyCode || currencyCode === 'MIXED') {
    return value.toFixed(2);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatDateWindow(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) {
    return '—';
  }

  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} to ${endDate}`;
  }

  return startDate ?? endDate ?? '—';
}

function getLevelColor(level: ReportBreakdownRow['level']) {
  if (level === 'campaign') {
    return 'blue';
  }

  if (level === 'adset') {
    return 'violet';
  }

  return 'teal';
}

export default function PerformanceTable({
  title,
  rows,
  currencyCode,
}: PerformanceTableProps) {
  return (
    <Card withBorder p="md" radius="lg">
      <Text fw={700} size="lg" mb="md">
        {title}
      </Text>

      <Table.ScrollContainer minWidth={1100}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Entity</Table.Th>
              <Table.Th>Level</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Context</Table.Th>
              <Table.Th>Window</Table.Th>
              <Table.Th ta="right">Spend</Table.Th>
              <Table.Th ta="right">Results</Table.Th>
              <Table.Th ta="right">Impressions</Table.Th>
              <Table.Th ta="right">Clicks</Table.Th>
              <Table.Th ta="right">CTR</Table.Th>
              <Table.Th ta="right">CPC</Table.Th>
              <Table.Th ta="right">Cost / Result</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={12}>
                  <Text ta="center" c="dimmed" py="md">
                    No performance rows available for the selected filters.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text fw={700}>{row.name}</Text>
                    <Text size="xs" c="dimmed">
                      {row.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={getLevelColor(row.level)}>
                      {row.level}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {row.status ? (
                      <Badge variant="light" color="gray">
                        {row.status}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Text size="sm">{row.primaryContext || '—'}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {row.secondaryContext || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatDateWindow(row.startDate, row.endDate)}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.spend, currencyCode)}</Table.Td>
                  <Table.Td ta="right">{row.conversion.toLocaleString()}</Table.Td>
                  <Table.Td ta="right">{row.impressions.toLocaleString()}</Table.Td>
                  <Table.Td ta="right">{row.clicks.toLocaleString()}</Table.Td>
                  <Table.Td ta="right">{row.ctr.toFixed(2)}%</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.cpc, currencyCode)}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.costPerResult, currencyCode)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}
