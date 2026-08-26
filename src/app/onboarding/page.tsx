import OnboardingProvider from './components/OnboardingProvider';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';
import { getOnboardingInitial } from '@/lib/server/actions/business/onboarding';
import { Button, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import classes from './components/OnboardingProvider.module.css';

export default async function OnboardingPage() {
  await getLoggedInUserOrRedirect();
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
            <Button component={Link} href="/login" variant="light">
              Back to login
            </Button>
          </Stack>
        </section>
      </main>
    );
  }

  const init = res.data;
  if (init.completed) redirect('/dashboard');

  return <OnboardingProvider initial={init} />;
}
