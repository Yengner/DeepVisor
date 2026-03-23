'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconClock, IconRefresh } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type {
  AssessmentBreakdownItem,
  BusinessAgencyPlanningScope,
  BusinessAgencyWorkspace,
} from '@/lib/server/agency';

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function stateColor(state: string) {
  switch (state) {
    case 'mature':
      return 'green';
    case 'optimizable':
      return 'blue';
    case 'learning':
      return 'yellow';
    case 'launch_ready':
      return 'teal';
    case 'misconfigured':
      return 'red';
    case 'stale':
      return 'orange';
    default:
      return 'gray';
  }
}

function trackingColor(level: string) {
  switch (level) {
    case 'high':
      return 'green';
    case 'medium':
      return 'yellow';
    default:
      return 'red';
  }
}

function scopeCopy(scope: BusinessAgencyPlanningScope) {
  switch (scope) {
    case 'integration':
      return 'Integration';
    case 'selected_integrations':
      return 'Selected integrations';
    default:
      return 'Business';
  }
}

function renderSimpleList(items: string[]) {
  if (items.length === 0) {
    return <Text size="sm" c="dimmed">None recorded yet.</Text>;
  }

  return (
    <Stack gap={6}>
      {items.map((item) => (
        <Text key={item} size="sm">
          - {item}
        </Text>
      ))}
    </Stack>
  );
}

