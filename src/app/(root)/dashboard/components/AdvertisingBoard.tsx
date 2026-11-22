"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconSparkles } from "@tabler/icons-react";
import { askDeepVisor } from "@/lib/shared/assistant/askEvent";
import { useAssistantAvailable } from "@/components/layout/assistantAvailability";
import type {
  ExplorationView,
  Summary,
} from "@/lib/server/campaigns/exploration/types";
import {
  AdSetDrawer,
  MediaImage,
} from "@/components/campaigns/exploration/AdvertisingExplorer";
import StatusBadge from "@/components/product/StatusBadge";
import { LiveIndicator } from "@/components/design/LiveIndicator";
import type { AdSignals as AdSignalsData } from "@/lib/server/dashboard/insights/signals";
import { LearningBar, QuickStats, RunWindow } from "./AdCardParts";
import parts from "./AdCardParts.module.css";
import classes from "./ControlCenter.module.css";

export default function AdvertisingBoard({ view, signals = {}, filtered = false }: { view: ExplorationView; learning?: Record<string, string>; signals?: Record<string, AdSignalsData>; filtered?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const assistant = useAssistantAvailable();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const active = (
    view.board?.activeIds ??
    view.items.filter((i) => i.delivery === "ACTIVE").map((i) => i.id)
  ).flatMap((id) => view.items.find((i) => i.id === id) ?? []);
  const featured =
    active.find((i) => i.id === view.board?.activeFeaturedId) ?? active[0];
  const periodLabel =
    view.period === "today"
      ? "Today"
      : view.period === "7d"
        ? "7 days"
        : "30 days";
  function open(id: string, from: HTMLButtonElement) {
    if (filtered) return;
    trigger.current = from;
    setSelected(id);
  }
  function card(item: Summary, prominent = false, activeArea = false) {
    // The section heading already says "Active now"; only a different emphasis earns a badge.
    const featuredLabel = view.board?.activeFeaturedLabel;
    const label = prominent
      ? (featuredLabel && featuredLabel !== "Active now" ? featuredLabel : null)
      : !activeArea && false
        ? "Needs attention"
        : !activeArea && item.leader
          ? item.tied
            ? "Most results · tied"
            : "Most results"
          : null;
    const hasData = item.metrics.spend !== null;
    const inactive = item.delivery !== "ACTIVE";
    // A healthy ad set needs no badge: only something to look at earns one.
    const badge = item.state && item.state !== "Insufficient data" && item.state !== "Paused" && item.state !== "Healthy";
    return (
      <article
        key={item.id}
        className={`${classes.adCard} ${prominent ? classes.featured : ""}`}
        aria-labelledby={`ad-${item.id}`}
      >
        <div className={classes.adMedia}>
          <MediaImage
            media={item.media.find((m) => m.image) ?? item.media[0]}
            name={item.name}
            labelPosition="top"
            dashboard
          />
          {label && <span className={classes.featureLabel}>{label}</span>}
          <span className={classes.openCreative} aria-hidden="true">
            <IconArrowUpRight size={18} />
          </span>
        </div>
        <div className={`${classes.adBody} ${parts.body}`}>
          <h3>
            {/* Stretched control: the whole card opens details, but only the name is announced. */}
            <button
              type="button"
              id={`ad-${item.id}`}
              className={classes.cardOpen}
              aria-disabled={filtered}
              title={filtered ? "Detailed history uses combined Meta data. Switch to All Meta to open it." : undefined}
              onClick={(event) => open(item.id, event.currentTarget)}
            >
              {item.name}
            </button>
          </h3>
          {(badge || inactive) && (
            <div className={classes.adState}>
              {badge && <StatusBadge status={item.state!} />}
              {inactive && (
                <span className={classes.delivery} data-delivery={item.delivery}>
                  {item.delivery === "PAUSED" ? "Paused" : item.delivery === "Unknown" ? "Status unavailable" : "Inactive"}
                </span>
              )}
            </div>
          )}
          <RunWindow schedule={item.schedule} />
          <LearningBar learning={signals[item.id]?.learning} />
          {hasData ? (
            <QuickStats metrics={item.metrics} deltas={item.deltas} currency={view.currency} comparison={view.comparison} result={item.result} />
          ) : (
            <p className={classes.insufficient}>No data for {periodLabel === "Today" ? "today" : `the last ${periodLabel}`} yet</p>
          )}
          <div className={classes.cardActions}>
            {!filtered && (
              <button type="button" onClick={(event) => open(item.id, event.currentTarget)}>
                View details
              </button>
            )}
            {assistant && <button
              type="button"
              onClick={() =>
                askDeepVisor(
                  `How is my ad set "${item.name}" doing over the ${periodLabel === "Today" ? "day so far" : `last ${periodLabel}`}, and what should I do next?`,
                )
              }
            >
              <IconSparkles size={14} aria-hidden="true" /> Ask DeepVisor
            </button>}
          </div>
        </div>
      </article>
    );
  }
  return (
    <>
      <div className={classes.boardHeader}>
        <h2>{featured && <LiveIndicator label={null} title="Ad sets delivering now" />} Your advertising</h2>
        <Link href="/campaigns">
          Campaigns <IconArrowUpRight size={15} />
        </Link>
      </div>
      {filtered && <p className={classes.quiet}>Performance is filtered by delivery platform. Current status and health describe the whole Meta ad set.</p>}
      {featured ? (
        <div
          className={`${classes.adBoard} ${active.length === 1 ? classes.singleActive : ""}`}
        >
          {card(featured, true, true)}
          {active.length > 1 && (
            <div className={classes.supporting}>
              {active
                .filter((i) => i.id !== featured.id)
                .map((i) => card(i, false, true))}
            </div>
          )}
        </div>
      ) : (
        <p className={classes.quiet}>{filtered ? "No active ad sets with recorded delivery for this platform and period." : "No active ad sets right now"}</p>
      )}
      {!!view.warnings.length && (
        <details className={classes.boardNotes}>
          <summary>Some details are unavailable</summary>
          {view.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      )}
      <AdSetDrawer
        key={`${selected ?? "closed"}:${view.period}:${view.accountId}`}
        account={view.accountId}
        adset={selected}
        period={view.period}
        onClose={() => {
          setSelected(null);
          requestAnimationFrame(() =>
            trigger.current?.focus({ preventScroll: true }),
          );
        }}
      />
    </>
  );
}
