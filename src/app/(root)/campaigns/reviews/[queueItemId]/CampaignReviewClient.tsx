'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCalendarTime,
  IconCheck,
  IconClock,
  IconSparkles,
} from '@tabler/icons-react';
import type {
  CampaignReviewEntityView,
  CampaignReviewFindingView,
  CampaignReviewViewModel,
} from './types';
import classes from './CampaignReviewClient.module.css';

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatMetric(value: number): string {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : '-';
}

function stateColor(state: CampaignReviewViewModel['state']): string {
  switch (state) {
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    default:
      return 'yellow';
  }
}

function severityColor(severity: CampaignReviewFindingView['severity']): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    default:
      return 'blue';
  }
}

function stateLabel(state: CampaignReviewViewModel['state'], rawStatus: string): string {
  switch (state) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Needs retry';
    default:
      return rawStatus === 'in_progress' ? 'Processing' : 'Waiting to process';
  }
}

function SummaryCard({
  label,
  value,
  detail,
  color,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">
            {label}
          </Text>
          <Title order={3} mt={6}>
            {value}
          </Title>
        </div>
        <ThemeIcon variant="light" color={color} radius="md" size="lg">
          {icon}
        </ThemeIcon>
      </Group>
      <Text size="sm" c="dimmed">
        {detail}
      </Text>
    </Card>
  );
}

function TextList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <Stack gap="xs">
      <Text fw={700}>{title}</Text>
      {items.length > 0 ? (
        items.map((item, index) => (
          <Text key={`${title}-${index}-${item}`} size="sm">
            {item}
          </Text>
        ))
      ) : (
        <Text size="sm" c="dimmed">
          {empty}
        </Text>
      )}
    </Stack>
  );
}

function FindingsSection({ findings }: { findings: CampaignReviewFindingView[] }) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Title order={2} size="h3">
          Findings
        </Title>
        {findings.length === 0 ? (
          <Text c="dimmed">No warning or critical findings were generated for this review.</Text>
        ) : (
          findings.map((finding, index) => (
            <Alert
              key={`${finding.severity}-${finding.title}-${index}`}
              color={severityColor(finding.severity)}
              title={finding.title}
              radius="md"
            >
              <Stack gap="xs">
                <Text size="sm">{finding.summary}</Text>
                {finding.reason ? (
                  <Text size="xs" c="dimmed">
                    {finding.reason}
                  </Text>
                ) : null}
                {finding.reportHref ? (
                  <Button
                    component="a"
                    href={finding.reportHref}
                    size="xs"
                    variant="light"
                    rightSection={<IconArrowUpRight size={14} />}
                  >
                    Open report
                  </Button>
                ) : null}
              </Stack>
            </Alert>
          ))
        )}
      </Stack>
    </Paper>
  );
}

