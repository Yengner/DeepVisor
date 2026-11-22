"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader, Progress } from "@mantine/core";
import type { FirstSyncJobStatus, FirstSyncStage } from "@/lib/shared/types/integrations";

/** The first-sync stages in the order the worker runs them; each is worded in the catalog (`accountSetup.steps`). */
const STEPS = [
  "resolving_account",
  "syncing_campaigns",
  "syncing_adsets",
  "syncing_ads",
  "syncing_creatives",
  "syncing_performance_windows",
  "finalizing_summaries",
  "running_assessments",
] as const satisfies readonly FirstSyncStage[];

const POLL_MS = 4000;
const GIVE_UP_MS = 15 * 60_000;

/**
 * Live progress for "Setting up your account" (the account's first full Meta sync), which now runs in the background after
 * connecting. Polls the existing first-sync status endpoint and reloads the Overview once the
 * job finishes (or fails, so the server shows the failure state). Stops polling after 15 minutes.
 */
export function AccountSetupProgress({ jobId }: { jobId: string }) {
  const router = useRouter();
  const t = useTranslations("accountSetup");
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
          // Lets the first-look popup check right away instead of on its next scheduled try.
          window.dispatchEvent(new Event("deepvisor:data-updated"));
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

  const index = job?.stage ? STEPS.findIndex((stage) => stage === job.stage) : -1;
  const current = index >= 0 ? STEPS[index] : null;
  const counts = job?.counts;
  const found = counts
    ? [
        counts.campaignsSynced ? t("campaigns", { count: counts.campaignsSynced }) : null,
        counts.adsSynced ? t("ads", { count: counts.adsSynced }) : null,
      ].filter(Boolean).join(" · ")
    : "";

  if (stalled) {
    return <p role="status">{t("stalled")}</p>;
  }
  return (
    <div role="status" aria-live="polite" style={{ display: "grid", gap: 8, width: "min(360px, 100%)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Loader size="xs" aria-hidden />
        {current ? t(`steps.${current}`) : job?.status === "queued" ? t("queued") : t("syncing")}
      </span>
      <Progress
        value={index >= 0 ? Math.round(((index + 1) / (STEPS.length + 1)) * 100) : 5}
        aria-label={t("progressAria")}
        animated
      />
      {found && <small>{t("found", { found })}</small>}
      <small>{t("leaveNote")}</small>
    </div>
  );
}
