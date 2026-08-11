import OnboardingProvider from './components/OnboardingProvider';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';
import { getOnboardingInitial } from '@/lib/server/actions/business/onboarding';
import { Button, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import classes from './components/OnboardingProvider.module.css';

export default async function OnboardingPage() {
  const user = await getLoggedInUserOrRedirect();
  const res = await getOnboardingInitial();

  if (!res.success) {
    return (
      <main className={classes.errorPage}>
        <section className={classes.errorPanel}>
          <Stack gap="md">
            <span className={classes.errorKicker}>ONBOARDING UNAVAILABLE</span>
            <Title order={2}>Business onboarding only</Title>
            <Text c="dimmed">
              {res.error.userMessage || 'We could not load your onboarding workspace.'}
            </Text>
            <Text c="dimmed">
              DeepVisor currently takes new users through the business-owner path first. Partner workspace onboarding
              can be added later without changing the organization model underneath it.
            </Text>
            <Button component={Link} href="/login" variant="light">
              Back to login
            </Button>
          </Stack>
        </section>
      </main>
    );
  }

  const init = res.data;

  return <OnboardingProvider initial={init} userId={user.id} />;
}
