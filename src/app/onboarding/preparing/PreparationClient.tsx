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
      return '#0b7a4b';
    case 'running':
      return '#0b7a4b';
    case 'error':
      return '#e76156';
    case 'skipped':
      return '#747970';
    default:
      return '#747970';
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
          : syncBody?.message ??
            `Sync completed with ${syncBody?.refreshedCount ?? 0} integration update${(syncBody?.refreshedCount ?? 0) === 1 ? '' : 's'}.`
      );

      setPhaseStatus('history', 'running');
      await wait(900);
      setPhaseStatus('history', 'complete', 'Campaign, ad set, ad, creative, and performance history are ready for account review.');

      setPhaseStatus('assessment', 'running');
      const assessmentResponse = await fetch('/api/intelligence/assess', {
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
      <Container size="xl" className={classes.shell}>
        <header className={classes.topBar}>
          <div className={classes.brandLockup}>
            <span className={classes.brandMark}>DV</span>
            <span>DEEPVISOR</span>
            <span className={classes.brandSection}>WORKSPACE PREP</span>
          </div>
          <span className={classes.secureLabel}>SECURE INITIALIZATION</span>
        </header>

        <div className={classes.prepGrid}>
          <aside className={classes.statusPanel}>
            <div className={classes.panelTopline}>
              <Badge variant="light" size="md" radius="sm" className={classes.platformBadge}>
                {platformLabel}
              </Badge>
              <ThemeIcon
                size={48}
                radius="sm"
                variant="light"
                className={`${classes.statusIcon} ${errorMessage ? classes.errorStatusIcon : ''} ${!done && !errorMessage ? classes.workingIcon : ''}`}
              >
                {done ? <IconCheck size={25} /> : errorMessage ? <IconAlertCircle size={25} /> : <IconRefresh size={25} />}
              </ThemeIcon>
            </div>

            <div>
              <span className={classes.panelKicker}>WORKSPACE INITIALIZATION</span>
              <Title order={1} className={classes.panelTitle}>
                Preparing {businessName || 'your business'}.
              </Title>
              <Text className={classes.panelCopy}>
                DeepVisor is checking your data and assembling the first decision-ready account view.
              </Text>
            </div>

            <div className={classes.progressBlock}>
              <Group justify="space-between" align="flex-end" gap="md">
                <div>
                  <span>CURRENT CHECK</span>
                  <strong>{done ? 'Ready for dashboard' : runningPhase?.title ?? 'Preparing workspace'}</strong>
                </div>
                <b>{progress}%</b>
              </Group>
              <Progress
                value={progress}
                radius={0}
                size={7}
                color={errorMessage ? '#e76156' : '#c8ff56'}
                animated={!done && !errorMessage}
                className={classes.progressBar}
              />
            </div>

            <div className={classes.panelFootnote}>
              {done
                ? 'Your first workspace read is ready.'
                : 'You can continue in the background at any time.'}
            </div>
          </aside>

          <section className={classes.pipeline}>
            <div className={classes.pipelineHeader}>
              <div>
                <span className={classes.pipelineKicker}>SETUP PIPELINE</span>
                <Title order={2}>Workspace checks</Title>
              </div>
              <span className={classes.pipelineCount}>{completedCount} / {phases.length} COMPLETE</span>
            </div>

            {errorMessage ? (
              <Alert color="red" radius="sm" icon={<IconAlertCircle size={16} />} title="Preparation needs review" className={classes.errorAlert}>
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

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Card withBorder radius="sm" p="md" className={classes.statusCard}>
                <Group gap="sm" mb="sm" wrap="nowrap">
                  <ThemeIcon variant="light" radius="sm" className={classes.featureIcon}>
                    <IconDatabaseImport size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800}>Data ingestion</Text>
                    <Text size="xs" c="dimmed">Campaigns, ads, creatives, metrics</Text>
                  </div>
                </Group>
                <Text size="sm" c="dimmed">
                  Connected accounts sync live history. Unconnected workspaces begin in preview mode.
                </Text>
              </Card>

              <Card withBorder radius="sm" p="md" className={classes.statusCard}>
                <Group gap="sm" mb="sm" wrap="nowrap">
                  <ThemeIcon variant="light" radius="sm" className={classes.featureIcon}>
                    <IconTargetArrow size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800}>Account intelligence</Text>
                    <Text size="xs" c="dimmed">Strengths, risks, next decisions</Text>
                  </div>
                </Group>
                <Text size="sm" c="dimmed">
                  Assessments feed quick reads, report recommendations, and planning context.
                </Text>
              </Card>
            </SimpleGrid>

            <div className={classes.phaseList}>
              {phases.map((phase, index) => (
                <div key={phase.key} className={classes.phaseRow}>
                  <span className={classes.phaseIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={phaseDotClass(phase.status)} />
                  <div className={classes.phaseContent}>
                    <Text fw={800}>{phase.title}</Text>
                    <Text size="sm" c="dimmed" mt={3}>{phase.detail}</Text>
                  </div>
                  <Badge color={statusColor(phase.status)} variant="light" radius="sm" className={classes.phaseBadge}>
                    {phaseStatusLabel(phase.status)}
                  </Badge>
                </div>
              ))}
            </div>

            <footer className={classes.actionFooter}>
              <Group gap="xs" wrap="nowrap" className={classes.actionNote}>
                <ThemeIcon variant="light" radius="sm" className={classes.insightIcon}>
                  <IconSparkles size={16} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  {done
                    ? 'Taking you to the dashboard now.'
                    : 'The first connected account can take a moment.'}
                </Text>
              </Group>
              <Button
                variant={done ? 'filled' : 'default'}
                rightSection={<IconCalendarTime size={16} />}
                onClick={() => router.replace('/dashboard')}
                className={done ? classes.primaryButton : classes.secondaryButton}
              >
                {done ? 'Open dashboard' : 'Continue in background'}
              </Button>
            </footer>
          </section>
        </div>
      </Container>
    </div>
  );
}
