import { redirect } from 'next/navigation';
import { Button, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { getOnboardingInitial } from '@/lib/server/actions/business/onboarding';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';
import PreparationClient from './PreparationClient';
import classes from './PreparationClient.module.css';

export default async function PreparingPage() {
  await getLoggedInUserOrRedirect();
  const initial = await getOnboardingInitial();

  if (!initial.success) {
    return (
      <main className={classes.errorPage}>
        <section className={classes.errorPanel}>
          <Stack gap="md">
            <span className={classes.errorKicker}>WORKSPACE PREP INTERRUPTED</span>
            <Title order={2}>Could not prepare workspace</Title>
            <Text c="dimmed">
              {initial.error.userMessage || 'We could not load your onboarding workspace.'}
            </Text>
            <Button component={Link} href="/onboarding" variant="light">
              Back to onboarding
            </Button>
          </Stack>
        </section>
      </main>
    );
  }

  if (!initial.data.completed) {
    redirect(`/onboarding`);
  }

  return (
    <PreparationClient
      businessName={initial.data.businessData.businessName || initial.data.organizationName}
      connectedPlatformKeys={initial.data.connectedPlatformKeys}
    />
  );
}
