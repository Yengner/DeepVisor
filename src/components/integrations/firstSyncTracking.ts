import type {
  FirstSyncJobStatus,
  SupportedIntegrationPlatform,
} from '@/lib/shared/types/integrations';

export const FIRST_SYNC_TRACK_EVENT = 'deepvisor:first-sync-track';
const STORAGE_KEY = 'deepvisor:first-sync-jobs:v1';
const LEGACY_STORAGE_KEY = 'deepvisor:meta-first-sync-jobs:v1';

export type TrackedFirstSyncJob = {
  jobId: string;
  integrationId: string;
  adAccountId: string;
  externalAccountId: string;
  adAccountName: string | null;
  platformKey: SupportedIntegrationPlatform;
  platformName: string;
  job: FirstSyncJobStatus;
};

type LegacyTrackedMetaFirstSyncJob = Omit<
  TrackedFirstSyncJob,
  'platformKey' | 'platformName'
>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeTrackedJob(
  job: TrackedFirstSyncJob | LegacyTrackedMetaFirstSyncJob
): TrackedFirstSyncJob | null {
  if (
    !job ||
    typeof job !== 'object' ||
    typeof job.jobId !== 'string' ||
    typeof job.integrationId !== 'string' ||
    typeof job.adAccountId !== 'string' ||
    typeof job.externalAccountId !== 'string' ||
    !job.job
  ) {
    return null;
  }

  return {
    ...job,
    platformKey: 'platformKey' in job && job.platformKey ? job.platformKey : 'meta',
    platformName: 'platformName' in job && job.platformName ? job.platformName : 'Meta',
  };
}

function readStoredJobs(key: string): TrackedFirstSyncJob[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((job) => normalizeTrackedJob(job as TrackedFirstSyncJob | LegacyTrackedMetaFirstSyncJob))
      .filter((job): job is TrackedFirstSyncJob => job !== null);
  } catch {
    return [];
  }
}

export function readTrackedFirstSyncJobs(): TrackedFirstSyncJob[] {
  if (!canUseStorage()) {
    return [];
  }

  const currentJobs = readStoredJobs(STORAGE_KEY);
  if (currentJobs.length > 0) {
    return currentJobs;
  }

  const legacyJobs = readStoredJobs(LEGACY_STORAGE_KEY);
  if (legacyJobs.length > 0) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyJobs));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  return legacyJobs;
}

function writeTrackedFirstSyncJobs(jobs: TrackedFirstSyncJob[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function trackFirstSyncJob(job: TrackedFirstSyncJob): void {
  const existingJobs = readTrackedFirstSyncJobs();
  const nextJobs = [
    job,
    ...existingJobs.filter((existing) => existing.jobId !== job.jobId),
  ];

  writeTrackedFirstSyncJobs(nextJobs);
  window.dispatchEvent(
    new CustomEvent<TrackedFirstSyncJob>(FIRST_SYNC_TRACK_EVENT, {
      detail: job,
    })
  );
}

export function updateTrackedFirstSyncJob(job: TrackedFirstSyncJob): void {
  const existingJobs = readTrackedFirstSyncJobs();
  const nextJobs = existingJobs.some((existing) => existing.jobId === job.jobId)
    ? existingJobs.map((existing) => (existing.jobId === job.jobId ? job : existing))
    : [job, ...existingJobs];

  writeTrackedFirstSyncJobs(nextJobs);
}

export function untrackFirstSyncJob(jobId: string): void {
  const existingJobs = readTrackedFirstSyncJobs();
  writeTrackedFirstSyncJobs(existingJobs.filter((job) => job.jobId !== jobId));
}
