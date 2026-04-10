import 'server-only';

import { getTrailingUtcDateRange, uniqueStrings } from '@/lib/shared';
import { createServerClient } from '@/lib/server/supabase/server';
import { buildReportPayload } from '@/lib/server/repositories/reports/buildReportPayload';
import type { ReportQueryInput } from '@/lib/server/reports/types';
import type {
  AdAccountAssessment,
  AgencyTopCampaign,
  BusinessAgencyAdAccountSummary,
  BusinessAgencyOverview,
  BusinessAgencyPlanningScope,
  BusinessAgencyPlatformSummary,
  BusinessAgencySelection,
  BusinessAgencyWorkspace,
  GlobalAiAssistantPayload,
} from './types';
import {
  getLatestBusinessAssessment as getLatestBusinessAssessmentRecord,
  listLatestAdAccountAssessmentsForBusiness,
} from './repositories/assessments';
import {
  runBusinessAssessment,
  runMetaAdAccountAssessment,
} from './assessments/service';

type AppSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

type BusinessProfileRow = {
  business_name: string | null;
};

type PlatformIntegrationRow = {
  id: string;
  platform_id: string;
  status: string;
  created_at: string;
  integration_details: Record<string, unknown> | null;
  platforms: { key: string; name: string } | { key: string; name: string }[] | null;
};

type AdAccountRow = {
  id: string;
  name: string | null;
  status: string | null;
  external_account_id: string;
  last_synced: string | null;
  platform_id: string;
  created_at: string | null;
};

type WorkspaceSelectionInput = {
  scope?: BusinessAgencyPlanningScope | null;
  platformIntegrationId?: string | null;
  platformIntegrationIds?: string[];
  defaultPlatformIntegrationId?: string | null;
  defaultAdAccountId?: string | null;
};

function getPlatformLabel(value: PlatformIntegrationRow['platforms'], fallback: string) {
  const record = Array.isArray(value) ? value[0] : value;
  return record?.name ?? record?.key ?? fallback;
}

function getPrimaryExternalAccountId(details: Record<string, unknown> | null | undefined) {
  return typeof details?.primary_ad_account_external_id === 'string'
    ? details.primary_ad_account_external_id
    : null;
}

function formatScopeLabel(
  scope: BusinessAgencyPlanningScope,
  platforms: BusinessAgencyPlatformSummary[],
  platformIntegrationId: string | null,
  platformIntegrationIds: string[]
): string {
  if (scope === 'integration' && platformIntegrationId) {
    return platforms.find((platform) => platform.id === platformIntegrationId)?.label ?? 'Integration';
  }

  if (scope === 'selected_integrations') {
    return `${platformIntegrationIds.length} selected integration${platformIntegrationIds.length === 1 ? '' : 's'}`;
  }

  return 'Business';
}

