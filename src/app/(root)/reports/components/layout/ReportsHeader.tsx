'use client';

import { useMemo } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFileSpreadsheet, IconFileTypePdf, IconRefresh } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';

interface ReportsHeaderProps {
  payload: ReportPayload;
  exportLinks: {
    pdf: string;
    csv: string;
  };
  onUpdate: (mutate: (params: URLSearchParams) => void) => void;
  isPending?: boolean;
}

function toIsoDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function presetRange(preset: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);

  switch (preset) {
    case '7d':
      from.setDate(today.getDate() - 6);
      break;
    case '30d':
      from.setDate(today.getDate() - 29);
      break;
    case '90d':
      from.setDate(today.getDate() - 89);
      break;
    case 'mtd':
      from.setDate(1);
      break;
    case 'qtd':
      from.setMonth(Math.floor(today.getMonth() / 3) * 3, 1);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      break;
    default:
      from.setDate(today.getDate() - 29);
      break;
  }

  return {
    dateFrom: toIsoDate(from),
    dateTo: toIsoDate(today),
  };
}

export default function ReportsHeader({
  payload,
  exportLinks,
  onUpdate,
  isPending = false,
}: ReportsHeaderProps) {
  const rangeValue = useMemo(
    () => [
      payload.query.dateFrom ? parseLocalDate(payload.query.dateFrom) : null,
      payload.query.dateTo ? parseLocalDate(payload.query.dateTo) : null,
    ] as [Date | null, Date | null],
    [payload.query.dateFrom, payload.query.dateTo]
  );

  const presets = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: 'mtd', label: 'MTD' },
    { value: 'qtd', label: 'QTD' },
    { value: 'ytd', label: 'YTD' },
  ];

  return (
    <Card
      p="xl"
      radius="lg"
      withBorder
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(120deg, #0f172a 0%, #111827 50%, #0ea5e9 130%)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 10% 20%, rgba(14,165,233,0.2), transparent 34%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.18), transparent 28%)',
        }}
      />

      <Stack gap="lg" pos="relative">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Group gap="xs" align="center">
              <Badge color="indigo" variant="light" size="md">
                {payload.meta.businessName}
              </Badge>
              <Badge color="cyan" variant="light" size="md">
                {payload.meta.scopeLabel}
              </Badge>
              <Badge color="green" variant="light" size="md">
                {payload.query.compareMode === 'previous_period' ? 'Compared' : 'Live'}
              </Badge>
            </Group>
            <Text fw={800} size="2rem" c="white" mt="xs">
              {payload.meta.title}
            </Text>
            <Text size="sm" c="gray.2">
              {payload.meta.subtitle}
            </Text>
          </Box>

          <Group gap="sm">
            <Button
              component="a"
              href={exportLinks.pdf}
              leftSection={<IconFileTypePdf size={16} />}
              radius="xl"
              variant="white"
              color="dark"
            >
              Export PDF
            </Button>
            <Button
              component="a"
              href={exportLinks.csv}
              leftSection={<IconFileSpreadsheet size={16} />}
              radius="xl"
              variant="light"
              color="gray"
            >
              Export CSV
            </Button>
            <Tooltip label={isPending ? 'Refreshing…' : 'Refresh report'}>
              <ActionIcon
                size="lg"
                radius="xl"
                variant="light"
                color="gray"
                onClick={() => onUpdate(() => undefined)}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Group align="flex-end" gap="md">
          <Group gap="xs">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                radius="xl"
                size="xs"
                variant="white"
                color="dark"
                onClick={() => {
                  const range = presetRange(preset.value);
                  onUpdate((params) => {
                    params.set('date_from', range.dateFrom);
                    params.set('date_to', range.dateTo);
                  });
                }}
              >
                {preset.label}
              </Button>
            ))}
          </Group>

          <DatePickerInput
            type="range"
            value={rangeValue}
            onChange={(value) => {
              const [start, end] = value;
              if (!start || !end) {
                return;
              }

              onUpdate((params) => {
                params.set('date_from', toIsoDate(start));
                params.set('date_to', toIsoDate(end));
              });
            }}
            valueFormat="MMM D, YYYY"
            radius="md"
            size="sm"
            placeholder="Select date range"
            style={{ minWidth: 280 }}
          />

          <Select
            label="Group by"
            value={payload.query.groupBy}
            onChange={(value) => {
              if (!value) {
                return;
              }

              onUpdate((params) => {
                params.set('group_by', value);
              });
            }}
            data={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            radius="md"
            size="sm"
            style={{ minWidth: 120 }}
          />

          <Switch
            label="Compare previous period"
            checked={payload.query.compareMode === 'previous_period'}
            onChange={(event) => {
              onUpdate((params) => {
                params.set(
                  'compare',
                  event.currentTarget.checked ? 'previous_period' : 'none'
                );
              });
            }}
            color="cyan"
            size="md"
          />
        </Group>
      </Stack>
    </Card>
  );
}
