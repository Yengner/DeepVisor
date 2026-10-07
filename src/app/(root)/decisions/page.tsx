import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Alert, Group, Stack, Text } from '@mantine/core';
import ProductLinkButton from '@/components/product/ProductLinkButton';
import SectionSkeleton from '@/components/product/SectionSkeleton';
import product from '@/components/product/Product.module.css';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createServerClient } from '@/lib/server/supabase/server';
import { loadDecisionSurface } from '@/lib/server/decisions/loadSurface';
import DecisionsFeed, { FindingsFeed } from './DecisionsFeed';
import classes from './Decisions.module.css';

export const metadata: Metadata = { title: 'Decisions | DeepVisor' };

function LoadingFeed() {
  return <Stack gap="md" aria-label="Loading decisions">{[0, 1, 2].map((item) => <SectionSkeleton key={item} kind="attention" />)}</Stack>;
}

async function DecisionContent({ page }: { page: number }) {
  const { businessId, role } = await getRequiredAppContext();
  const client = await createServerClient();
  let data;
  try { data = await loadDecisionSurface(client, businessId, page); }
  catch { return <Alert color="red" title="Decisions are unavailable">We could not load your saved decisions. Please try again shortly.</Alert>; }
  return <><DecisionsFeed cards={data.cards} canReview={['owner', 'admin'].includes(role)} />
    {(page > 0 || data.hasNext) && <Group justify="space-between" mt="lg">
      <ProductLinkButton href={`/decisions?page=${Math.max(0, page - 1)}`} disabled={page === 0}>Newer decisions</ProductLinkButton>
      <Text size="sm" c="dimmed">Page {page + 1}</Text>
      <ProductLinkButton href={`/decisions?page=${page + 1}`} disabled={!data.hasNext}>Older decisions</ProductLinkButton>
    </Group>}
    <FindingsFeed findings={data.findings} unavailable={data.findingsUnavailable} />
  </>;
}

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const parsed = Number(params.page ?? 0);
  const page = Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 10000 ? parsed : 0;
  return <div className={`${classes.page} ${product.page}`}>
    <header className={classes.header}><h1>Decisions</h1><Text size="sm" c="dimmed">Reviews and next steps across your business accounts.</Text></header>
    <Suspense key={page} fallback={<LoadingFeed />}><DecisionContent page={page} /></Suspense>
  </div>;
}