async function loadBusinessHeader(
  supabase: AppSupabaseClient,
  businessId: string
): Promise<{
  businessName: string;
  platforms: BusinessAgencyPlatformSummary[];
  adAccounts: BusinessAgencyAdAccountSummary[];
}> {
  const [{ data: business }, { data: integrations, error: integrationsError }, { data: adAccounts, error: adAccountsError }] =
    await Promise.all([
      supabase
        .from('business_profiles')
        .select('business_name')
        .eq('id', businessId)
        .single(),
      supabase
        .from('platform_integrations')
        .select('id, platform_id, status, created_at, integration_details, platforms(key, name)')
        .eq('business_id', businessId)
        .eq('status', 'connected')
        .order('created_at', { ascending: true }),
      supabase
        .from('ad_accounts')
        .select('id, name, status, external_account_id, last_synced, platform_id, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true }),
    ]);

  if (integrationsError) {
    throw integrationsError;
  }

  if (adAccountsError) {
    throw adAccountsError;
  }

  const accountsByPlatformId = new Map<string, AdAccountRow[]>();
  for (const account of (adAccounts ?? []) as AdAccountRow[]) {
    const current = accountsByPlatformId.get(account.platform_id) ?? [];
    current.push(account);
    accountsByPlatformId.set(account.platform_id, current);
  }

  const mappedPlatforms: BusinessAgencyPlatformSummary[] = [];
  const mappedAdAccounts: BusinessAgencyAdAccountSummary[] = [];

  for (const integration of (integrations ?? []) as PlatformIntegrationRow[]) {
    const candidates = accountsByPlatformId.get(integration.platform_id) ?? [];
    const primaryExternalAccountId = getPrimaryExternalAccountId(integration.integration_details);
    const selectedAccount =
      (primaryExternalAccountId
        ? candidates.find((account) => account.external_account_id === primaryExternalAccountId)
        : null) ??
      (candidates.length === 1 ? candidates[0] : null);
    const label = getPlatformLabel(integration.platforms, integration.platform_id);

    mappedPlatforms.push({
      id: integration.id,
      platformId: integration.platform_id,
      label,
      status: integration.status,
      adAccountCount: selectedAccount ? 1 : 0,
      primaryAdAccountId: selectedAccount?.id ?? null,
      primaryAdAccountExternalId: selectedAccount?.external_account_id ?? primaryExternalAccountId,
      primaryAdAccountName: selectedAccount?.name ?? null,
      selectionRequired: !primaryExternalAccountId,
    });

    if (!selectedAccount) {
      continue;
    }

    mappedAdAccounts.push({
      id: selectedAccount.id,
      name: selectedAccount.name,
      status: selectedAccount.status,
      externalAccountId: selectedAccount.external_account_id,
      lastSynced: selectedAccount.last_synced,
      platformId: selectedAccount.platform_id,
      platformIntegrationId: integration.id,
      platformLabel: label,
    });
  }

  return {
    businessName: (business as BusinessProfileRow | null)?.business_name ?? 'My Business',
    platforms: mappedPlatforms,
    adAccounts: mappedAdAccounts,
  };
}

function normalizeAgencySelection(input: {
  scope?: BusinessAgencyPlanningScope | null;
  platformIntegrationId?: string | null;
  platformIntegrationIds?: string[];
  defaultPlatformIntegrationId?: string | null;
  defaultAdAccountId?: string | null;
  platforms: BusinessAgencyPlatformSummary[];
  adAccounts: BusinessAgencyAdAccountSummary[];
}): BusinessAgencySelection {
  if (input.adAccounts.length === 0) {
    return {
      scope: 'business',
      scopeLabel: 'Business',
      platformIntegrationId: null,
      platformIntegrationIds: [],
      adAccountIds: [],
      primaryAdAccountId: null,
    };
  }

  const platformById = new Map(input.platforms.map((platform) => [platform.id, platform]));
  const adAccountById = new Map(input.adAccounts.map((account) => [account.id, account]));
  const defaultAccount =
    (input.defaultAdAccountId ? adAccountById.get(input.defaultAdAccountId) ?? null : null) ??
    input.adAccounts[0] ??
    null;
  const defaultPlatformId =
    (input.defaultPlatformIntegrationId &&
    platformById.has(input.defaultPlatformIntegrationId) &&
    (platformById.get(input.defaultPlatformIntegrationId)?.primaryAdAccountId ?? null)
      ? input.defaultPlatformIntegrationId
      : null) ??
    defaultAccount?.platformIntegrationId ??
    input.platforms.find((platform) => platform.primaryAdAccountId)?.id ??
    null;

  const requestedScope =
    input.scope ?? (input.platforms.filter((platform) => platform.primaryAdAccountId).length === 1 ? 'integration' : 'business');

  if (requestedScope === 'integration') {
    const platformIntegrationId = input.platformIntegrationId ?? defaultPlatformId;
    const platform = platformIntegrationId ? platformById.get(platformIntegrationId) ?? null : null;

    if (!platform?.primaryAdAccountId) {
      return normalizeAgencySelection({
        ...input,
        scope: 'business',
      });
    }

    return {
      scope: 'integration',
      scopeLabel: formatScopeLabel('integration', input.platforms, platform.id, [platform.id]),
      platformIntegrationId: platform.id,
      platformIntegrationIds: [platform.id],
      adAccountIds: [platform.primaryAdAccountId],
      primaryAdAccountId: platform.primaryAdAccountId,
    };
  }

  if (requestedScope === 'selected_integrations') {
    const requestedPlatformIds = uniqueStrings(
      input.platformIntegrationIds ?? [input.platformIntegrationId ?? null]
    ).filter((id) => Boolean(platformById.get(id)?.primaryAdAccountId));

    const platformIntegrationIds =
      requestedPlatformIds.length > 0
        ? requestedPlatformIds
        : defaultPlatformId
          ? [defaultPlatformId]
          : [];

    if (platformIntegrationIds.length <= 1) {
      return normalizeAgencySelection({
        ...input,
        scope: 'integration',
        platformIntegrationId: platformIntegrationIds[0] ?? defaultPlatformId,
      });
    }

    const adAccountIds = platformIntegrationIds
      .map((id) => platformById.get(id)?.primaryAdAccountId ?? null)
      .filter((value): value is string => Boolean(value));

    return {
      scope: 'selected_integrations',
      scopeLabel: formatScopeLabel(
        'selected_integrations',
        input.platforms,
        null,
        platformIntegrationIds
      ),
      platformIntegrationId: null,
      platformIntegrationIds,
      adAccountIds,
      primaryAdAccountId: adAccountIds[0] ?? null,
    };
  }

  const allPlatformIntegrationIds = input.platforms
    .filter((platform) => Boolean(platform.primaryAdAccountId))
    .map((platform) => platform.id);
  const allAdAccountIds = input.adAccounts.map((account) => account.id);

  return {
    scope: 'business',
    scopeLabel: 'Business',
    platformIntegrationId: null,
    platformIntegrationIds: allPlatformIntegrationIds,
    adAccountIds: allAdAccountIds,
    primaryAdAccountId: defaultAccount?.id ?? null,
  };
}

function buildReportQuery(input: {
  businessId: string;
  selection: BusinessAgencySelection;
}): ReportQueryInput {
  const { dateFrom, dateTo } = getTrailingUtcDateRange(30);

  return {
    businessId: input.businessId,
    scope: input.selection.scope === 'integration' ? 'platform' : 'business',
    platformIntegrationId:
      input.selection.scope === 'integration' ? input.selection.platformIntegrationId : null,
    adAccountIds: input.selection.adAccountIds,
    campaignIds: [],
    adsetIds: [],
    adIds: [],
    dateFrom,
    dateTo,
    groupBy: 'day',
    compareMode: 'none',
  };
}

async function loadAgencyOverview(input: {
  businessId: string;
  selection: BusinessAgencySelection;
}): Promise<BusinessAgencyOverview> {
  const payload = await buildReportPayload(
    buildReportQuery({
      businessId: input.businessId,
      selection: input.selection,
    })
  );

  const topCampaigns: AgencyTopCampaign[] = payload.breakdown.rows.slice(0, 5).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status ?? 'UNKNOWN',
    spend: row.spend,
    conversion: row.conversion,
    ctr: row.ctr,
    costPerResult: row.costPerResult,
  }));

  return {
    scopeLabel: input.selection.scopeLabel,
    summary: payload.summary,
    kpis: payload.kpis,
    series: payload.series,
    topCampaigns,
  };
}

