'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, MultiSelect, Select, Stack, Text } from '@mantine/core';
import type { ReportFilterOptions, ReportQueryInput } from '@/lib/server/reports/types';

interface ReportsSidebarProps {
  query: ReportQueryInput;
  filterOptions: ReportFilterOptions;
  onUpdate: (mutate: (params: URLSearchParams) => void) => void;
}

export default function ReportsSidebar({
  query,
  filterOptions,
  onUpdate,
}: ReportsSidebarProps) {
  const [draftPlatformIntegrationId, setDraftPlatformIntegrationId] = useState<string | null>(
    query.platformIntegrationId ?? null
  );
  const [draftAdAccountIds, setDraftAdAccountIds] = useState<string[]>(query.adAccountIds);
  const [draftCampaignIds, setDraftCampaignIds] = useState<string[]>(query.campaignIds);
  const [draftAdsetIds, setDraftAdsetIds] = useState<string[]>(query.adsetIds);
  const [draftAdIds, setDraftAdIds] = useState<string[]>(query.adIds);

  useEffect(() => {
    setDraftPlatformIntegrationId(query.platformIntegrationId ?? null);
    setDraftAdAccountIds(query.adAccountIds);
    setDraftCampaignIds(query.campaignIds);
    setDraftAdsetIds(query.adsetIds);
    setDraftAdIds(query.adIds);
  }, [
    query.adAccountIds,
    query.adIds,
    query.adsetIds,
    query.campaignIds,
    query.platformIntegrationId,
  ]);

  const adAccountOptions = useMemo(
    () =>
      filterOptions.adAccounts.filter((option) =>
        !draftPlatformIntegrationId || option.parentId === draftPlatformIntegrationId
      ),
    [draftPlatformIntegrationId, filterOptions.adAccounts]
  );
  const campaignOptions = useMemo(
    () =>
      filterOptions.campaigns.filter((option) =>
        draftAdAccountIds.length === 0 || draftAdAccountIds.includes(option.parentId || '')
      ),
    [draftAdAccountIds, filterOptions.campaigns]
  );
  const adsetOptions = useMemo(
    () =>
      filterOptions.adsets.filter((option) =>
        draftCampaignIds.length === 0 || draftCampaignIds.includes(option.parentId || '')
      ),
    [draftCampaignIds, filterOptions.adsets]
  );
  const adOptions = useMemo(
    () =>
      filterOptions.ads.filter((option) =>
        draftAdsetIds.length === 0 || draftAdsetIds.includes(option.parentId || '')
      ),
    [draftAdsetIds, filterOptions.ads]
  );

  return (
    <Card withBorder radius="lg" p="md" h="fit-content">
      <Stack gap="md">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Filters
          </Text>
          <Text fw={700}>Reporting scope</Text>
        </div>

        <Select
          label="Platform"
          placeholder="All platforms"
          searchable
          clearable
          value={draftPlatformIntegrationId}
          data={filterOptions.platforms.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            setDraftPlatformIntegrationId(value);
            setDraftAdAccountIds([]);
            setDraftCampaignIds([]);
            setDraftAdsetIds([]);
            setDraftAdIds([]);
          }}
        />

        <MultiSelect
          label="Ad accounts"
          placeholder="All ad accounts"
          searchable
          value={draftAdAccountIds}
          data={adAccountOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            setDraftAdAccountIds(value);
            setDraftCampaignIds([]);
            setDraftAdsetIds([]);
            setDraftAdIds([]);
          }}
        />

        <MultiSelect
          label="Campaigns"
          placeholder="All campaigns"
          searchable
          value={draftCampaignIds}
          data={campaignOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            setDraftCampaignIds(value);
            setDraftAdsetIds([]);
            setDraftAdIds([]);
          }}
        />

        <MultiSelect
          label="Ad sets"
          placeholder="All ad sets"
          searchable
          value={draftAdsetIds}
          data={adsetOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            setDraftAdsetIds(value);
            setDraftAdIds([]);
          }}
        />

        <MultiSelect
          label="Ads"
          placeholder="All ads"
          searchable
          value={draftAdIds}
          data={adOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={setDraftAdIds}
        />

        <Group justify="space-between" gap="sm" mt="xs">
          <Button
            variant="default"
            radius="xl"
            onClick={() => {
              setDraftPlatformIntegrationId(null);
              setDraftAdAccountIds([]);
              setDraftCampaignIds([]);
              setDraftAdsetIds([]);
              setDraftAdIds([]);
            }}
          >
            Clear
          </Button>
          <Button
            radius="xl"
            onClick={() => {
              onUpdate((params) => {
                if (draftPlatformIntegrationId) {
                  params.set('platform_integration_id', draftPlatformIntegrationId);
                } else {
                  params.delete('platform_integration_id');
                }

                if (draftAdAccountIds.length > 0) {
                  params.set('ad_account_id', draftAdAccountIds.join(','));
                } else {
                  params.delete('ad_account_id');
                }

                if (draftCampaignIds.length > 0) {
                  params.set('campaign_id', draftCampaignIds.join(','));
                } else {
                  params.delete('campaign_id');
                }

                if (draftAdsetIds.length > 0) {
                  params.set('adset_id', draftAdsetIds.join(','));
                } else {
                  params.delete('adset_id');
                }

                if (draftAdIds.length > 0) {
                  params.set('ad_id', draftAdIds.join(','));
                } else {
                  params.delete('ad_id');
                }
              });
            }}
          >
            Apply filters
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
