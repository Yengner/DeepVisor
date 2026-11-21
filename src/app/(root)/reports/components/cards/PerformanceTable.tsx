'use client';

import { Badge, Button, Card, Table, Text } from '@mantine/core';
import { IconStarFilled } from '@tabler/icons-react';
import type { ReportBreakdownRow } from '@/lib/server/reports/types';
import { useLabels } from '@/lib/client/hooks/useLabels';
import { useReportFormat } from '../useReportFormat';
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
  hideTitle = false,
  showRanking = false,
}: PerformanceTableProps) {
  const f = useReportFormat(), t = f.t, labels = useLabels();
  const formatReportMetric = f.value;
  const formatDateWindow = (startDate: string | null, endDate: string | null) =>
    !startDate && !endDate ? '—' : startDate && endDate && startDate !== endDate ? f.range(startDate, endDate) : f.day(startDate ?? endDate);
  const objective = (value: string) => /^[A-Z][A-Z0-9_]+$/.test(value) ? labels.objective(value) : value;
  const getContextLines = (row: ReportBreakdownRow) => {
    if (row.level === 'campaign') return row.secondaryContext ? [t('table.objective', { value: objective(row.secondaryContext) })] : [];
    if (row.level === 'adset') return [
      row.primaryContext ? t('table.campaign', { value: row.primaryContext }) : null,
      row.secondaryContext ? t('table.goal', { value: objective(row.secondaryContext) }) : null,
    ].filter((value): value is string => Boolean(value));
    return [
      row.primaryContext ? t('table.adset', { value: row.primaryContext }) : null,
      row.secondaryContext ? t('table.campaign', { value: row.secondaryContext }) : null,
      row.creativeContext ? t('table.creative', { value: row.creativeContext }) : null,
    ].filter((value): value is string => Boolean(value));
  };
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
          {t('table.empty')}
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
                        {t(`level.${row.level}`)}
                      </Badge>
                      {row.status ? (
                        <Badge variant="light" color="gray" radius="sm">
                          {labels.status(row.status)}
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
                      {row.drilldownLabel ?? t('table.open')}
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
                    <Text size="sm" c="dimmed" fw={700}>
                      {f.metric('spend')}
                    </Text>
                    <Text fw={800}>{formatReportMetric(row, "spend", currencyCode)}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed" fw={700}>
                      {f.metric('conversion')}
                    </Text>
                    <Text fw={800}>{formatReportMetric(row, "conversion", currencyCode)}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed" fw={700}>
                      {t('table.costResult')}
                    </Text>
                    <Text fw={800}>{formatReportMetric(row, "costPerResult", currencyCode)}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed" fw={700}>
                      {f.metric('ctr')}
                    </Text>
                    <Text fw={800}>{formatReportMetric(row, "ctr", currencyCode)}</Text>
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
              {showRanking ? <Table.Th ta="center">{t('table.rank')}</Table.Th> : null}
              <Table.Th>{t('table.entity')}</Table.Th>
              <Table.Th>{t('table.level')}</Table.Th>
              <Table.Th>{t('table.status')}</Table.Th>
              <Table.Th>{t('table.context')}</Table.Th>
              <Table.Th>{t('table.window')}</Table.Th>
              <Table.Th ta="right">{f.metric('spend')}</Table.Th>
              <Table.Th ta="right">{f.metric('conversion')}</Table.Th>
              <Table.Th ta="right">{f.metric('impressions')}</Table.Th>
              <Table.Th ta="right">{f.metric('clicks')}</Table.Th>
              <Table.Th ta="right">{f.metric('ctr')}</Table.Th>
              <Table.Th ta="right">{f.metric('cpc')}</Table.Th>
              <Table.Th ta="right">{f.metric('costPerResult')}</Table.Th>
              <Table.Th ta="right">{t('table.report')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={showRanking ? 14 : 13}>
                  <Text ta="center" c="dimmed" py="md">
                    {t('table.empty')}
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
                        {t(`level.${row.level}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {row.status ? (
                        <Badge variant="light" color="gray">
                          {labels.status(row.status)}
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
                    <Table.Td ta="right">{formatReportMetric(row, "spend", currencyCode)}</Table.Td>
                    <Table.Td ta="right">{formatReportMetric(row, "conversion", currencyCode)}</Table.Td>
                    <Table.Td ta="right">{formatReportMetric(row, "impressions", currencyCode)}</Table.Td>
                    <Table.Td ta="right">{formatReportMetric(row, "clicks", currencyCode)}</Table.Td>
                    <Table.Td ta="right">{formatReportMetric(row, "ctr", currencyCode)}</Table.Td>
                    <Table.Td ta="right">{formatReportMetric(row, "cpc", currencyCode)}</Table.Td>
                    <Table.Td ta="right">{formatReportMetric(row, "costPerResult", currencyCode)}</Table.Td>
                    <Table.Td ta="right">
                      {row.drilldownHref ? (
                        <Button
                          component="a"
                          href={row.drilldownHref}
                          variant="light"
                          size="xs"
                          radius="xl"
                        >
                          {row.drilldownLabel ?? t('table.open')}
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
