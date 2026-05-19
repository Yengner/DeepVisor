'use client';

import { Badge, Button, Card, Table, Text } from '@mantine/core';
import { IconStarFilled } from '@tabler/icons-react';
import type { ReportBreakdownRow } from '@/lib/server/reports/types';
import classes from './PerformanceTable.module.css';

interface PerformanceTableProps {
  title: string;
  rows: ReportBreakdownRow[];
  currencyCode: string | null;
  hideTitle?: boolean;
  showRanking?: boolean;
}

const REPORT_TABLE_COLUMN_WIDTHS = [
  '260px',
  '92px',
  '112px',
  '230px',
  '160px',
  '110px',
  '96px',
  '116px',
  '88px',
  '78px',
  '100px',
  '126px',
  '126px',
] as const;
const RANKED_REPORT_TABLE_COLUMN_WIDTHS = ['110px', ...REPORT_TABLE_COLUMN_WIDTHS] as const;

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

  const startLabel = formatReportDate(startDate);
  const endLabel = formatReportDate(endDate);

  if (startDate && endDate && startDate !== endDate && startLabel && endLabel) {
    return formatReportDateRange(startDate, endDate);
  }

  return startLabel ?? endLabel ?? '—';
}

function formatReportDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatReportDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${formatReportDate(startDate) ?? startDate} - ${formatReportDate(endDate) ?? endDate}`;
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endYear = end.getUTCFullYear();

  if (sameMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${endYear}`;
  }

  if (sameYear) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`;
  }

  return `${formatReportDate(startDate)} - ${formatReportDate(endDate)}`;
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

function getContextLines(row: ReportBreakdownRow) {
  if (row.level === 'campaign') {
    return row.secondaryContext ? [`Objective: ${row.secondaryContext}`] : [];
  }

  if (row.level === 'adset') {
    return [
      row.primaryContext ? `Campaign: ${row.primaryContext}` : null,
      row.secondaryContext ? `Goal: ${row.secondaryContext}` : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [
    row.primaryContext ? `Ad set: ${row.primaryContext}` : null,
    row.secondaryContext ? `Campaign: ${row.secondaryContext}` : null,
    row.creativeContext ? `Creative: ${row.creativeContext}` : null,
  ].filter((value): value is string => Boolean(value));
}

export default function PerformanceTable({
  title,
  rows,
  currencyCode,
  hideTitle = false,
  showRanking = false,
}: PerformanceTableProps) {
  const columnWidths = showRanking ? RANKED_REPORT_TABLE_COLUMN_WIDTHS : REPORT_TABLE_COLUMN_WIDTHS;
  const tableMinWidth = columnWidths.reduce((sum, width) => sum + Number(width.replace('px', '')), 0);

  return (
    <Card withBorder p="sm" radius="lg">
      {hideTitle ? null : (
        <Text fw={700} size="lg" mb="md">
          {title}
        </Text>
      )}

      {rows.length === 0 ? (
        <Text ta="center" c="dimmed" py="md" className={classes.mobileEmpty}>
          No performance rows available for the selected filters.
        </Text>
      ) : (
        <div className={classes.mobileCardList}>
          {rows.map((row, index) => {
            const rank = index + 1;
            const contextLines = getContextLines(row);
            const dateWindow = formatDateWindow(row.startDate, row.endDate);

            return (
              <article key={`${row.level}:${row.id}:${rank}`} className={classes.mobileCard}>
                <div className={classes.mobileCardHeader}>
                  <div className={classes.mobileTitleBlock}>
                    <div className={classes.mobileBadgeRow}>
                      {showRanking ? (
                        <Badge
                          variant="light"
                          color={rank === 1 ? 'yellow' : 'gray'}
                          radius="sm"
                          leftSection={rank === 1 ? <IconStarFilled size={12} /> : null}
                        >
                          #{rank}
                        </Badge>
                      ) : null}
                      <Badge variant="light" color={getLevelColor(row.level)} radius="sm">
                        {row.level}
                      </Badge>
                      {row.status ? (
                        <Badge variant="light" color="gray" radius="sm">
                          {row.status}
                        </Badge>
                      ) : null}
                    </div>
                    <Text fw={800} lineClamp={2} title={row.name}>
                      {row.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1} title={dateWindow}>
                      {dateWindow}
                    </Text>
                  </div>
                  {row.drilldownHref ? (
                    <Button
                      component="a"
                      href={row.drilldownHref}
                      variant="light"
                      size="xs"
                      radius="xl"
                    >
                      {row.drilldownLabel ?? 'Open'}
                    </Button>
                  ) : null}
                </div>

                {contextLines.length > 0 ? (
                  <div className={classes.mobileContext}>
                    {contextLines.slice(0, 2).map((line) => (
                      <Text key={line} size="xs" c="dimmed" lineClamp={1} title={line}>
                        {line}
                      </Text>
                    ))}
                  </div>
                ) : null}

                <div className={classes.mobileMetricGrid}>
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>
                      Spend
                    </Text>
                    <Text fw={800}>{formatCurrency(row.spend, currencyCode)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>
                      Results
                    </Text>
                    <Text fw={800}>{row.conversion.toLocaleString()}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>
                      Cost/result
                    </Text>
                    <Text fw={800}>{formatCurrency(row.costPerResult, currencyCode)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>
                      CTR
                    </Text>
                    <Text fw={800}>{row.ctr.toFixed(2)}%</Text>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className={classes.desktopTable}>
        <Table.ScrollContainer minWidth={tableMinWidth}>
        <Table
          striped
          highlightOnHover
          withTableBorder
          withColumnBorders
          verticalSpacing="xs"
          horizontalSpacing="sm"
          style={{ tableLayout: 'fixed', minWidth: tableMinWidth }}
        >
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={`${index}:${width}`} style={{ width }} />
            ))}
          </colgroup>
          <Table.Thead>
            <Table.Tr>
              {showRanking ? <Table.Th ta="center">Rank</Table.Th> : null}
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
              <Table.Th ta="right">Report</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={showRanking ? 14 : 13}>
                  <Text ta="center" c="dimmed" py="md">
                    No performance rows available for the selected filters.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row, index) => {
                const rank = index + 1;
                const contextLines = getContextLines(row);
                const dateWindow = formatDateWindow(row.startDate, row.endDate);

                return (
                  <Table.Tr key={row.id}>
                    {showRanking ? (
                      <Table.Td ta="center">
                        <Badge
                          variant="light"
                          color={rank === 1 ? 'yellow' : 'gray'}
                          radius="sm"
                          leftSection={rank === 1 ? <IconStarFilled size={12} /> : null}
                        >
                          #{rank}
                        </Badge>
                      </Table.Td>
                    ) : null}
                    <Table.Td>
                      <Text fw={700} lineClamp={1} title={row.name}>
                        {row.name}
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
                      {contextLines.length > 0 ? (
                        contextLines.slice(0, 2).map((line) => (
                          <Text key={line} size="xs" c="dimmed" lineClamp={1} title={line}>
                            {line}
                          </Text>
                        ))
                      ) : (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1} title={dateWindow}>
                        {dateWindow}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">{formatCurrency(row.spend, currencyCode)}</Table.Td>
                    <Table.Td ta="right">{row.conversion.toLocaleString()}</Table.Td>
                    <Table.Td ta="right">{row.impressions.toLocaleString()}</Table.Td>
                    <Table.Td ta="right">{row.clicks.toLocaleString()}</Table.Td>
                    <Table.Td ta="right">{row.ctr.toFixed(2)}%</Table.Td>
                    <Table.Td ta="right">{formatCurrency(row.cpc, currencyCode)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(row.costPerResult, currencyCode)}</Table.Td>
                    <Table.Td ta="right">
                      {row.drilldownHref ? (
                        <Button
                          component="a"
                          href={row.drilldownHref}
                          variant="light"
                          size="xs"
                          radius="xl"
                        >
                          {row.drilldownLabel ?? 'Open'}
                        </Button>
                      ) : (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
        </Table.ScrollContainer>
      </div>
    </Card>
  );
}
