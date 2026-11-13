"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconSparkles } from "@tabler/icons-react";
import { askDeepVisor } from "@/lib/shared/assistant/askEvent";
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
import AdSignals from "./AdSignals";
import type { AdSignals as AdSignalsData } from "@/lib/server/dashboard/insights/signals";
import { metricValue, MetricDelta } from "./ControlMetrics";
import classes from "./ControlCenter.module.css";

export default function AdvertisingBoard({ view, learning = {}, signals = {}, filtered = false }: { view: ExplorationView; learning?: Record<string, string>; signals?: Record<string, AdSignalsData>; filtered?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
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
    const label = prominent
      ? (view.board?.activeFeaturedLabel ?? "Active now")
      : !activeArea && false
        ? "Needs attention"
        : !activeArea && item.leader
          ? item.tied
            ? "Most results · tied"
            : "Most results"
          : null;
    const hasData =
      item.metrics.results !== null && item.metrics.spend !== null;
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
        <div className={classes.adBody}>
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
          {prominent && hasData ? (
            <>
              <dl className={classes.statGrid}>
                {(["results", "costPerResult", "spend", "ctr"] as const).map((key) => (
                  <div key={key}>
                    <dt>{key === "results" ? "Results" : key === "costPerResult" ? "Cost / result" : key === "spend" ? "Spend" : "CTR"}</dt>
                    <dd>{metricValue(key, item.metrics[key], view.currency, true)}</dd>
                    {(key === "results" || key === "costPerResult") && (
                      <MetricDelta change={item.deltas[key]} description={view.comparison} />
                    )}
                  </div>
                ))}
              </dl>
              <p className={classes.supportMetrics}>
                {[
                  item.metrics.clicks !== null ? `${new Intl.NumberFormat("en").format(item.metrics.clicks)} clicks` : null,
                  item.metrics.impressions !== null ? `${new Intl.NumberFormat("en").format(item.metrics.impressions)} impressions` : null,
                ].filter(Boolean).join(" · ")}
              </p>
            </>
          ) : hasData ? (
            <dl className={classes.adMetrics}>
              <div>
                <dd>
                  {metricValue(
                    "results",
                    item.metrics.results,
                    view.currency,
                    true,
                  )}
                </dd>
                <dt>Results</dt>
                <MetricDelta
                  change={item.deltas.results}
                  description={view.comparison}
                />
              </div>
              {item.metrics.costPerResult !== null && (
                <div>
                  <dd>
                    {metricValue(
                      "costPerResult",
                      item.metrics.costPerResult,
                      view.currency,
                      true,
                    )}
                  </dd>
                  <dt>Cost / result</dt>
                  <MetricDelta
                    change={item.deltas.costPerResult}
                    description={view.comparison}
                  />
                </div>
              )}
            </dl>
          ) : (
            <p className={classes.insufficient}>
              Not enough data in this period
            </p>
          )}
          {hasData && !prominent && (
            <>
              <dl className={classes.secondaryMetrics}>
                <div>
                  <dt>Spend</dt>
                  <dd>
                    {metricValue(
                      "spend",
                      item.metrics.spend,
                      view.currency,
                      true,
                    )}
                  </dd>
                </div>
                {item.metrics.ctr !== null && (
                  <div>
                    <dt>CTR</dt>
                    <dd>
                      {metricValue("ctr", item.metrics.ctr, view.currency)}
                    </dd>
                  </div>
                )}
                {prominent && item.metrics.clicks !== null && (
                  <div>
                    <dt>Clicks</dt>
                    <dd>
                      {new Intl.NumberFormat("en", {
                        notation: "compact",
                      }).format(item.metrics.clicks)}
                    </dd>
                  </div>
                )}
              </dl>
              <p className={classes.supportMetrics}>
                {[
                  item.metrics.impressions !== null
                    ? `${new Intl.NumberFormat("en", { notation: "compact" }).format(item.metrics.impressions)} impressions`
                    : null,
                  prominent &&
                  view.period === "today" &&
                  item.metrics.reach !== null
                    ? `${new Intl.NumberFormat("en", { notation: "compact" }).format(item.metrics.reach)} reach`
                    : null,
                  !prominent && item.metrics.clicks !== null
                    ? `${new Intl.NumberFormat("en", { notation: "compact" }).format(item.metrics.clicks)} clicks`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </>
          )}
          {signals[item.id] ? (
            <AdSignals signals={signals[item.id]} currency={view.currency} />
          ) : null}
          {(() => {
            const badge = item.state && item.state !== "Insufficient data" && item.state !== "Paused";
            // "Active" is implied by the Active now section; only non-active delivery is labeled.
            const inactive = item.delivery !== "ACTIVE";
            if (signals[item.id] && !badge && !inactive) return null;
            return (
              <div className={classes.adState}>
                {!signals[item.id] && <span>Meta learning: {learning[item.id] ?? 'Unavailable'}</span>}
                {badge && <StatusBadge status={item.state!} />}
                {inactive && (
                  <span className={classes.delivery} data-delivery={item.delivery}>
                    {item.delivery === "PAUSED"
                      ? "Paused"
                      : item.delivery === "Unknown"
                        ? "Status unavailable"
                        : "Inactive"}
                  </span>
                )}
              </div>
            );
          })()}
          <div className={classes.cardActions}>
            {!filtered && (
              <button type="button" onClick={(event) => open(item.id, event.currentTarget)}>
                View details
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                askDeepVisor(
                  `How is my ad set "${item.name}" doing over the ${periodLabel === "Today" ? "day so far" : `last ${periodLabel}`}, and what should I do next?`,
                )
              }
            >
              <IconSparkles size={14} aria-hidden="true" /> Ask DeepVisor
            </button>
          </div>
        </div>
      </article>
    );
  }
  return (
    <>
      <div className={classes.boardHeader}>
        <h2>Your advertising</h2>
        <Link href="/campaigns">
          Campaigns <IconArrowUpRight size={15} />
        </Link>
      </div>
      <h3 className={classes.boardSubheading}>
        {featured && <LiveIndicator label={null} title="Ad sets delivering now" />} Active now <span>{periodLabel} performance</span>
      </h3>
      {filtered && <p>Performance is filtered by delivery platform. Current status and health describe the whole Meta ad set.</p>}
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
