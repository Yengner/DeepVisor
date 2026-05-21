'use client';

import { useEffect } from 'react';
import { readTrackedFirstSyncJobs, untrackFirstSyncJob } from './firstSyncTracking';

/**
 * Legacy first-sync tracking cleanup.
 *
 * Meta first sync is currently a local blocking flow, so the app should not keep
 * dispatching jobs, polling job status, or subscribing to realtime updates from
 * the global shell. This component remains mounted only to clear any stale jobs
 * saved by the older background-sync UI.
 */
export default function FirstSyncTracker() {
  useEffect(() => {
    for (const job of readTrackedFirstSyncJobs()) {
      untrackFirstSyncJob(job.jobId);
    }
  }, []);

  return null;
}