function RankingTable({
  title,
  rows,
}: {
  title: string;
  rows: CampaignReviewEntityView[];
}) {
  if (rows.length === 0) {
    return (
      <Paper withBorder radius="md" p="lg">
        <Stack gap={4}>
          <Title order={3} size="h4">
            {title}
          </Title>
          <Text c="dimmed" size="sm">
            No rows were available for this review scope.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Title order={3} size="h4">
          {title}
        </Title>
        <div className={classes.mobileRankingList}>
          {rows.map((row, index) => (
            <article
              key={`mobile:${row.level}:${row.id ?? row.externalId ?? index}`}
              className={classes.mobileRankingCard}
            >
              <Group gap="xs" wrap="wrap" mb="xs">
                <Badge color="gray" variant="light" radius="sm">
                  #{index + 1}
                </Badge>
                <Badge variant="light" radius="sm">
                  {row.status ?? 'Unknown'}
                </Badge>
              </Group>
              <Text fw={800} lineClamp={2}>
                {row.name}
              </Text>
              {row.objective ? (
                <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
                  {row.objective}
                </Text>
              ) : null}
              <div className={classes.mobileMetricGrid}>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>
                    Recent spend
                  </Text>
                  <Text fw={800}>{formatCurrency(row.recent.spend)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>
                    Results
                  </Text>
                  <Text fw={800}>{formatNumber(row.recent.results)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>
                    Cost/result
                  </Text>
                  <Text fw={800}>{formatMetric(row.recent.costPerResult)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>
                    Lifetime spend
                  </Text>
                  <Text fw={800}>{formatCurrency(row.lifetime.spend)}</Text>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Box className={classes.desktopRankingTable} style={{ overflowX: 'auto' }}>
          <Table verticalSpacing="sm" style={{ minWidth: 720 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Recent spend</Table.Th>
                <Table.Th ta="right">Recent results</Table.Th>
                <Table.Th ta="right">Cost/result</Table.Th>
                <Table.Th ta="right">CTR</Table.Th>
                <Table.Th ta="right">Lifetime spend</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => (
                <Table.Tr key={`${row.level}:${row.id ?? row.externalId ?? index}`}>
                  <Table.Td>
                    <Text fw={600}>{row.name}</Text>
                    {row.objective ? (
                      <Text size="xs" c="dimmed">
                        {row.objective}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>{row.status ?? 'Unknown'}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.recent.spend)}</Table.Td>
                  <Table.Td ta="right">{formatNumber(row.recent.results)}</Table.Td>
                  <Table.Td ta="right">{formatMetric(row.recent.costPerResult)}</Table.Td>
                  <Table.Td ta="right">{formatMetric(row.recent.ctr)}%</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.lifetime.spend)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function CampaignReviewClient({
  review,
}: {
  review: CampaignReviewViewModel;
}) {
  const completed = review.state === 'completed';
  const failed = review.state === 'failed';

  return (
    <Container size="xl" py="xl" className={classes.page}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
          <Stack gap={6}>
            <Group gap="xs" wrap="wrap">
              <Badge color={stateColor(review.state)} variant="light">
                {stateLabel(review.state, review.rawStatus)}
              </Badge>
              <Badge variant="light">{review.scopeLabel}</Badge>
              {review.aiGenerated ? <Badge variant="light">AI summary</Badge> : null}
              {!review.aiGenerated && review.fallbackReason ? (
                <Badge color="gray" variant="light">
                  Rules fallback
                </Badge>
              ) : null}
            </Group>
            <Title order={1}>Campaign review</Title>
            <Text c="dimmed">{review.title}</Text>
          </Stack>
          <Group gap="sm" className={classes.headerActions}>
            <Button component="a" href="/dashboard" variant="default">
              Dashboard
            </Button>
            <Button
              component="a"
              href="/calendar"
              rightSection={<IconArrowUpRight size={16} />}
            >
              Calendar
            </Button>
          </Group>
        </Group>

        {failed ? (
          <Alert icon={<IconAlertTriangle size={18} />} color="red" radius="md">
            {review.errorMessage ??
              'This campaign review failed during the last processing attempt. It can be retried by the queue processor.'}
          </Alert>
        ) : null}

        {!completed && !failed ? (
          <Alert icon={<IconClock size={18} />} color="yellow" radius="md">
            This campaign review is queued or waiting to process. It will populate after the
            scheduled queue processor runs.
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
          <SummaryCard
            label="Campaigns Reviewed"
            value={formatNumber(review.reviewedCampaignCount)}
            detail="Campaigns included in this review scope."
            color="blue"
            icon={<IconCheck size={18} />}
          />
          <SummaryCard
            label="Findings"
            value={formatNumber(review.findings.length)}
            detail="Warning or critical items saved for review."
            color={review.findings.length > 0 ? 'orange' : 'green'}
            icon={<IconAlertTriangle size={18} />}
          />
          <SummaryCard
            label="Generated"
            value={review.generatedAt ? formatDateTime(review.generatedAt) : 'Pending'}
            detail={`Scheduled for ${formatDateTime(review.scheduledFor)}.`}
            color="teal"
            icon={<IconCalendarTime size={18} />}
          />
          <SummaryCard
            label="Review Mode"
            value={review.aiGenerated ? 'AI' : 'Rules'}
            detail={
              review.aiGenerated
                ? `AI narrative with deterministic thresholds.${review.promptVersion ? ` ${review.promptVersion}.` : ''}`
                : review.fallbackReason
                  ? `Fallback: ${review.fallbackReason}.`
                  : 'Deterministic thresholds and comparison stats.'
            }
            color="violet"
            icon={<IconSparkles size={18} />}
          />
        </SimpleGrid>

        {review.unavailableCampaign ? (
          <Alert icon={<IconAlertTriangle size={18} />} color="yellow" radius="md">
            The selected campaign was unavailable when this review ran:{' '}
            {review.unavailableCampaign}
          </Alert>
        ) : null}

        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconCheck size={18} />
              <Text fw={700}>Review summary</Text>
            </Group>
            <Text>
              {review.summary ??
                'This review has not produced a summary yet. Check back after the queue processor completes the run.'}
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }}>
              <TextList
                title="Highlights"
                items={review.highlights}
                empty="No highlights are available yet."
              />
              <TextList
                title="Risks"
                items={review.risks}
                empty="No risks are available yet."
              />
              <TextList
                title="Next steps"
                items={review.nextSteps}
                empty="No next steps are available yet."
              />
              <TextList
                title="Operator notes"
                items={review.operatorNotes}
                empty="No operator notes are available yet."
              />
            </SimpleGrid>
            {review.aiRunId || review.decisionSupportVersion ? (
              <Text size="xs" c="dimmed">
                {[
                  review.decisionSupportVersion ? `Decision support: ${review.decisionSupportVersion}` : null,
                  review.aiRunId ? `AI run: ${review.aiRunId}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </Stack>
        </Paper>

        {completed ? <FindingsSection findings={review.findings} /> : null}

        <RankingTable title="Campaign ranking" rows={review.campaignRankings} />
        <RankingTable title="Ad set ranking" rows={review.adsetRankings} />
        <RankingTable title="Ad ranking" rows={review.adRankings} />
      </Stack>
    </Container>
  );
}
