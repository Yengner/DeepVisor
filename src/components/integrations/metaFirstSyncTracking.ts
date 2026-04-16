import type { FirstSyncJobStatus } from '@/lib/shared/types/integrations';

export const META_FIRST_SYNC_TRACK_EVENT = 'deepvisor:meta-first-sync-track';
const STORAGE_KEY = 'deepvisor:meta-first-sync-jobs:v1';

export type TrackedMetaFirstSyncJob = {
  jobId: string;
  integrationId: string;
  adAccountId: string;
  externalAccountId: string;
  adAccountName: string | null;
  job: FirstSyncJobStatus;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readTrackedMetaFirstSyncJobs(): TrackedMetaFirstSyncJob[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackedMetaFirstSyncJob[]) : [];
  } catch {
    return [];
  }
}

function writeTrackedMetaFirstSyncJobs(jobs: TrackedMetaFirstSyncJob[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function trackMetaFirstSyncJob(job: TrackedMetaFirstSyncJob): void {
  const existingJobs = readTrackedMetaFirstSyncJobs();
  const nextJobs = [
    job,
    ...existingJobs.filter((existing) => existing.jobId !== job.jobId),
  ];

  writeTrackedMetaFirstSyncJobs(nextJobs);
  window.dispatchEvent(
    new CustomEvent<TrackedMetaFirstSyncJob>(META_FIRST_SYNC_TRACK_EVENT, {
      detail: job,
    })
  );
}

export function updateTrackedMetaFirstSyncJob(job: TrackedMetaFirstSyncJob): void {
  const existingJobs = readTrackedMetaFirstSyncJobs();
  const nextJobs = existingJobs.some((existing) => existing.jobId === job.jobId)
    ? existingJobs.map((existing) => (existing.jobId === job.jobId ? job : existing))
    : [job, ...existingJobs];

  writeTrackedMetaFirstSyncJobs(nextJobs);
}

export function untrackMetaFirstSyncJob(jobId: string): void {
  const existingJobs = readTrackedMetaFirstSyncJobs();
  writeTrackedMetaFirstSyncJobs(existingJobs.filter((job) => job.jobId !== jobId));
}
