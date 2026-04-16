'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowAutofitDown,
  IconCheck,
  IconCloudDownload,
  IconLoader2,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/client/supabase/browser';
import type { FirstSyncJobStatus } from '@/lib/shared/types/integrations';
import {
  META_FIRST_SYNC_TRACK_EVENT,
  readTrackedMetaFirstSyncJobs,
  type TrackedMetaFirstSyncJob,
  updateTrackedMetaFirstSyncJob,
  untrackMetaFirstSyncJob,
} from './metaFirstSyncTracking';

const STAGE_ORDER: Array<NonNullable<FirstSyncJobStatus['stage']>> = [
  'resolving_account',
  'syncing_campaigns',
  'syncing_adsets',
  'syncing_ads',
  'syncing_creatives',
  'syncing_performance_windows',
  'finalizing_summaries',
  'running_assessments',
  'completed',
];

const STAGE_LABELS: Record<NonNullable<FirstSyncJobStatus['stage']>, string> = {
  resolving_account: 'Resolving selected account',
  syncing_campaigns: 'Syncing campaigns',
  syncing_adsets: 'Syncing ad sets',
  syncing_ads: 'Syncing ads',
  syncing_creatives: 'Syncing creatives',
  syncing_performance_windows: 'Syncing 30-day performance windows',
  finalizing_summaries: 'Finalizing lifetime summaries',
  running_assessments: 'Running DeepVisor analysis',
  completed: 'Completed',
};

function formatJobCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function computeStageProgress(job: FirstSyncJobStatus): number {
  if (job.status === 'completed') {
    return 100;
  }

  if (job.status === 'failed') {
    return 100;
  }

  if (job.status === 'queued') {
    return 6;
  }

  const stageIndex = job.stage ? STAGE_ORDER.indexOf(job.stage) : -1;
  if (stageIndex < 0) {
    return 12;
  }

  return Math.min(95, Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100));
}

