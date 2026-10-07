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
  const featuredId =
    tab === "attention" ? items[0]?.id : view.board?.featuredId;
  const featured = items.find((i) => i.id === featuredId);
  function card(item: Summary, prominent = false) {
    const label = prominent
      ? tab === "attention"
        ? "Needs attention"
        : view.board?.featuredLabel
      : null;
    const hasData =
      item.complete &&
      item.metrics.results !== null &&
      item.metrics.spend !== null;
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
            </dl>
          ) : (
            <p className={classes.insufficient}>Not enough period data</p>
          )}
          <div className={classes.adState}>
            <StatusBadge status={item.state ?? "Insufficient data"} />
            <span className={classes.delivery}>
              {item.delivery === "ACTIVE"
                ? "Active"
                : item.delivery === "PAUSED"
                  ? "Paused"
                  : "Meta"}
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
          <Link href="/campaigns">
            Campaigns <IconArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      {items.length ? (
        <div
          className={`${classes.adBoard} ${!featured ? classes.noFeatured : ""}`}
        >
          {featured && card(featured, true)}
          <div className={classes.supporting}>
            {items
              .filter((i) => i.id !== featured?.id)
              .slice(0, featured ? 4 : 5)
              .map((i) => card(i))}
          </div>
        </div>
      ) : (
        <p className={classes.quiet}>
          {tab === "attention"
            ? view.decisionEvidenceAvailable === false
              ? "Attention status unavailable. Check Decisions for saved records."
              : "No ad sets with recorded open attention."
            : "Your synced ad sets will appear here."}
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