function selectLatestAssessmentForSelection(
  selection: BusinessAgencySelection,
  assessments: AdAccountAssessment[]
): AdAccountAssessment | null {
  const filtered = assessments.filter((assessment) =>
    selection.adAccountIds.includes(assessment.adAccountId)
  );

  if (filtered.length === 0) {
    return null;
  }

  if (filtered.length === 1) {
    return filtered[0];
  }

  return [...filtered].sort(
    (left, right) =>
      right.digest.weightedAverages.last30d.spend - left.digest.weightedAverages.last30d.spend
  )[0] ?? null;
}

export async function buildBusinessAgencyWorkspace(
  businessId: string,
  input?: WorkspaceSelectionInput
): Promise<BusinessAgencyWorkspace> {
  const supabase = await createServerClient();
  const { businessName, platforms, adAccounts } = await loadBusinessHeader(supabase, businessId);
  const selection = normalizeAgencySelection({
    scope: input?.scope,
    platformIntegrationId: input?.platformIntegrationId,
    platformIntegrationIds: input?.platformIntegrationIds,
    defaultPlatformIntegrationId: input?.defaultPlatformIntegrationId,
    defaultAdAccountId: input?.defaultAdAccountId,
    platforms,
    adAccounts,
  });

  const [overview, latestBusinessAssessment, latestAccountAssessments] = await Promise.all([
    loadAgencyOverview({
      businessId,
      selection,
    }),
    getLatestBusinessAssessmentRecord(supabase, businessId),
    listLatestAdAccountAssessmentsForBusiness(supabase, businessId),
  ]);

  const selectedAdAccountName =
    adAccounts.find((account) => account.id === selection.primaryAdAccountId)?.name ?? null;

  return {
    businessId,
    businessName,
    platforms,
    selection,
    selectedPlatformIntegrationId: selection.platformIntegrationId,
    selectedAdAccountId: selection.primaryAdAccountId,
    selectedAdAccountName,
    adAccounts,
    overview,
    latestBusinessAssessment,
    latestAccountAssessments,
    latestSelectedAssessment: selectLatestAssessmentForSelection(selection, latestAccountAssessments),
  };
}

