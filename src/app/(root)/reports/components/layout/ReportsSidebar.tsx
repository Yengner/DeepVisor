'use client';

import { Card, MultiSelect, Select, Stack, Text } from '@mantine/core';
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
  const adAccountOptions = filterOptions.adAccounts.filter((option) =>
    !query.platformIntegrationId || option.parentId === query.platformIntegrationId
  );
  const campaignOptions = filterOptions.campaigns.filter((option) =>
    query.adAccountIds.length === 0 || query.adAccountIds.includes(option.parentId || '')
  );
  const adsetOptions = filterOptions.adsets.filter((option) =>
    query.campaignIds.length === 0 || query.campaignIds.includes(option.parentId || '')
  );
  const adOptions = filterOptions.ads.filter((option) =>
    query.adsetIds.length === 0 || query.adsetIds.includes(option.parentId || '')
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
          value={query.platformIntegrationId}
          data={filterOptions.platforms.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            onUpdate((params) => {
              if (!value) {
                params.delete('platform_integration_id');
              } else {
                params.set('platform_integration_id', value);
              }

              params.delete('ad_account_id');
              params.delete('campaign_id');
              params.delete('adset_id');
              params.delete('ad_id');
            });
          }}
        />

        <MultiSelect
          label="Ad accounts"
          placeholder="All ad accounts"
          searchable
          value={query.adAccountIds}
          data={adAccountOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            onUpdate((params) => {
              if (value.length === 0) {
                params.delete('ad_account_id');
              } else {
                params.set('ad_account_id', value.join(','));
              }

              params.delete('campaign_id');
              params.delete('adset_id');
              params.delete('ad_id');
            });
          }}
        />

        <MultiSelect
          label="Campaigns"
          placeholder="All campaigns"
          searchable
          value={query.campaignIds}
          data={campaignOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            onUpdate((params) => {
              if (value.length === 0) {
                params.delete('campaign_id');
              } else {
                params.set('campaign_id', value.join(','));
              }

              params.delete('adset_id');
              params.delete('ad_id');
            });
          }}
        />

        <MultiSelect
          label="Ad sets"
          placeholder="All ad sets"
          searchable
          value={query.adsetIds}
          data={adsetOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            onUpdate((params) => {
              if (value.length === 0) {
                params.delete('adset_id');
              } else {
                params.set('adset_id', value.join(','));
              }

              params.delete('ad_id');
            });
          }}
        />

        <MultiSelect
          label="Ads"
          placeholder="All ads"
          searchable
          value={query.adIds}
          data={adOptions.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(value) => {
            onUpdate((params) => {
              if (value.length === 0) {
                params.delete('ad_id');
              } else {
                params.set('ad_id', value.join(','));
              }
            });
          }}
        />
      </Stack>
    </Card>
  );
}
