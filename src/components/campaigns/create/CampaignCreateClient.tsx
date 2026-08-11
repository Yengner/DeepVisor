'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconRefresh, IconSelector } from '@tabler/icons-react';
import type { MetaPage } from '@/lib/server/actions/meta/pages/actions';
import type { CampaignTreeAdsetNode, CampaignTreeNode } from '@/lib/server/data';
import type { ManualCampaignDraftForm } from '@/lib/shared/types/campaignDrafts';
import type { ConfiguredWhatsAppNumber } from '@/lib/shared/types/whatsappSetup';

const ManualMetaAdBuilder = dynamic(
  () => import('@/components/campaigns/create/platforms/meta/builders/ManualMetaAdBuilder'),
  { loading: () => <CampaignCreateSkeleton /> }
);
const ManualMetaAdSetBuilder = dynamic(
  () => import('@/components/campaigns/create/platforms/meta/builders/ManualMetaAdSetBuilder'),
  { loading: () => <CampaignCreateSkeleton /> }
);
const MetaLeadCampaignDraftHelper = dynamic(
  () => import('@/components/campaigns/create/platforms/meta/builders/MetaLeadCampaignDraftHelper'),
  { loading: () => <CampaignCreateSkeleton /> }
);
const ManualMetaAdStarter = dynamic(
  () => import('@/components/campaigns/create/platforms/meta/components/ManualMetaAdStarter'),
  { loading: () => <CampaignCreateSkeleton /> }
);
const ManualMetaAdSetStarter = dynamic(
  () => import('@/components/campaigns/create/platforms/meta/components/ManualMetaAdSetStarter'),
  { loading: () => <CampaignCreateSkeleton /> }
);

type CreateScope = 'campaign' | 'adset' | 'ad';

type PlatformData = {
  id: string;
  platform_name: string;
};

type CampaignCreateReadyContext = {
  state: 'ready';
  createScope: CreateScope;
  requestedCampaignId: string | null;
  requestedAdSetId: string | null;
  requestedDraftId: string | null;
  platformData: PlatformData;
  adAccountId: string;
  currencyCode: string | null;
  campaigns: CampaignTreeNode[];
  draft: ManualCampaignDraftForm | null;
  metaPages: MetaPage[];
  pagesError: string | null;
  configuredWhatsAppNumbers: ConfiguredWhatsAppNumber[];
};

type CampaignCreateMessageContext = {
  state: 'needs_selection' | 'invalid_selection';
  createScope: CreateScope;
  message: string;
};

type CampaignCreateContext = CampaignCreateReadyContext | CampaignCreateMessageContext;

type CampaignCreateContextResponse =
  | {
      success: true;
      data: CampaignCreateContext;
    }
  | {
      success: false;
      error?: {
        userMessage?: string;
        message?: string;
      };
    };

function EmptyState({
  title,
  message,
  iconColor = 'signal',
  action,
}: {
  title: string;
  message: string;
  iconColor?: string;
  action?: { label: string; href: string };
}) {
  return (
    <Container size="sm" py="xl">
      <Card withBorder radius="md" p="xl">
        <Stack gap="md" align="center" ta="center">
          <ThemeIcon size={46} radius="xl" color={iconColor} variant="light">
            <IconSelector size={22} />
          </ThemeIcon>
          <Stack gap={4}>
            <Title order={3}>{title}</Title>
            <Text c="dimmed">{message}</Text>
          </Stack>
          {action ? (
            <Button component="a" href={action.href}>
              {action.label}
            </Button>
          ) : null}
        </Stack>
      </Card>
    </Container>
  );
}

function CampaignCreateSkeleton() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Card withBorder radius="md" p="xl">
          <Stack gap="md">
            <Skeleton height={18} width={150} radius="md" />
            <Skeleton height={34} width="45%" radius="md" />
            <Skeleton height={16} width="70%" radius="md" />
          </Stack>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} withBorder radius="md" p="lg">
              <Stack gap="sm">
                <Skeleton height={38} width={38} radius="xl" />
                <Skeleton height={18} width="60%" radius="md" />
                <Skeleton height={14} width="85%" radius="md" />
                <Skeleton height={14} width="70%" radius="md" />
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" p="xl">
          <Stack gap="md">
            <Group justify="space-between">
              <Skeleton height={26} width={210} radius="md" />
              <Skeleton height={36} width={150} radius="xl" />
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Skeleton height={230} radius="lg" />
              <Skeleton height={230} radius="lg" />
            </SimpleGrid>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

function findSelectedCampaign(
  context: CampaignCreateReadyContext
): CampaignTreeNode | null {
  if (context.createScope === 'ad' && context.requestedAdSetId) {
    const campaignWithSelectedAdSet =
      context.campaigns.find((campaign) =>
        campaign.adset_metrics.some((adSet) => adSet.id === context.requestedAdSetId)
      ) ?? null;

    if (campaignWithSelectedAdSet) {
      return campaignWithSelectedAdSet;
    }
  }

  if (context.requestedCampaignId) {
    return context.campaigns.find((campaign) => campaign.id === context.requestedCampaignId) ?? null;
  }

  return null;
}

