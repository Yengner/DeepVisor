import { createServerClient } from '@/lib/server/supabase/server';
import IntegrationClient from './components/IntegrationClient';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import type { Database } from '@/lib/shared/types/supabase';
import type { IntegrationStatus } from '@/lib/shared/types/integrations';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStatus(value: unknown): IntegrationStatus | null {
  if (value === 'connected' || value === 'disconnected' || value === 'needs_reauth' || value === 'error') {
    return value;
  }
  return null;
}

type PlatformRow = Pick<Database['public']['Tables']['platforms']['Row'], 'id' | 'key' | 'name' | 'api_info'>;
type PlatformIntegrationRow = {
  id: string;
  business_id: string;
  platform_id: string;
  status: IntegrationStatus;
  connected_at: string | null;
  disconnected_at: string | null;
  token_expires_at: string | null;
  scopes: string[];
  integration_details: unknown;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const FALLBACK_PLATFORMS: PlatformRow[] = [
  {
    id: 'meta',
    key: 'meta',
    name: 'Meta',
    api_info: {
      description: 'Connect Facebook and Instagram ad accounts.',
      full_description: 'Sync Meta campaigns, ad sets, ads, and performance metrics into DeepVisor.',
      strengths: 'Largest social reach, robust audience targeting, fast creative iteration.',
      weaknesses: 'Privacy-driven attribution shifts can reduce signal quality in some funnels.',
      image_url: '/images/platforms/meta.png',
    },
  },
  {
    id: 'google',
    key: 'google',
    name: 'Google Ads',
    api_info: {
      description: 'Search, Display, YouTube, and Performance Max coverage.',
      full_description: 'Connect Google Ads to centralize spend, conversion, and campaign reporting.',
      strengths: 'High-intent traffic and strong conversion capture across search inventory.',
      weaknesses: 'Competitive auctions can increase CPC in saturated markets.',
      image_url: '/images/platforms/google.png',
    },
  },
  {
    id: 'tiktok',
    key: 'tiktok',
    name: 'TikTok Ads',
    api_info: {
      description: 'Short-form, high-engagement video advertising platform.',
      full_description: 'Integrate TikTok Ads to compare creative velocity and social performance.',
      strengths: 'Strong engagement and discovery behavior for visual-first campaigns.',
      weaknesses: 'Creative refresh cadence is typically higher to sustain performance.',
      image_url: '/images/platforms/tiktok.png',
    },
  },
];

export default async function IntegrationPage() {
  const supabase = await createServerClient();
  const { businessId } = await getRequiredAppContext();

  const [{ data: platforms, error: platformError }, { data: integrations, error: integrationError }] =
    await Promise.all([
      supabase
        .from('platforms')
        .select('id, key, name, api_info'),
      supabase
        .from('platform_integrations')
        .select('*')
        .eq('business_id', businessId),
    ]);

  if (platformError) {
    console.error('Error fetching platforms:', platformError.message);
    return <div>Failed to load platforms</div>;
  }
  if (integrationError) {
    console.error('Error fetching platform integrations in integration page:', integrationError.message);
    return <div>Failed to load integrations</div>;
  }

  const platformRows = (platforms ?? []) as PlatformRow[];
  const availablePlatforms = platformRows.length > 0 ? platformRows : FALLBACK_PLATFORMS;

  const integrationByPlatformId = new Map<string, PlatformIntegrationRow>(
    ((integrations ?? []) as unknown as PlatformIntegrationRow[]).map((integration) => [integration.platform_id, integration])
  );

  const platformsWithIntegration = availablePlatforms.map((platform) => {
    const integration = integrationByPlatformId.get(platform.id);
    const apiInfo = asObject(platform.api_info);
    const integrationDetails = asObject(integration?.integration_details);
    const status = asStatus(integration?.status) ?? asStatus(integrationDetails.status) ?? 'disconnected';

    return {
      id: platform.id,
      platformKey: platform.key,
      platformName: platform.name,
      description: asString(apiInfo.description),
      fullDescription: asString(apiInfo.full_description),
      strengths: asString(apiInfo.strengths),
      weaknesses: asString(apiInfo.weaknesses),
      imageUrl: asString(apiInfo.image_url),
      status,
      integrationId: integration?.id ?? null,
      lastSyncedAt: integration?.last_synced_at ?? (asString(integrationDetails.last_synced_at) || null),
      lastError: integration?.last_error ?? (asString(integrationDetails.last_error) || null),
      connectedAt: integration?.connected_at ?? (asString(integrationDetails.connected_at) || null),
      disconnectedAt: integration?.disconnected_at ?? (asString(integrationDetails.disconnected_at) || null),
      updatedAt: integration?.updated_at ?? null,
    };
  });

  return <IntegrationClient platforms={platformsWithIntegration} />;
}