export default function MetaFirstSyncTracker() {
  const [trackedJobs, setTrackedJobs] = useState<TrackedMetaFirstSyncJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'connecting' | 'subscribed' | 'error'>('idle');
  const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<string | null>(null);
  const dispatchRequestedAt = useRef<Map<string, number>>(new Map());
  const supabaseRef = useRef(createClient());

  const applyLatestJobState = (
    trackedJob: TrackedMetaFirstSyncJob,
    latestJob: FirstSyncJobStatus,
    options?: {
      showToast?: boolean;
    }
  ): TrackedMetaFirstSyncJob | null => {
    const nextTrackedJob = {
      ...trackedJob,
      job: latestJob,
    };

    if (latestJob.status === 'completed') {
      untrackMetaFirstSyncJob(trackedJob.jobId);
      if (options?.showToast) {
        toast.success('Meta history sync completed.');
      }
      if (selectedJobId === trackedJob.jobId) {
        setModalOpened(false);
      }
      return null;
    }

    if (latestJob.status === 'failed') {
      untrackMetaFirstSyncJob(trackedJob.jobId);
      if (options?.showToast) {
        toast.error(latestJob.errorMessage || 'Meta history sync failed.');
      }
      if (selectedJobId === trackedJob.jobId) {
        setModalOpened(false);
      }
      return null;
    }

    updateTrackedMetaFirstSyncJob(nextTrackedJob);
    return nextTrackedJob;
  };

  useEffect(() => {
    const storedJobs = readTrackedMetaFirstSyncJobs();
    setTrackedJobs(storedJobs);
    setSelectedJobId(storedJobs[0]?.jobId ?? null);
  }, []);

  useEffect(() => {
    const handleTrack = (event: Event) => {
      const detail = (event as CustomEvent<TrackedMetaFirstSyncJob>).detail;
      if (!detail?.jobId) {
        return;
      }

      setTrackedJobs((current) => [
        detail,
        ...current.filter((job) => job.jobId !== detail.jobId),
      ]);
      setSelectedJobId(detail.jobId);
      setModalOpened(true);
    };

    window.addEventListener(META_FIRST_SYNC_TRACK_EVENT, handleTrack);
    return () => {
      window.removeEventListener(META_FIRST_SYNC_TRACK_EVENT, handleTrack);
    };
  }, []);

  useEffect(() => {
    if (trackedJobs.length === 0) {
      return;
    }

    for (const trackedJob of trackedJobs) {
      const lastRequestedAt = dispatchRequestedAt.current.get(trackedJob.jobId) ?? 0;
      if (
        trackedJob.job.status !== 'queued' ||
        Date.now() - lastRequestedAt < 15_000
      ) {
        continue;
      }

      dispatchRequestedAt.current.set(trackedJob.jobId, Date.now());
      void fetch(`/api/integrations/meta/sync-jobs/${trackedJob.jobId}/dispatch`, {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to dispatch Meta first-sync job:', error);
      });
    }
  }, [trackedJobs]);

  useEffect(() => {
    if (trackedJobs.length === 0) {
      setRealtimeStatus('idle');
      return;
    }

    const supabase = supabaseRef.current;
    let cancelled = false;
    const channels: RealtimeChannel[] = [];
    setRealtimeStatus('connecting');

    const refreshJobStatus = async (
      trackedJob: TrackedMetaFirstSyncJob,
      options?: {
        showToast?: boolean;
      }
    ): Promise<TrackedMetaFirstSyncJob | null> => {
      try {
        const response = await fetch(
          `/api/integrations/meta/sync-jobs/${trackedJob.jobId}`,
          {
            cache: 'no-store',
          }
        );

        const contentType = response.headers.get('content-type') ?? '';

        if (response.redirected || !contentType.includes('application/json')) {
          untrackMetaFirstSyncJob(trackedJob.jobId);
          return null;
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 404) {
            untrackMetaFirstSyncJob(trackedJob.jobId);
            return null;
          }

          return trackedJob;
        }

        const body = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { job?: FirstSyncJobStatus };
        };
        const latestJob = body.data?.job;

        if (!latestJob) {
          return trackedJob;
        }

        return applyLatestJobState(trackedJob, latestJob, options);
      } catch (error) {
        console.error('Failed to refresh Meta first-sync status:', error);
        return trackedJob;
      }
    };

    const bootstrapStatuses = async () => {
      const nextJobs = await Promise.all(
        trackedJobs.map((trackedJob) => refreshJobStatus(trackedJob))
      );

      if (!cancelled) {
        const filteredJobs = nextJobs.filter(
          (job): job is TrackedMetaFirstSyncJob => job !== null
        );
        setTrackedJobs(filteredJobs);
        if (filteredJobs.length === 0) {
          setSelectedJobId(null);
        } else if (!filteredJobs.some((job) => job.jobId === selectedJobId)) {
          setSelectedJobId(filteredJobs[0]?.jobId ?? null);
        }
      }
    };

    void bootstrapStatuses();

    for (const trackedJob of trackedJobs) {
      const channel = supabase
        .channel(`meta-first-sync-job-${trackedJob.jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'account_sync_jobs',
            filter: `id=eq.${trackedJob.jobId}`,
          },
          () => {
            setLastRealtimeEventAt(new Date().toISOString());
            void refreshJobStatus(trackedJob, { showToast: true }).then((nextTrackedJob) => {
              if (cancelled) {
                return;
              }

              setTrackedJobs((current) => {
                if (!nextTrackedJob) {
                  return current.filter((job) => job.jobId !== trackedJob.jobId);
                }

                const nextJobs = current.some((job) => job.jobId === trackedJob.jobId)
                  ? current.map((job) =>
                      job.jobId === trackedJob.jobId ? nextTrackedJob : job
                    )
                  : [nextTrackedJob, ...current];

                if (!nextJobs.some((job) => job.jobId === selectedJobId)) {
                  setSelectedJobId(nextJobs[0]?.jobId ?? null);
                }

                return nextJobs;
              });
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('subscribed');
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setRealtimeStatus('error');
          }
        });

      channels.push(channel);
    }

    return () => {
      cancelled = true;
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [trackedJobs, selectedJobId]);

  const selectedJob =
    trackedJobs.find((job) => job.jobId === selectedJobId) ??
    trackedJobs[0] ??
    null;
  const runningJobs = trackedJobs.filter(
    (job) => job.job.status === 'queued' || job.job.status === 'running'
  );

  return (
    <>
      <Modal
        opened={Boolean(selectedJob) && modalOpened}
        onClose={() => setModalOpened(false)}
        title="Syncing Meta history"
        centered
        size="lg"
      >
        {selectedJob ? (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text fw={700}>{selectedJob.adAccountName ?? selectedJob.externalAccountId}</Text>
                <Text size="sm" c="dimmed">
                  DeepVisor is filling campaigns, ad sets, ads, creatives, and daily performance in
                  the background. You can close this and reopen it anytime.
                </Text>
              </Stack>
              <Badge
                color={selectedJob.job.status === 'queued' ? 'gray' : 'blue'}
                variant="light"
              >
                {selectedJob.job.status}
              </Badge>
            </Group>

            <Stack gap={6}>
              <Text fw={600}>{selectedJob.job.message ?? 'Preparing the first history sync.'}</Text>
              <Progress
                value={computeStageProgress(selectedJob.job)}
                animated={selectedJob.job.status === 'running'}
                size="lg"
                radius="xl"
              />
            </Stack>

            {selectedJob.job.windowSince && selectedJob.job.windowUntil ? (
              <Paper withBorder radius="md" p="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="blue" variant="light" radius="xl">
                    <IconArrowAutofitDown size={16} />
                  </ThemeIcon>
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>
                      Current 30-day window
                    </Text>
                    <Text size="sm" c="dimmed">
                      {selectedJob.job.windowSince} through {selectedJob.job.windowUntil}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            ) : null}

            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Campaigns
                </Text>
                <Text fw={700}>{formatJobCount(selectedJob.job.counts.campaignsSynced)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Ad sets
                </Text>
                <Text fw={700}>{formatJobCount(selectedJob.job.counts.adsetsSynced)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Ads
                </Text>
                <Text fw={700}>{formatJobCount(selectedJob.job.counts.adsSynced)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Creatives
                </Text>
                <Text fw={700}>{formatJobCount(selectedJob.job.counts.creativesSynced)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Daily rows
                </Text>
                <Text fw={700}>{formatJobCount(selectedJob.job.counts.performanceRowsSynced)}</Text>
              </Paper>
            </SimpleGrid>

            <Stack gap="xs">
              {STAGE_ORDER.map((stage) => {
                const currentIndex = selectedJob.job.stage
                  ? STAGE_ORDER.indexOf(selectedJob.job.stage)
                  : -1;
                const stageIndex = STAGE_ORDER.indexOf(stage);
                const complete =
                  selectedJob.job.status === 'completed' || stageIndex < currentIndex;
                const active =
                  selectedJob.job.status === 'running' &&
                  selectedJob.job.stage === stage;

                return (
                  <Group key={stage} gap="sm" wrap="nowrap">
                    <ThemeIcon
                      color={complete ? 'green' : active ? 'blue' : 'gray'}
                      variant={complete || active ? 'filled' : 'light'}
                      radius="xl"
                      size="sm"
                    >
                      {complete ? (
                        <IconCheck size={12} />
                      ) : active ? (
                        <IconLoader2 size={12} />
                      ) : (
                        <span />
                      )}
                    </ThemeIcon>
                    <Text size="sm" fw={active ? 600 : 500} c={complete || active ? undefined : 'dimmed'}>
                      {STAGE_LABELS[stage]}
                    </Text>
                  </Group>
                );
              })}
            </Stack>

            {selectedJob.job.coverageStartDate && selectedJob.job.coverageEndDate ? (
              <Text size="xs" c="dimmed">
                Synced window so far: {selectedJob.job.coverageStartDate} through{' '}
                {selectedJob.job.coverageEndDate}.
              </Text>
            ) : null}

            {process.env.NODE_ENV !== 'production' ? (
              <Text size="xs" c="dimmed">
                Realtime: {realtimeStatus}
                {lastRealtimeEventAt
                  ? ` • last event ${new Date(lastRealtimeEventAt).toLocaleTimeString()}`
                  : ''}
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </Modal>

      {runningJobs.length > 0 && !modalOpened ? (
        <Button
          onClick={() => {
            setSelectedJobId(runningJobs[0]?.jobId ?? null);
            setModalOpened(true);
          }}
          radius="xl"
          size="md"
          leftSection={<IconCloudDownload size={16} />}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 80,
          }}
        >
          {runningJobs.length === 1 ? 'Meta history sync running' : `${runningJobs.length} syncs running`}
        </Button>
      ) : null}
    </>
  );
}
