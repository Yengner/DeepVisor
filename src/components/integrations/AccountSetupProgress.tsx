"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader, Progress } from "@mantine/core";
import type { FirstSyncJobStatus, FirstSyncStage } from "@/lib/shared/types/integrations";

/** Plain-language step for each first-sync stage, in the order the worker runs them. */
const STEPS: Array<{ stage: FirstSyncStage; label: string }> = [
  { stage: "resolving_account", label: "Opening your ad account" },
  { stage: "syncing_campaigns", label: "Getting your campaigns" },
  { stage: "syncing_adsets", label: "Getting your ad sets" },
  { stage: "syncing_ads", label: "Getting your ads" },
  { stage: "syncing_creatives", label: "Getting your ad images and videos" },
  { stage: "syncing_performance_windows", label: "Getting your results" },
  { stage: "finalizing_summaries", label: "Adding up your results" },
  { stage: "running_assessments", label: "Checking how your ads are doing" },
];

const POLL_MS = 4000;
const GIVE_UP_MS = 15 * 60_000;

/**
 * Live progress for "Setting up your account" (the account's first full Meta sync), which now runs in the background after
 * connecting. Polls the existing first-sync status endpoint and reloads the Overview once the
 * job finishes (or fails, so the server shows the failure state). Stops polling after 15 minutes.
 */
export function AccountSetupProgress({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<FirstSyncJobStatus | null>(null);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const poll = async () => {
      try {
        const response = await fetch(`/api/integrations/meta/sync-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (stopped) return;
        const next: FirstSyncJobStatus | null = response.ok && body?.success ? body.data.job : null;
        if (next) setJob(next);
        if (next && (next.status === "completed" || next.status === "failed" || next.firstFullSyncCompleted)) {
          router.refresh();
          return;
        }
      } catch {
        // A missed poll is retried on the next tick.
      }
      if (stopped) return;
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setStalled(true);
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, router]);

  const index = job?.stage ? STEPS.findIndex((step) => step.stage === job.stage) : -1;
  const current = index >= 0 ? STEPS[index] : null;
  const counts = job?.counts;
  const found = counts
    ? [
        counts.campaignsSynced ? `${counts.campaignsSynced} campaigns` : null,
        counts.adsSynced ? `${counts.adsSynced} ads` : null,
      ].filter(Boolean).join(" · ")
    : "";

  if (stalled) {
    return <p role="status">This is taking longer than usual. It keeps running — reload this page in a few minutes.</p>;
  }
  return (
    <div role="status" aria-live="polite" style={{ display: "grid", gap: 8, width: "min(360px, 100%)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Loader size="xs" aria-hidden />
        {current ? current.label : job?.status === "queued" ? "Starting your account setup" : "Syncing your Meta data"}
      </span>
      <Progress
        value={index >= 0 ? Math.round(((index + 1) / (STEPS.length + 1)) * 100) : 5}
        aria-label="Account setup progress"
        animated
      />
      {found && <small>Found {found} so far</small>}
      <small>You can leave this page. Your dashboard fills in when it is done.</small>
    </div>
  );
}