function BreakdownTable({
  title,
  items,
  emptyCopy,
}: {
  title: string;
  items: AssessmentBreakdownItem[];
  emptyCopy: string;
}) {
  return (
    <Card withBorder radius="lg" p="lg">
      <Group justify="space-between" mb="md">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Breakdown
          </Text>
          <Title order={4}>{title}</Title>
        </div>
        <Badge variant="light" color="gray">
          {items.length}
        </Badge>
      </Group>

      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          {emptyCopy}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={520}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Spend</Table.Th>
                <Table.Th ta="right">Results</Table.Th>
                <Table.Th ta="right">CTR</Table.Th>
                <Table.Th ta="right">Cost / Result</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text fw={600}>{item.name}</Text>
                    {item.objective ? (
                      <Text size="xs" c="dimmed">
                        {item.objective}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>{item.status ?? 'UNKNOWN'}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(item.spend)}</Table.Td>
                  <Table.Td ta="right">{item.conversion.toLocaleString()}</Table.Td>
                  <Table.Td ta="right">{formatPercent(item.ctr)}</Table.Td>
                  <Table.Td ta="right">
                    {item.conversion > 0 ? formatCurrency(item.costPerResult) : '-'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}

export default function AgencyClient({ workspace }: { workspace: BusinessAgencyWorkspace }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [scope, setScope] = useState<BusinessAgencyPlanningScope>(workspace.selection.scope);
  const [platformIntegrationId, setPlatformIntegrationId] = useState<string | null>(
    workspace.selection.platformIntegrationId
  );
  const [selectedPlatformIntegrationIds, setSelectedPlatformIntegrationIds] = useState<string[]>(
    workspace.selection.platformIntegrationIds
  );

  useEffect(() => {
    setScope(workspace.selection.scope);
    setPlatformIntegrationId(workspace.selection.platformIntegrationId);
    setSelectedPlatformIntegrationIds(workspace.selection.platformIntegrationIds);
  }, [workspace.selection]);

  const topKpis = useMemo(() => workspace.overview.kpis.slice(0, 4), [workspace.overview.kpis]);
  const adAccountById = useMemo(
    () => new Map(workspace.adAccounts.map((account) => [account.id, account])),
    [workspace.adAccounts]
  );

  const platformOptions = workspace.platforms.map((platform) => ({
    value: platform.id,
    label: platform.primaryAdAccountName
      ? `${platform.label} · ${platform.primaryAdAccountName}`
      : `${platform.label} · choose an account first`,
  }));

  const selectionRequiredPlatforms = workspace.platforms.filter((platform) => platform.selectionRequired);

  const selectedAccountSummary =
    workspace.selection.scope === 'business'
      ? `${workspace.selection.adAccountIds.length} connected account${workspace.selection.adAccountIds.length === 1 ? '' : 's'} across ${workspace.selection.platformIntegrationIds.length} integration${workspace.selection.platformIntegrationIds.length === 1 ? '' : 's'}`
      : workspace.selection.scope === 'integration'
        ? workspace.selectedAdAccountName || workspace.selection.scopeLabel
        : `${workspace.selection.platformIntegrationIds.length} chosen integration${workspace.selection.platformIntegrationIds.length === 1 ? '' : 's'}`;

  const replaceScopeParams = (
    nextScope: BusinessAgencyPlanningScope,
    nextPlatformIntegrationId: string | null,
    nextPlatformIntegrationIds: string[]
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('scope', nextScope);

    if (nextScope === 'integration' && nextPlatformIntegrationId) {
      params.set('platform_integration_id', nextPlatformIntegrationId);
      params.delete('platform_integration_ids');
    } else if (nextScope === 'selected_integrations') {
      if (nextPlatformIntegrationIds.length > 0) {
        params.set('platform_integration_ids', nextPlatformIntegrationIds.join(','));
      } else {
        params.delete('platform_integration_ids');
      }
      params.delete('platform_integration_id');
    } else {
      params.delete('platform_integration_id');
      params.delete('platform_integration_ids');
    }

    const nextQuery = params.toString();
    startTransition(() => {
      router.replace(nextQuery ? `/agency?${nextQuery}` : '/agency');
    });
  };

  const handleScopeChange = (value: string | null) => {
    const nextScope = (value || 'business') as BusinessAgencyPlanningScope;
    setScope(nextScope);

    if (nextScope === 'integration') {
      const nextPlatform = platformIntegrationId || workspace.platforms[0]?.id || null;
      setPlatformIntegrationId(nextPlatform);
      setSelectedPlatformIntegrationIds(nextPlatform ? [nextPlatform] : []);
      replaceScopeParams(nextScope, nextPlatform, []);
      return;
    }

    if (nextScope === 'selected_integrations') {
      const nextIds =
        selectedPlatformIntegrationIds.length > 0
          ? selectedPlatformIntegrationIds
          : workspace.selection.platformIntegrationIds.slice(0, 2);
      setSelectedPlatformIntegrationIds(nextIds);
      replaceScopeParams(nextScope, null, nextIds);
      return;
    }

    setPlatformIntegrationId(null);
    setSelectedPlatformIntegrationIds([]);
    replaceScopeParams(nextScope, null, []);
  };

  const handlePlatformChange = (value: string | null) => {
    setPlatformIntegrationId(value);
    replaceScopeParams('integration', value, []);
  };

  const handleMultiIntegrationChange = (values: string[]) => {
    setSelectedPlatformIntegrationIds(values);
    replaceScopeParams('selected_integrations', null, values);
  };

  const runAssessment = () => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/agency/assess', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scope: workspace.selection.scope,
            platformIntegrationId: workspace.selection.platformIntegrationId,
            platformIntegrationIds: workspace.selection.platformIntegrationIds,
          }),
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok || !body?.success) {
          throw new Error(body?.error?.userMessage || 'Failed to run assessment');
        }

        toast.success('Assessment completed');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to run assessment');
      }
    });
  };

  const selectedAssessment = workspace.latestSelectedAssessment;
  const businessAssessment = workspace.latestBusinessAssessment;
  const selectedWindow = selectedAssessment?.digest.weightedAverages.last30d ?? null;

  return (
    <Stack gap="lg">
      <Card withBorder radius="lg" p="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" mb="sm">
              <Badge color="blue" variant="light">
                Business AI Agency
              </Badge>
              <Badge color="grape" variant="light">
                {scopeCopy(workspace.selection.scope)}
              </Badge>
            </Group>
            <Title order={2}>Your AI marketing agency for {workspace.businessName}</Title>
            <Text c="dimmed" maw={760} mt="xs">
              DeepVisor screens each connected integration, builds a deterministic account profile,
              stores a business-wide synthesis, and gives you a grounded view of where each account
              stands before the next automation layer is added.
            </Text>
          </div>

          <Stack gap="xs" align="flex-end">
            <Paper withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Active scope
              </Text>
              <Text fw={700}>{workspace.selection.scopeLabel}</Text>
              <Text size="sm" c="dimmed">
                {selectedAccountSummary}
              </Text>
            </Paper>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={runAssessment}
              loading={isPending}
              disabled={workspace.selection.adAccountIds.length === 0}
            >
              Assess now
            </Button>
          </Stack>
        </Group>
      </Card>

      {selectionRequiredPlatforms.length > 0 ? (
        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Account selection
              </Text>
              <Title order={4}>A connected integration still needs a primary ad account</Title>
              <Text c="dimmed" size="sm" mt={4}>
                Finish the Meta account selection step in Integrations before assessment can run for
                that connection.
              </Text>
            </div>
            <Button variant="light" onClick={() => router.push('/integration')}>
              Open integrations
            </Button>
          </Group>
        </Card>
      ) : null}

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
        {topKpis.map((kpi) => (
          <Card key={kpi.key} withBorder radius="lg" p="lg">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              {kpi.label}
            </Text>
            <Title order={3} mt="xs">
              {kpi.formattedValue}
            </Title>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" mb="md">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Assessment scope
            </Text>
            <Title order={4}>Choose which integration view to screen</Title>
          </div>
          <Badge variant="light" color="blue">
            {workspace.selection.adAccountIds.length} account{workspace.selection.adAccountIds.length === 1 ? '' : 's'}
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <Select
            label="Scope"
            data={[
              { value: 'business', label: 'Whole business' },
              { value: 'integration', label: 'One integration' },
              { value: 'selected_integrations', label: 'Selected integrations' },
            ]}
            value={scope}
            onChange={handleScopeChange}
            disabled={isPending}
          />

          {scope === 'integration' ? (
            <Select
              label="Integration"
              data={platformOptions}
              value={platformIntegrationId}
              onChange={handlePlatformChange}
              disabled={isPending}
            />
          ) : null}

          {scope === 'selected_integrations' ? (
            <MultiSelect
              label="Integrations"
              data={platformOptions}
              value={selectedPlatformIntegrationIds}
              onChange={handleMultiIntegrationChange}
              disabled={isPending}
              searchable
              placeholder="Choose one or more integrations"
            />
          ) : null}
        </SimpleGrid>
      </Card>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Assessment
              </Text>
              <Title order={4}>Selected integration profile</Title>
            </div>
            {selectedAssessment ? (
              <Badge color={stateColor(selectedAssessment.state)} variant="light">
                {selectedAssessment.state.replaceAll('_', ' ')}
              </Badge>
            ) : (
              <Badge color="yellow" variant="light">
                Needs assessment
              </Badge>
            )}
          </Group>

          {selectedAssessment ? (
            <Stack gap="sm">
              <Text>{selectedAssessment.assessment.summary}</Text>

              <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Spend level
                  </Text>
                  <Text fw={700}>{selectedAssessment.digest.spendLevel}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Tracking
                  </Text>
                  <Text fw={700}>{selectedAssessment.trackingConfidence}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Maturity
                  </Text>
                  <Text fw={700}>{selectedAssessment.maturityScore}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Freshness
                  </Text>
                  <Text fw={700}>{selectedAssessment.digest.creativeFreshness}</Text>
                </Paper>
              </SimpleGrid>

              <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    History days
                  </Text>
                  <Text fw={700}>
                    {selectedAssessment.digest.historyWindowAvailable.historyDays.toLocaleString()}
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    30d spend
                  </Text>
                  <Text fw={700}>{formatCurrency(selectedWindow?.spend ?? 0)}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    30d results
                  </Text>
                  <Text fw={700}>{(selectedWindow?.conversion ?? 0).toLocaleString()}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    30d CTR
                  </Text>
                  <Text fw={700}>{formatPercent(selectedWindow?.ctr ?? 0)}</Text>
                </Paper>
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Paper withBorder radius="md" p="md">
                  <Text size="sm" fw={700} mb="xs">
                    Strengths
                  </Text>
                  {renderSimpleList(selectedAssessment.assessment.strengths)}
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text size="sm" fw={700} mb="xs">
                    Risks
                  </Text>
                  {renderSimpleList(selectedAssessment.assessment.risks)}
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text size="sm" fw={700} mb="xs">
                    Next steps
                  </Text>
                  {renderSimpleList(selectedAssessment.assessment.nextSteps)}
                </Paper>
              </SimpleGrid>

              <Text size="sm" c="dimmed">
                Last assessed {new Date(selectedAssessment.createdAt).toLocaleString()}
              </Text>
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">
              Run an assessment first. DeepVisor will classify the account, compute account-relative
              winners and losers, and store the profile that later AI workflow steps will use.
            </Text>
          )}
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Business synthesis
              </Text>
              <Title order={4}>Cross-account business view</Title>
            </div>
            {businessAssessment ? (
              <Badge color="grape" variant="light">
                {businessAssessment.digest.primaryPlanningFlow}
              </Badge>
            ) : null}
          </Group>

          {businessAssessment ? (
            <Stack gap="sm">
              <Text>{businessAssessment.assessment.summary}</Text>
              <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Assessed
                  </Text>
                  <Text fw={700}>{businessAssessment.digest.assessedAccountCount}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    30d spend
                  </Text>
                  <Text fw={700}>{formatCurrency(businessAssessment.digest.totalSpendLast30d)}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    30d results
                  </Text>
                  <Text fw={700}>{businessAssessment.digest.totalConversionLast30d}</Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Fragmentation
                  </Text>
                  <Text fw={700}>{businessAssessment.digest.fragmentationRisk}</Text>
                </Paper>
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Paper withBorder radius="md" p="md">
                  <Text size="sm" fw={700} mb="xs">
                    Strengths
                  </Text>
                  {renderSimpleList(businessAssessment.assessment.strengths)}
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text size="sm" fw={700} mb="xs">
                    Risks
                  </Text>
                  {renderSimpleList(businessAssessment.assessment.risks)}
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text size="sm" fw={700} mb="xs">
                    Next steps
                  </Text>
                  {renderSimpleList(businessAssessment.assessment.nextSteps)}
                </Paper>
              </SimpleGrid>
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">
              Business-wide synthesis appears after the connected accounts have been assessed.
            </Text>
          )}
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Account coverage
              </Text>
              <Title order={4}>Latest screened accounts</Title>
            </div>
            <Badge variant="light" color="blue">
              {workspace.latestAccountAssessments.length}
            </Badge>
          </Group>

          {workspace.latestAccountAssessments.length === 0 ? (
            <Text size="sm" c="dimmed">
              No ad accounts have been assessed yet.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Integration</Table.Th>
                    <Table.Th>Account</Table.Th>
                    <Table.Th>State</Table.Th>
                    <Table.Th>Tracking</Table.Th>
                    <Table.Th ta="right">30d spend</Table.Th>
                    <Table.Th ta="right">30d results</Table.Th>
                    <Table.Th>Assessed</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {workspace.latestAccountAssessments.map((assessment) => {
                    const account = adAccountById.get(assessment.adAccountId);
                    return (
                      <Table.Tr key={assessment.id}>
                        <Table.Td>{account?.platformLabel ?? 'Unknown'}</Table.Td>
                        <Table.Td>{account?.name || account?.externalAccountId || assessment.adAccountId}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={stateColor(assessment.state)}>
                            {assessment.state.replaceAll('_', ' ')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={trackingColor(assessment.trackingConfidence)}>
                            {assessment.trackingConfidence}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          {formatCurrency(assessment.digest.weightedAverages.last30d.spend)}
                        </Table.Td>
                        <Table.Td ta="right">
                          {assessment.digest.weightedAverages.last30d.conversion.toLocaleString()}
                        </Table.Td>
                        <Table.Td>{new Date(assessment.createdAt).toLocaleString()}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Overview
              </Text>
              <Title order={4}>Current top campaigns</Title>
            </div>
            <Badge variant="light" color="grape">
              {workspace.overview.topCampaigns.length}
            </Badge>
          </Group>

          {workspace.overview.topCampaigns.length === 0 ? (
            <Text size="sm" c="dimmed">
              No top campaign data is available for the current scope yet.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={520}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Campaign</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Spend</Table.Th>
                    <Table.Th ta="right">Results</Table.Th>
                    <Table.Th ta="right">CTR</Table.Th>
                    <Table.Th ta="right">Cost / Result</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {workspace.overview.topCampaigns.map((campaign) => (
                    <Table.Tr key={campaign.id}>
                      <Table.Td>{campaign.name}</Table.Td>
                      <Table.Td>{campaign.status}</Table.Td>
                      <Table.Td ta="right">{formatCurrency(campaign.spend)}</Table.Td>
                      <Table.Td ta="right">{campaign.conversion.toLocaleString()}</Table.Td>
                      <Table.Td ta="right">{formatPercent(campaign.ctr)}</Table.Td>
                      <Table.Td ta="right">
                        {campaign.conversion > 0 ? formatCurrency(campaign.costPerResult) : '-'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>
      </SimpleGrid>

      {selectedAssessment ? (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          <BreakdownTable
            title="Top campaigns vs account average"
            items={selectedAssessment.digest.topCampaigns}
            emptyCopy="No top campaigns have been identified yet for this account."
          />
          <BreakdownTable
            title="Top ad sets vs account average"
            items={selectedAssessment.digest.topAdSets}
            emptyCopy="No top ad sets have been identified yet for this account."
          />
          <BreakdownTable
            title="Bottom campaigns vs account average"
            items={selectedAssessment.digest.bottomCampaigns}
            emptyCopy="No weak campaigns have been identified yet for this account."
          />

          <Card withBorder radius="lg" p="lg">
            <Group justify="space-between" mb="md">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Signals
                </Text>
                <Title order={4}>Objective mix and recent activity</Title>
              </div>
              <Group gap="xs">
                <IconClock size={16} />
                <Text size="sm" c="dimmed">
                  {new Date(selectedAssessment.createdAt).toLocaleDateString()}
                </Text>
              </Group>
            </Group>

            <Stack gap="md">
              <Paper withBorder radius="md" p="md">
                <Text size="sm" fw={700} mb="xs">
                  Objective mix
                </Text>
                {selectedAssessment.digest.objectiveMix.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No objective mix is available yet.
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {selectedAssessment.digest.objectiveMix.map((item) => (
                      <Group key={item.objective} justify="space-between">
                        <div>
                          <Text size="sm" fw={600}>
                            {item.objective}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {item.campaigns} campaign{item.campaigns === 1 ? '' : 's'}
                          </Text>
                        </div>
                        <Text size="sm">{Math.round(item.shareOfSpend * 100)}% of spend</Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Paper withBorder radius="md" p="md">
                <Text size="sm" fw={700} mb="xs">
                  Recent activity
                </Text>
                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      7d spend
                    </Text>
                    <Text fw={700}>{formatCurrency(selectedAssessment.digest.recentActivity.spendLast7d)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      7d active days
                    </Text>
                    <Text fw={700}>{selectedAssessment.digest.recentActivity.activeDaysLast7d}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      30d spend
                    </Text>
                    <Text fw={700}>{formatCurrency(selectedAssessment.digest.recentActivity.spendLast30d)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      30d active days
                    </Text>
                    <Text fw={700}>{selectedAssessment.digest.recentActivity.activeDaysLast30d}</Text>
                  </div>
                </SimpleGrid>
              </Paper>

              <Paper withBorder radius="md" p="md">
                <Text size="sm" fw={700} mb="xs">
                  Conversion quality
                </Text>
                <Group gap="xs" mb="xs">
                  <Badge variant="light" color={trackingColor(selectedAssessment.trackingConfidence)}>
                    {selectedAssessment.digest.conversionSignalQuality.label}
                  </Badge>
                  <Badge variant="light" color={trackingColor(selectedAssessment.trackingConfidence)}>
                    tracking {selectedAssessment.trackingConfidence}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {selectedAssessment.digest.conversionSignalQuality.conversions30d.toLocaleString()} results from{' '}
                  {selectedAssessment.digest.conversionSignalQuality.linkClicks30d.toLocaleString()} link clicks in the last 30 days.
                </Text>
              </Paper>
            </Stack>
          </Card>
        </SimpleGrid>
      ) : null}

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" mb="md">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Scope health
            </Text>
            <Title order={4}>Selected view snapshot</Title>
          </div>
          <Badge color="blue" variant="light">
            {workspace.selection.scopeLabel}
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <Paper withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Connected accounts
            </Text>
            <Title order={3}>{workspace.selection.adAccountIds.length}</Title>
          </Paper>
          <Paper withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Series points
            </Text>
            <Title order={3}>{workspace.overview.series.length}</Title>
          </Paper>
          <Paper withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Top campaigns
            </Text>
            <Title order={3}>{workspace.overview.topCampaigns.length}</Title>
          </Paper>
          <Paper withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Last assessment
            </Text>
            <Title order={3}>
              {selectedAssessment ? new Date(selectedAssessment.createdAt).toLocaleDateString() : 'Not yet'}
            </Title>
          </Paper>
        </SimpleGrid>
      </Card>
    </Stack>
  );
}