function findSelectedAdSet(
  campaign: CampaignTreeNode | null,
  adSetId: string | null
): CampaignTreeAdsetNode | null {
  if (!campaign || !adSetId) {
    return null;
  }

  return campaign.adset_metrics.find((adSet) => adSet.id === adSetId) ?? null;
}

function CampaignCreateRenderer({ context }: { context: CampaignCreateReadyContext }) {
  const selectedCampaign = useMemo(() => findSelectedCampaign(context), [context]);
  const selectedAdSet = useMemo(
    () => findSelectedAdSet(selectedCampaign, context.requestedAdSetId),
    [context.requestedAdSetId, selectedCampaign]
  );

  if (context.createScope === 'adset') {
    if (context.campaigns.length === 0) {
      return (
        <EmptyState
          title="No campaigns found yet"
          message="Create at least one Meta campaign before adding a new ad set inside it."
          action={{ label: 'Create a campaign', href: '/campaigns/create' }}
        />
      );
    }

    if (!selectedCampaign) {
      return (
        <ManualMetaAdSetStarter
          campaigns={context.campaigns}
          initialCampaignId={context.requestedCampaignId}
        />
      );
    }

    return (
      <ManualMetaAdSetBuilder
        platformData={context.platformData}
        adAccountId={context.adAccountId}
        existingCampaign={selectedCampaign}
      />
    );
  }

  if (context.createScope === 'ad') {
    if (context.campaigns.length === 0) {
      return (
        <EmptyState
          title="No campaigns found yet"
          message="Create at least one Meta campaign and ad set before adding a new ad inside it."
          action={{ label: 'Create a campaign', href: '/campaigns/create' }}
        />
      );
    }

    const adSetCount = context.campaigns.reduce(
      (total, campaign) => total + campaign.adset_metrics.length,
      0
    );

    if (adSetCount === 0) {
      return (
        <EmptyState
          title="No ad sets found yet"
          message="Create at least one Meta ad set before adding a new ad inside it."
          action={{
            label: 'Create an ad set',
            href: `/campaigns/create?scope=adset&campaign_id=${context.campaigns[0]?.id ?? ''}`,
          }}
        />
      );
    }

    if (!selectedCampaign || !selectedAdSet) {
      return (
        <ManualMetaAdStarter
          campaigns={context.campaigns}
          initialCampaignId={context.requestedCampaignId}
          initialAdSetId={context.requestedAdSetId}
        />
      );
    }

    return (
      <ManualMetaAdBuilder
        platformData={context.platformData}
        adAccountId={context.adAccountId}
        existingCampaign={selectedCampaign}
        existingAdSet={selectedAdSet}
      />
    );
  }

  return (
    <MetaLeadCampaignDraftHelper
      platformData={context.platformData}
      adAccountId={context.adAccountId}
      currencyCode={context.currencyCode}
      campaigns={context.campaigns}
      draft={context.draft}
      draftId={context.requestedDraftId}
      metaPages={context.metaPages}
      pagesError={context.pagesError}
      configuredWhatsAppNumbers={context.configuredWhatsAppNumbers}
    />
  );
}

export default function CampaignCreateClient() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [context, setContext] = useState<CampaignCreateContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContext() {
      setLoading(true);
      setError(null);
      setContext(null);

      try {
        const url = queryString
          ? `/api/campaigns/create-context?${queryString}`
          : '/api/campaigns/create-context';
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as CampaignCreateContextResponse;

        if (!response.ok || !body.success) {
          throw new Error(
            !body.success
              ? body.error?.userMessage || body.error?.message || 'Failed to load campaign builder.'
              : 'Failed to load campaign builder.'
          );
        }

        setContext(body.data);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load campaign builder.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      controller.abort();
    };
  }, [queryString, retryKey]);

  if (loading) {
    return <CampaignCreateSkeleton />;
  }

  if (error) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" radius="md" icon={<IconAlertCircle size={18} />}>
          <Stack gap="sm">
            <Text fw={800}>Campaign builder could not load</Text>
            <Text size="sm">{error}</Text>
            <Button
              w="fit-content"
              variant="light"
              color="red"
              leftSection={<IconRefresh size={16} />}
              onClick={() => setRetryKey((current) => current + 1)}
            >
              Retry
            </Button>
          </Stack>
        </Alert>
      </Container>
    );
  }

  if (!context) {
    return null;
  }

  if (context.state === 'needs_selection') {
    return (
      <EmptyState
        title="Select an ad account first"
        message={context.message}
        action={{ label: 'Open connections', href: '/integration' }}
      />
    );
  }

  if (context.state === 'invalid_selection') {
    return (
      <EmptyState
        title="Ad account unavailable"
        message={context.message}
        iconColor="red"
        action={{ label: 'Review connections', href: '/integration' }}
      />
    );
  }

  if (context.state !== 'ready') {
    return null;
  }

  return <CampaignCreateRenderer context={context} />;
}
