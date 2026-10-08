"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";
import type {
  ExplorationView,
  Summary,
} from "@/lib/server/campaigns/exploration/types";
import {
  AdSetDrawer,
  MediaImage,
} from "@/components/campaigns/exploration/AdvertisingExplorer";
import StatusBadge from "@/components/product/StatusBadge";
import { metricValue, MetricDelta } from "./ControlMetrics";
import classes from "./ControlCenter.module.css";

export default function AdvertisingBoard({ view }: { view: ExplorationView }) {
  const [tab, setTab] = useState("highlights");
  const [selected, setSelected] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const ids =
    tab === "attention"
      ? (view.board?.attentionIds ?? [])
      : (view.board?.highlightIds ?? view.items.map((i) => i.id));
  const items = ids.flatMap((id) => view.items.find((i) => i.id === id) ?? []);
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
  function card(item: Summary, prominent = false, activeArea = false) {
    const label = prominent
      ? (view.board?.activeFeaturedLabel ?? "Active now")
      : !activeArea && tab === "attention"
        ? "Needs attention"
        : !activeArea && item.leader
          ? item.tied
            ? "Most results · tied"
            : "Most results"
          : null;
    const hasData =
      item.metrics.results !== null && item.metrics.spend !== null;
    return (
      <button
        type="button"
        key={item.id}
        className={`${classes.adCard} ${prominent ? classes.featured : ""}`}
        onClick={(event) => {
          trigger.current = event.currentTarget;
          setSelected(item.id);
        }}
        aria-label={`Explore ad set ${item.name}`}
      >
        <div className={classes.adMedia}>
          <MediaImage
            media={item.media.find((m) => m.image) ?? item.media[0]}
            name={item.name}
            labelPosition="top"
            dashboard
          />
          {label && <span className={classes.featureLabel}>{label}</span>}
          <span className={classes.openCreative}>
            <IconArrowUpRight size={18} />
          </span>
        </div>
        <div className={classes.adBody}>
          <h3>{item.name}</h3>
          {hasData ? (
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
          {hasData && (
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
              {!item.complete && (
                <span className={classes.delivery}>
                  Recorded data · partial period
                </span>
              )}
            </>
          )}
          <div className={classes.adState}>
            {item.state &&
              item.state !== "Insufficient data" &&
              item.state !== "Paused" && <StatusBadge status={item.state} />}
            <span className={classes.delivery}>
              {item.delivery === "ACTIVE"
                ? "Active"
                : item.delivery === "PAUSED"
                  ? "Paused"
                  : item.delivery === "Unknown"
                    ? "Status unavailable"
                    : "Inactive"}
            </span>
          </div>
        </div>
      </button>
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
        Active now <span>{periodLabel} performance</span>
      </h3>
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
        <p className={classes.quiet}>No active ad sets right now</p>
      )}
      <div className={classes.historyHeader}>
        <h3 className={classes.boardSubheading}>
          {tab === "attention" ? "Needs attention" : "Highlights"}{" "}
          <span>{periodLabel}</span>
        </h3>
        <div className={classes.boardActions}>
          <div
            className={classes.boardTabs}
            role="group"
            aria-label="Advertising view"
          >
            <button
              type="button"
              aria-pressed={tab === "highlights"}
              onClick={() => setTab("highlights")}
            >
              Highlights
            </button>
            <button
              type="button"
              aria-pressed={tab === "attention"}
              onClick={() => setTab("attention")}
            >
              Needs attention
            </button>
          </div>
        </div>
      </div>
      {items.length ? (
        <div className={`${classes.adBoard} ${classes.noFeatured}`}>
          <div className={classes.supporting}>
            {items.slice(0, 5).map((i) => card(i))}
          </div>
        </div>
      ) : (
        <p className={classes.quiet}>
          {tab === "attention"
            ? view.decisionEvidenceAvailable === false
              ? "Attention status unavailable. Check Decisions for saved records."
              : "No ad sets with recorded open attention."
            : "No recorded delivery in this period."}
        </p>
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
