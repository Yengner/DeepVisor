import OnboardingProvider from './components/OnboardingProvider';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';
import { getOnboardingInitial } from '@/lib/server/actions/business/onboarding';
import { Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export default async function OnboardingPage() {
  const user = await getLoggedInUserOrRedirect();
  const res = await getOnboardingInitial();

  if (!res.success) {
    return (
      <Container size="sm" py="xl">
        <Paper withBorder radius="lg" p="xl">
          <Stack gap="md">
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
        </Paper>
      </Container>
    );
  }

  const init = res.data;

  return <OnboardingProvider initial={init} userId={user.id} />;
}