export async function runBusinessAgencyAssessment(input: {
  businessId: string;
  scope: BusinessAgencyPlanningScope;
  platformIntegrationId?: string | null;
  platformIntegrationIds?: string[];
  defaultAdAccountId?: string | null;
  defaultPlatformIntegrationId?: string | null;
}) {
  const supabase = await createServerClient();
  const { platforms, adAccounts } = await loadBusinessHeader(supabase, input.businessId);
  const selection = normalizeAgencySelection({
    scope: input.scope,
    platformIntegrationId: input.platformIntegrationId,
    platformIntegrationIds: input.platformIntegrationIds,
    defaultPlatformIntegrationId: input.defaultPlatformIntegrationId,
    defaultAdAccountId: input.defaultAdAccountId,
    platforms,
    adAccounts,
  });

  if (selection.adAccountIds.length === 0) {
    throw new Error('Select and sync a Meta ad account before running assessment');
  }

  const scopedAdAccounts = adAccounts.filter((account) => selection.adAccountIds.includes(account.id));
  const accountAssessments = await Promise.all(
    scopedAdAccounts.map((account) => {
      if (!account.platformIntegrationId) {
        throw new Error('Selected integration is missing primary ad account context');
      }

      return runMetaAdAccountAssessment({
        supabase,
        businessId: input.businessId,
        platformIntegrationId: account.platformIntegrationId,
        adAccountId: account.id,
        trigger: 'manual',
      });
    })
  );
  const businessAssessment = await runBusinessAssessment({
    supabase,
    businessId: input.businessId,
    trigger: 'manual',
  });

  return {
    selection,
    accountAssessments,
    businessAssessment,
  };
}

export async function buildGlobalAiAssistantPayload(input: {
  businessId: string;
  defaultPlatformIntegrationId?: string | null;
  defaultAdAccountId?: string | null;
}): Promise<GlobalAiAssistantPayload> {
  const supabase = await createServerClient();
  const { businessName, platforms, adAccounts } = await loadBusinessHeader(supabase, input.businessId);
  const selection = normalizeAgencySelection({
    scope: 'integration',
    platformIntegrationId: input.defaultPlatformIntegrationId,
    defaultPlatformIntegrationId: input.defaultPlatformIntegrationId,
    defaultAdAccountId: input.defaultAdAccountId,
    platforms,
    adAccounts,
  });

  const [latestBusinessAssessment, latestAccountAssessments] = platforms.length
    ? await Promise.all([
        getLatestBusinessAssessmentRecord(supabase, input.businessId),
        listLatestAdAccountAssessmentsForBusiness(supabase, input.businessId),
      ])
    : [null, []];

  const latestSelectedAssessment = selectLatestAssessmentForSelection(
    selection,
    latestAccountAssessments
  );
  const selectedPlatform = selection.platformIntegrationId
    ? platforms.find((platform) => platform.id === selection.platformIntegrationId) ?? null
    : null;
  const selectedAdAccount = selection.primaryAdAccountId
    ? adAccounts.find((account) => account.id === selection.primaryAdAccountId) ?? null
    : null;

  return {
    businessId: input.businessId,
    businessName,
    state:
      platforms.length === 0
        ? 'no_platform_connected'
        : selection.primaryAdAccountId
          ? latestSelectedAssessment
            ? 'ready'
            : 'needs_assessment'
          : 'no_ad_account_selected',
    selectionScope: selection.scope,
    selectedPlatformIntegrationId: selection.platformIntegrationId,
    selectedPlatformLabel: selectedPlatform?.label ?? null,
    selectedAdAccountId: selectedAdAccount?.id ?? null,
    selectedAdAccountName: selectedAdAccount?.name ?? null,
    selectedAdAccountExternalId: selectedAdAccount?.externalAccountId ?? null,
    latestBusinessAssessment,
    latestSelectedAssessment,
  };
}
