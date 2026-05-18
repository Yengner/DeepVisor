import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconArrowUpRight, IconCheck } from '@tabler/icons-react';
import { asRecord } from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';

type ReviewEntity = {
  id?: string;
  externalId?: string;
  name?: string;
  status?: string | null;
  recent?: {
    spend?: number;
    results?: number;
    impressions?: number;
    ctr?: number;
    costPerResult?: number;
  };
  lifetime?: {
    spend?: number;
    results?: number;
    impressions?: number;
    ctr?: number;
    costPerResult?: number;
  };
};

type ReviewFinding = {
  severity?: 'info' | 'warning' | 'critical';
  title?: string;
  summary?: string;
  reason?: string;
  reportHref?: string | null;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asEntityArray(value: unknown): ReviewEntity[] {
  return Array.isArray(value) ? (value as ReviewEntity[]) : [];
}

function asFindingArray(value: unknown): ReviewFinding[] {
  return Array.isArray(value) ? (value as ReviewFinding[]) : [];
}

function formatCurrency(value: unknown): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(value: unknown): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatMetric(value: unknown): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : '-';
}

function severityColor(severity: string | undefined): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    default:
      return 'blue';
  }
}

function RankingTable({
  title,
  rows,
}: {
  title: string;
  rows: ReviewEntity[];
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
        <Table.ScrollContainer minWidth={720}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Recent spend</Table.Th>
                <Table.Th>Recent results</Table.Th>
                <Table.Th>Cost/result</Table.Th>
                <Table.Th>CTR</Table.Th>
                <Table.Th>Lifetime spend</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id ?? row.externalId ?? row.name}>
                  <Table.Td>
                    <Text fw={600}>{row.name ?? 'Unnamed'}</Text>
                  </Table.Td>
                  <Table.Td>{row.status ?? 'Unknown'}</Table.Td>
                  <Table.Td>{formatCurrency(row.recent?.spend)}</Table.Td>
                  <Table.Td>{formatNumber(row.recent?.results)}</Table.Td>
                  <Table.Td>{formatMetric(row.recent?.costPerResult)}</Table.Td>
                  <Table.Td>{formatMetric(row.recent?.ctr)}%</Table.Td>
                  <Table.Td>{formatCurrency(row.lifetime?.spend)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Paper>
  );
}

export default async function CampaignReviewPage({
  params,
}: {
  params: Promise<{ queueItemId: string }>;
}) {
  const { businessId, user } = await getRequiredAppContext();
  const { queueItemId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('calendar_queue_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('id', queueItemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  if (data.created_by_user_id && data.created_by_user_id !== user.id) {
    notFound();
  }

  const payload = asRecord(data.payload_json);
  const execution = asRecord(payload.execution);
  const action = asRecord(execution.action);
  const isCampaignReviewItem =
    data.item_type === 'campaign_review' ||
    payload.templateType === 'campaign_review' ||
    action.type === 'campaign_review';

  if (!isCampaignReviewItem) {
    notFound();
  }

  const isCompleted = data.status === 'completed' && action.type === 'campaign_review';
  const summary = typeof action.summary === 'string' ? action.summary : null;
  const highlights = asStringArray(action.highlights);
  const risks = asStringArray(action.risks);
  const nextSteps = asStringArray(action.nextSteps);
  const findings = asFindingArray(action.findings);
  const campaignRankings = asEntityArray(action.campaignRankings);
  const adsetRankings = asEntityArray(action.adsetRankings);
  const adRankings = asEntityArray(action.adRankings);

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Group gap="xs">
              <Badge color={isCompleted ? 'green' : 'gray'} variant="light">
                {isCompleted ? 'Completed' : data.status}
              </Badge>
              {action.aiGenerated === true ? <Badge variant="light">AI summary</Badge> : null}
            </Group>
            <Title order={1}>Campaign review</Title>
            <Text c="dimmed">{data.title}</Text>
          </Stack>
          <Button
            component={Link}
            href="/calendar"
            variant="default"
            rightSection={<IconArrowUpRight size={16} />}
          >
            Calendar
          </Button>
        </Group>

        {!isCompleted ? (
          <Alert icon={<IconAlertTriangle size={18} />} color="yellow" radius="md">
            This campaign review has not finished processing yet. It will populate after the
            scheduled queue processor runs.
          </Alert>
        ) : (
          <>
            <Paper withBorder radius="md" p="lg">
              <Stack gap="md">
                <Group gap="xs">
                  <IconCheck size={18} />
                  <Text fw={700}>Review summary</Text>
                </Group>
                <Text>{summary}</Text>
                <SimpleGrid cols={{ base: 1, md: 3 }}>
                  <Stack gap="xs">
                    <Text fw={700}>Highlights</Text>
                    {highlights.map((item) => (
                      <Text key={item} size="sm">
                        {item}
                      </Text>
                    ))}
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={700}>Risks</Text>
                    {risks.map((item) => (
                      <Text key={item} size="sm">
                        {item}
                      </Text>
                    ))}
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={700}>Next steps</Text>
                    {nextSteps.map((item) => (
                      <Text key={item} size="sm">
                        {item}
                      </Text>
                    ))}
                  </Stack>
                </SimpleGrid>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="lg">
              <Stack gap="md">
                <Title order={2} size="h3">
                  Findings
                </Title>
                {findings.length === 0 ? (
                  <Text c="dimmed">No warning or critical findings were generated.</Text>
                ) : (
                  findings.map((finding) => (
                    <Alert
                      key={`${finding.severity}-${finding.title}`}
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
                            component={Link}
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

            <RankingTable title="Campaign ranking" rows={campaignRankings} />
            <RankingTable title="Ad set ranking" rows={adsetRankings} />
            <RankingTable title="Ad ranking" rows={adRankings} />
          </>
        )}
      </Stack>
    </Container>
  );
}
