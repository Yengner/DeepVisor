'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCalendarTime,
  IconCheck,
  IconDatabaseImport,
  IconRefresh,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react';
import classes from './PreparationClient.module.css';

type PhaseStatus = 'pending' | 'running' | 'complete' | 'skipped' | 'error';

type PhaseKey = 'workspace' | 'sync' | 'history' | 'assessment' | 'queue';

type Phase = {
  key: PhaseKey;
  title: string;
  detail: string;
  status: PhaseStatus;
};

type PreparationClientProps = {
  businessName: string;
  connectedPlatformKeys: string[];
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function phaseStatusLabel(status: PhaseStatus) {
  switch (status) {
    case 'running':
      return 'Working';
    case 'complete':
      return 'Done';
    case 'skipped':
      return 'Skipped';
    case 'error':
      return 'Needs review';
    default:
      return 'Pending';
  }
}

function phaseDotClass(status: PhaseStatus) {
  switch (status) {
    case 'running':
      return classes.pulseDot;
    case 'complete':
      return classes.completeDot;
    case 'skipped':
      return classes.skipDot;
    case 'error':
      return classes.errorDot;
    default:
      return classes.skipDot;
  }
}

function statusColor(status: PhaseStatus) {
  switch (status) {
    case 'complete':
      return 'green';
    case 'running':
      return 'blue';
    case 'error':
      return 'red';
    case 'skipped':
      return 'gray';
    default:
      return 'gray';
  }
}

export default function PreparationClient({
  businessName,
  connectedPlatformKeys,
}: PreparationClientProps) {
  const router = useRouter();
  const hasConnectedPlatform = connectedPlatformKeys.length > 0;
  const startedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([
    {
      key: 'workspace',
      title: 'Saving business intelligence profile',
      detail: 'Locking in goals, budget context, platforms, and owner preferences.',
      status: 'pending',
    },
    {
      key: 'sync',
      title: 'Syncing connected ad account data',
      detail: 'Pulling campaigns, ad sets, ads, creatives, and recent performance history.',
      status: 'pending',
    },
    {
      key: 'history',
      title: 'Reading account history',
      detail: 'Looking for spend patterns, strongest campaigns, weak ad sets, and tracking gaps.',
      status: 'pending',
    },
    {
      key: 'assessment',
      title: 'Creating first account assessment',
      detail: 'Classifying account maturity and turning history into strengths, risks, and next steps.',
      status: 'pending',
    },
    {
      key: 'queue',
      title: 'Preparing dashboard, reports, and calendar queue',
      detail: 'Making the first DeepVisor surfaces ready for review.',
      status: 'pending',
    },
  ]);

  const completedCount = phases.filter((phase) => phase.status === 'complete' || phase.status === 'skipped').length;
  const runningPhase = phases.find((phase) => phase.status === 'running');
  const progress = Math.min(100, Math.round((completedCount / phases.length) * 100));

  const platformLabel = useMemo(() => {
    if (connectedPlatformKeys.length === 0) return 'No ad account connected yet';
    return connectedPlatformKeys.map((key) => key === 'meta' ? 'Meta' : key).join(', ');
  }, [connectedPlatformKeys]);

  function setPhaseStatus(key: PhaseKey, status: PhaseStatus, detail?: string) {
    setPhases((current) =>
      current.map((phase) =>
        phase.key === key
          ? {
              ...phase,
              status,
              detail: detail ?? phase.detail,
            }
          : phase
      )
    );
  }

  async function runPreparation() {
    setErrorMessage(null);
    setDone(false);

    setPhaseStatus('workspace', 'running');
    await wait(650);
    setPhaseStatus('workspace', 'complete');

    if (!hasConnectedPlatform) {
      setPhaseStatus('sync', 'skipped', 'No platform is connected yet. You can connect Meta from Integrations after entering the app.');
      setPhaseStatus('history', 'skipped', 'DeepVisor needs a connected ad account before it can ingest real campaign history.');
      setPhaseStatus('assessment', 'skipped', 'The first assessment will run after a selected ad account is synced.');
      setPhaseStatus('queue', 'running');
      await wait(850);
      setPhaseStatus('queue', 'complete', 'Static previews are ready so you can see the product before connecting live data.');
      setDone(true);
      return;
    }

    try {
      setPhaseStatus('sync', 'running');
      const syncResponse = await fetch('/api/sync/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const syncBody = await syncResponse.json().catch(() => null);

      if (!syncResponse.ok && syncResponse.status !== 429) {
        throw new Error(syncBody?.message || 'Sync failed while preparing your workspace.');
      }

      setPhaseStatus(
        'sync',
        'complete',
        syncResponse.status === 429
          ? syncBody?.message || 'Recent sync data is already available, so DeepVisor used the latest stored account data.'
          : `Sync completed with ${syncBody?.refreshedCount ?? 0} integration update${(syncBody?.refreshedCount ?? 0) === 1 ? '' : 's'}.`
      );

      setPhaseStatus('history', 'running');
      await wait(900);
      setPhaseStatus('history', 'complete', 'Campaign, ad set, ad, creative, and performance history are ready for account review.');

      setPhaseStatus('assessment', 'running');
      const assessmentResponse = await fetch('/api/agency/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'business' }),
      });
      const assessmentBody = await assessmentResponse.json().catch(() => null);

      if (!assessmentResponse.ok) {
        const message =
          assessmentBody?.error?.userMessage ||
          assessmentBody?.message ||
          'The account assessment could not run yet.';

        if (message.includes('Select and sync')) {
          setPhaseStatus('assessment', 'skipped', 'A primary ad account still needs to be selected before the first assessment can run.');
        } else {
          throw new Error(message);
        }
      } else {
        setPhaseStatus('assessment', 'complete', 'DeepVisor created the first account assessment and business-level read.');
      }

      setPhaseStatus('queue', 'running');
      await wait(750);
      setPhaseStatus('queue', 'complete', 'Dashboard, reports, and calendar surfaces are ready to review.');
      setDone(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preparation failed.';
      setErrorMessage(message);
      setPhases((current) =>
        current.map((phase) => phase.status === 'running' ? { ...phase, status: 'error', detail: message } : phase)
      );
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runPreparation();
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => {
      router.replace('/dashboard');
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [done, router]);

  return (
    <div className={classes.page}>
      <Container size="lg" className={classes.shell}>
        <Card withBorder radius="xl" p={{ base: 'lg', md: 'xl' }} className={classes.mainCard}>
          <Stack gap="xl">
            <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
              <div>
                <Badge color={hasConnectedPlatform ? 'blue' : 'gray'} variant="light" size="lg">
                  {platformLabel}
                </Badge>
                <Title order={1} mt="sm">
                  Preparing {businessName || 'your business'} for DeepVisor
                </Title>
                <Text c="dimmed" size="lg" mt="xs" maw={720}>
                  We are checking connected ad data, reading account history, and preparing the first recommendations before you land in the dashboard.
                </Text>
              </div>

              <ThemeIcon color={done ? 'green' : errorMessage ? 'red' : 'blue'} size={58} radius="xl" variant="light">
                {done ? <IconCheck size={30} /> : errorMessage ? <IconAlertCircle size={30} /> : <IconRefresh size={30} />}
              </ThemeIcon>
            </Group>

            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={700}>
                  {done ? 'Ready for dashboard' : runningPhase?.title ?? 'Preparing workspace'}
                </Text>
                <Text size="sm" c="dimmed">
                  {progress}% complete
                </Text>
              </Group>
              <Progress value={progress} radius="xl" size="lg" color={errorMessage ? 'red' : done ? 'green' : 'blue'} animated={!done && !errorMessage} />
            </Stack>

            {errorMessage ? (
              <Alert color="red" radius="lg" icon={<IconAlertCircle size={16} />} title="Preparation needs review">
                <Text size="sm">{errorMessage}</Text>
                <Group mt="md" gap="sm">
                  <Button size="xs" variant="light" color="red" onClick={() => void runPreparation()}>
                    Try again
                  </Button>
                  <Button size="xs" variant="default" onClick={() => router.replace('/dashboard')}>
                    Continue to dashboard
                  </Button>
                </Group>
              </Alert>
            ) : null}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Card withBorder radius="lg" p="md" className={classes.statusCard}>
                <Group gap="sm" mb="md">
                  <ThemeIcon color="blue" variant="light" radius="md">
                    <IconDatabaseImport size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800}>Data ingestion</Text>
                    <Text size="sm" c="dimmed">Campaigns, ad sets, ads, creatives, metrics</Text>
                  </div>
                </Group>
                <Text size="sm" c="dimmed">
                  Live ingestion runs when a platform is connected and one primary ad account is available. Otherwise DeepVisor starts in preview mode.
                </Text>
              </Card>

              <Card withBorder radius="lg" p="md" className={classes.statusCard}>
                <Group gap="sm" mb="md">
                  <ThemeIcon color="green" variant="light" radius="md">
                    <IconTargetArrow size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800}>Account intelligence</Text>
                    <Text size="sm" c="dimmed">Strengths, weak spots, next decisions</Text>
                  </div>
                </Group>
                <Text size="sm" c="dimmed">
                  Assessments populate DeepVisor&apos;s quick reads, report recommendations, and calendar planning context.
                </Text>
              </Card>
            </SimpleGrid>

            <Stack gap="sm">
              {phases.map((phase) => (
                <div key={phase.key} className={classes.phaseRow}>
                  <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <span className={phaseDotClass(phase.status)} />
                      <div>
                        <Text fw={800}>{phase.title}</Text>
                        <Text size="sm" c="dimmed" mt={3}>{phase.detail}</Text>
                      </div>
                    </Group>
                    <Badge color={statusColor(phase.status)} variant="light" radius="sm">
                      {phaseStatusLabel(phase.status)}
                    </Badge>
                  </Group>
                </div>
              ))}
            </Stack>

            <Group justify="space-between" gap="md" wrap="wrap">
              <Group gap="xs">
                <ThemeIcon color="yellow" variant="light" radius="xl">
                  <IconSparkles size={16} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  {done
                    ? 'Taking you to the dashboard now.'
                    : 'This can take a moment on the first connected ad account.'}
                </Text>
              </Group>
              <Button
                variant={done ? 'filled' : 'default'}
                color={done ? 'green' : 'gray'}
                rightSection={<IconCalendarTime size={16} />}
                onClick={() => router.replace('/dashboard')}
              >
                {done ? 'Open dashboard' : 'Continue in background'}
              </Button>
            </Group>
          </Stack>
        </Card>
      </Container>
    </div>
  );
}
