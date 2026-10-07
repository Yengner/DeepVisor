"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Drawer, SegmentedControl, Select } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconPhoto,
  IconPlayerPlay,
  IconStar,
  IconArrowLeft,
  IconRefresh,
} from "@tabler/icons-react";
import StatusBadge from "@/components/product/StatusBadge";
import OverviewTrend from "@/app/(root)/dashboard/components/OverviewTrend";
import type {
  ExplorationView,
  Media,
  Summary,
  Metrics,
  Period,
} from "@/lib/server/campaigns/exploration/types";
import type { TrendPoint } from "@/lib/server/dashboard/overview/types";
import classes from "./Exploration.module.css";

type Request = {
  account: string;
  level: "campaign" | "adset" | "ad";
  parent?: string | null;
  period: Period;
};
export type ExplorationFetcher = (
  request: Request,
  signal: AbortSignal,
) => Promise<ExplorationView>;
const fetchView: ExplorationFetcher = async (request, signal) => {
  const params = new URLSearchParams({
    account: request.account,
    level: request.level,
    period: request.period,
  });
  if (request.parent) params.set("parent", request.parent);
  const response = await fetch(`/api/campaigns/exploration?${params}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      "Advertising details could not be loaded. Please try again.",
    );
  return response.json();
};
function useExploration(
  request: Request | null,
  loader: ExplorationFetcher,
  revision = 0,
) {
  const [result, setResult] = useState<{
    key: string;
    data?: ExplorationView;
    error?: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = request ? JSON.stringify({ request, retry, revision }) : "";
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    loader((JSON.parse(key) as { request: Request }).request, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: "Advertising details could not be loaded. Please try again.",
          });
      });
    return () => controller.abort();
  }, [key, loader, retry, revision]);
  return {
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    retry: () => setRetry((n) => n + 1),
  };
}
export function ExplorationLoading() {
  return (
    <div
      className={classes.grid}
      role="status"
      aria-label="Loading advertising previews"
    >
      {[0, 1, 2].map((n) => (
        <div key={n} className={classes.skeleton}>
          <div className={classes.skeletonMedia} />
          <div className={classes.skeletonLine} />
          <div className={classes.skeletonLine} />
        </div>
      ))}
    </div>
  );
}
export function MediaImage({
  media,
  name,
  labelPosition,
}: {
  media?: Media;
  name: string;
  labelPosition?: "top";
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = [media?.image, media?.fallbackImage].find(
    (url) => url && !failed.includes(url),
  );
  return (
    <div className={classes.media}>
      {src /* Synced Meta assets have variable hosts and expiring URLs. */ ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed((old) => [...old, src])}
        />
      ) : (
        <span role="img" aria-label={`Preview unavailable for ${name}`}>
          <IconPhoto size={24} />
        </span>
      )}
      {media && media.kind !== "image" && (
        <span
          className={`${classes.mediaLabel} ${labelPosition === "top" ? classes.mediaLabelTop : ""}`}
        >
          {media.kind === "video" && <IconPlayerPlay size={12} />}
          {media.kind === "video" ? "Video" : "Representative asset"}
        </span>
      )}
    </div>
  );
}
const labels: Record<keyof Metrics, string> = {
  spend: "Spend",
  results: "Results",
  costPerResult: "Cost / result",
  impressions: "Impressions",
  clicks: "Clicks",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  reach: "Reach",
  frequency: "Frequency",
  linkClicks: "Link clicks",
};
function format(
  key: keyof Metrics,
  value: number | null,
  currency: string | null,
) {
  if (value === null) return "Unavailable";
  if (["spend", "costPerResult", "cpc", "cpm"].includes(key))
    return currency
      ? new Intl.NumberFormat("en", {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(value)
      : "Unavailable";
  return (
    new Intl.NumberFormat("en", {
      maximumFractionDigits: key === "ctr" || key === "frequency" ? 2 : 0,
    }).format(value) + (key === "ctr" ? "%" : "")
  );
}
function ChangedValue({
  value,
  identity,
}: {
  value: string;
  identity: string;
}) {
  const previous = useRef({ value, identity });
  const element = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const changed =
      previous.current.identity === identity &&
      previous.current.value !== value;
    previous.current = { value, identity };
    if (
      changed &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const animation = element.current?.animate(
        [{ backgroundColor: "#dceee3" }, { backgroundColor: "transparent" }],
        { duration: 450, easing: "ease-out" },
      );
      return () => animation?.cancel();
    }
  }, [value, identity]);
  return <span ref={element}>{value}</span>;
}
function MetricList({
  item,
  currency,
  expanded = false,
  keys: selectedKeys,
  period,
}: {
  item: Summary;
  currency: string | null;
  expanded?: boolean;
  keys?: Array<keyof Metrics>;
  period: Period;
}) {
  const keys: Array<keyof Metrics> =
    selectedKeys ??
    (expanded
      ? [
          "spend",
          "results",
          "costPerResult",
          "impressions",
          "clicks",
          "ctr",
          "cpc",
          "cpm",
          "linkClicks",
          ...(period === "today" ? (["reach", "frequency"] as const) : []),
        ]
      : ["spend", "results", "costPerResult"]);
  return (
    <dl
      className={`${classes.metrics} ${expanded ? classes.expanded : ""} ${keys.length === 4 ? classes.fourMetrics : ""}`}
    >
      {keys.map((key) => {
        const change = item.deltas[key];
        const value = item.metrics[key] ?? null;
        const full = format(key, value, currency);
        const compact =
          !expanded && value !== null && value >= 1000 && currency
            ? new Intl.NumberFormat("en", {
                notation: "compact",
                maximumFractionDigits: 1,
                ...(["spend", "costPerResult", "cpc", "cpm"].includes(key)
                  ? { style: "currency", currency }
                  : {}),
              }).format(value)
            : full;
        return (
          <div key={key}>
            <dt>{labels[key]}</dt>
            <dd title={full} aria-label={full}>
              <ChangedValue
                identity={`${item.id}:${period}:${key}`}
                value={compact}
              />
              {change && change.value !== 0 && (
                <span
                  className={`${classes.delta} ${classes[change.tone]}`}
                  aria-label={`${labels[key]} ${change.value > 0 ? "increased" : "decreased"} by ${Math.abs(change.value).toFixed(1)} ${change.unit === "pp" ? "percentage points" : "percent"} over completed days`}
                >
                  {change.value > 0 ? "↑" : change.value < 0 ? "↓" : ""}{" "}
                  {Math.abs(change.value).toFixed(1)}
                  {change.unit}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
function DailyValues({
  points,
  currency,
}: {
  points: TrendPoint[];
  currency: string | null;
}) {
  const [day, setDay] = useState<string | null>(points.at(-1)?.day ?? null);
  const point = points.find((p) => p.day === day);
  return (
    <div>
      <Select
        mt="sm"
        label="Day"
        value={day}
        onChange={setDay}
        allowDeselect={false}
        data={points.map((p) => ({
          value: p.day,
          label: `${p.day}${p.current ? " · Today, partial" : ""}`,
        }))}
      />
      {point && (
        <dl className={classes.metrics}>
          {(["spend", "results", "costPerResult"] as const).map((key) => (
            <div key={key}>
              <dt>{labels[key]}</dt>
              <dd>{format(key, point[key], currency)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
function CreativeCard({
  item,
  view,
  onSelect,
  selected = false,
}: {
  item: Summary;
  view: ExplorationView;
  onSelect: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${classes.card} ${selected ? classes.selected : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className={classes.strip}>
        {item.media.length ? (
          item.media.map((media) => (
            <MediaImage key={media.creativeId} media={media} name={item.name} />
          ))
        ) : (
          <MediaImage name={item.name} />
        )}
      </div>
      <h3>{item.name}</h3>
      <div className={classes.tags}>
        <StatusBadge status={item.delivery} />
        {item.state && <StatusBadge status={item.state} />}
      </div>
      {item.level === "ad" && item.leader && (
        <Badge
          color="green"
          variant="light"
          leftSection={<IconStar size={12} />}
          size="sm"
        >
          {item.tied ? "Joint most results" : "Most results"}
        </Badge>
      )}
      <MetricList item={item} currency={view.currency} period={view.period} />
      {item.strongest && (
        <p className={classes.subtle}>{item.strongest} · selected period</p>
      )}
      {!item.complete && (
        <p className={classes.subtle}>Incomplete period data</p>
      )}
    </button>
  );
}
function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (value: Period) => void;
}) {
  return (
    <SegmentedControl
      aria-label="Performance period"
      size="sm"
      radius={6}
      value={value}
      onChange={(v) => onChange(v as Period)}
      data={[
        { label: "Today", value: "today" },
        { label: "7D", value: "7d" },
        { label: "30D", value: "30d" },
      ]}
    />
  );
}
function PeriodNote({ view }: { view: ExplorationView }) {
  return (
    <>
      <p className={classes.subtle}>
        {view.since} to {view.today} · Today is partial · {view.zone} · Results
        include leads, messages and calls
      </p>
      {view.comparison && <p className={classes.subtle}>{view.comparison}</p>}
      {view.warnings.map((warning) => (
        <p role="status" className={classes.error} key={warning}>
          {warning}
        </p>
      ))}
    </>
  );
}
function MetaPreview({ media, view }: { media: Media; view: ExplorationView }) {
  const [state, setState] = useState<{
    body?: string;
    loading?: boolean;
    error?: boolean;
  }>({});
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function preview() {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setState({ loading: true });
    try {
      const params = new URLSearchParams({
        platformId: view.integrationId,
        accountId: view.accountId,
        creativeId: media.creativeId,
        previewTypes: "MOBILE_FEED_STANDARD",
      });
      const res = await fetch(`/api/meta/previews?${params}`, {
        signal: abort.signal,
      });
      const data = await res.json();
      const body = data?.data?.previews?.MOBILE_FEED_STANDARD?.body;
      if (!res.ok || typeof body !== "string" || !body)
        throw new Error("Preview unavailable");
      if (!abort.signal.aborted) setState({ body });
    } catch {
      if (!abort.signal.aborted) setState({ error: true });
    } finally {
      controller.current = null;
    }
  }
  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={preview}
        loading={state.loading}
        leftSection={<IconPlayerPlay size={15} />}
      >
        Preview on Meta
      </Button>
      {state.error && (
        <p role="status" className={classes.error}>
          Meta preview is unavailable. The synced thumbnail is still shown when
          available.
        </p>
      )}
      {state.body && (
        <iframe
          className={classes.preview}
          title="Meta ad preview"
          sandbox="allow-scripts allow-popups"
          referrerPolicy="no-referrer"
          srcDoc={state.body}
        />
      )}
    </>
  );
}
function DetailContent({
  view,
  adId,
  setAdId,
}: {
  view: ExplorationView;
  adId: string | null;
  setAdId: (id: string | null) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(12);
  const ad = view.items.find((i) => i.id === adId),
    unit = view.detail!.unit;
  const selected = ad ?? unit;
  return (
    <div className={classes.drawer}>
      <div>
        <p className={classes.subtle}>
          {view.accountName} / {view.detail!.campaign}
        </p>
        <h2>{unit.name}</h2>
        <div className={classes.tags}>
          <StatusBadge status={unit.delivery} />
          {unit.state && <StatusBadge status={unit.state} />}
        </div>
        <p className={classes.subtle}>
          {view.detail!.budget ?? "Budget unavailable"}
          {view.detail!.budgetAsOf
            ? ` · Last recorded ${new Date(view.detail!.budgetAsOf).toLocaleDateString()}`
            : ""}
        </p>
      </div>
      <section>
        <MetricList
          item={unit}
          currency={view.currency}
          period={view.period}
          keys={["spend", "results", "costPerResult", "ctr"]}
          expanded
        />
        <details className={classes.disclosure}>
          <summary>More ad-set metrics</summary>
          <MetricList
            item={unit}
            currency={view.currency}
            period={view.period}
            keys={[
              "cpc",
              "cpm",
              ...(view.period === "today" ? ["frequency" as const] : []),
            ]}
            expanded
          />
          {view.period !== "today" && (
            <p className={classes.subtle}>
              Exact full-period frequency is not available.
            </p>
          )}
        </details>
        <div className={classes.toolbar}>
          <h2>Ads in this ad set</h2>
          {ad && (
            <Button
              variant="subtle"
              onClick={() => setAdId(null)}
              leftSection={<IconArrowLeft size={15} />}
            >
              Ad-set totals
            </Button>
          )}
        </div>
        <div className={classes.creativeSelector}>
          {view.items.slice(0, visibleCount).map((item) => (
            <button
              type="button"
              key={item.id}
              className={classes.selectorItem}
              aria-pressed={adId === item.id}
              onClick={() => setAdId(item.id)}
              aria-label={`Select ad ${item.name}`}
            >
              <MediaImage media={item.media[0]} name={item.name} />
              <span>{item.name}</span>
              <small>
                {item.metrics.results === null
                  ? "Not enough data"
                  : `${format("results", item.metrics.results, view.currency)} results`}
              </small>
            </button>
          ))}
        </div>
        {view.items.length > visibleCount && (
          <Button
            variant="default"
            mt="sm"
            onClick={() => setVisibleCount((n) => n + 12)}
          >
            Show more ads
          </Button>
        )}
        {!view.items.length && (
          <p className={classes.subtle}>No synced ads in this ad set.</p>
        )}
        {view.items.some((i) => i.leader) && (
          <p className={classes.subtle}>
            {view.items.some((i) => i.tied)
              ? "Most results · tied"
              : "Most results · selected period"}
          </p>
        )}
      </section>
      <section aria-live="polite">
        {ad && (
          <>
            <div className={classes.detail}>
              <div className={classes.detailMedia}>
                <MediaImage media={ad.media[0]} name={ad.name} />
              </div>
              <div>
                <h2>{ad.name}</h2>
                <h3>{ad.media[0]?.headline}</h3>
              </div>
            </div>
            <p className={classes.subtle}>
              {ad.complete
                ? "Ad performance · Not individual asset variations"
                : "Not enough period data"}
            </p>
          </>
        )}
        {ad && (
          <MetricList
            key={`${selected.id}:${view.period}`}
            item={selected}
            currency={view.currency}
            expanded
            keys={["results", "costPerResult", "clicks", "ctr"]}
            period={view.period}
          />
        )}
        <details className={classes.disclosure}>
          <summary>Performance details</summary>
          <MetricList
            item={selected}
            currency={view.currency}
            period={view.period}
            keys={[
              "spend",
              "cpc",
              "cpm",
              "impressions",
              "linkClicks",
              ...(view.period === "today"
                ? ["reach" as const, "frequency" as const]
                : []),
            ]}
            expanded
          />
          <PeriodNote view={view} />
          {ad && <p>{ad.media[0]?.text}</p>}
          {view.period !== "today" && (
            <p className={classes.subtle}>
              Exact full-period reach and frequency are not available.
            </p>
          )}
        </details>
      </section>
      <section>
        <h2>{ad ? "Ad trend" : "Ad-set trend"}</h2>
        {view.period === "today" && (
          <p className={classes.subtle}>
            Seven-day daily trend · Today highlighted
          </p>
        )}
        <OverviewTrend
          points={
            ad ? (view.detail!.adPoints[ad.id] ?? []) : view.detail!.points
          }
          currency={view.currency}
        />
        <details className={classes.disclosure}>
          <summary>Daily values</summary>
          <DailyValues
            key={`${selected.id}:${view.period}`}
            points={
              ad ? (view.detail!.adPoints[ad.id] ?? []) : view.detail!.points
            }
            currency={view.currency}
          />
        </details>
      </section>
      {ad?.media[0] && (
        <details className={classes.disclosure}>
          <summary>Meta preview</summary>
          <MetaPreview key={ad.id} media={ad.media[0]} view={view} />
        </details>
      )}
      {!!view.detail!.recommendations.length && (
        <section>
          <h2>DeepVisor · Ad set</h2>
          {view.detail!.recommendations.map((r, i) => (
            <div key={i}>
              <div className={classes.tags}>
                <StatusBadge status={r.state} />
                {r.mode && <StatusBadge status={r.mode} />}
              </div>
              <h3>{r.title}</h3>
              <details className={classes.disclosure}>
                <summary>Evidence</summary>
                <p>{r.reason}</p>
                {r.detail && <p className={classes.subtle}>{r.detail}</p>}
                <p className={classes.subtle}>
                  {r.evidence} {r.period}
                </p>
                {r.confidence !== null && (
                  <p className={classes.subtle}>
                    Confidence {Math.round(r.confidence * 100)}%
                  </p>
                )}
              </details>
            </div>
          ))}
          <Link href="/decisions">Review in Decisions</Link>
        </section>
      )}
    </div>
  );
}
export function AdSetDrawer({
  account,
  adset,
  period: initialPeriod,
  onClose,
  loader = fetchView,
  initialAd,
}: {
  account: string;
  adset: string | null;
  period: Period;
  onClose: () => void;
  loader?: ExplorationFetcher;
  initialAd?: string;
}) {
  const mobile = useMediaQuery("(max-width: 48em)");
  const [period, setPeriod] = useState(initialPeriod);
  const [adId, setAdId] = useState<string | null>(initialAd ?? null);
  const { data, error, retry } = useExploration(
    adset ? { account, parent: adset, level: "ad", period } : null,
    loader,
  );
  return (
    <Drawer
      opened={!!adset}
      onClose={onClose}
      position="right"
      size={mobile ? "100%" : 820}
      padding={mobile ? 16 : 24}
      title="Explore ad set"
      className={classes.surface}
    >
      <div className={classes.toolbar}>
        <PeriodPicker value={period} onChange={setPeriod} />
        <Button
          variant="subtle"
          onClick={retry}
          leftSection={<IconRefresh size={15} />}
        >
          Reload
        </Button>
      </div>
      {error ? (
        <div role="status" className={classes.error}>
          {error}
          <Button variant="subtle" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : data?.detail ? (
        <DetailContent key={adset} view={data} adId={adId} setAdId={setAdId} />
      ) : (
        <ExplorationLoading />
      )}
    </Drawer>
  );
}
export function OverviewCreatives({
  view,
  loader = fetchView,
}: {
  view: ExplorationView;
  loader?: ExplorationFetcher;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ad, setAd] = useState<string | undefined>();
  return (
    <div className={classes.surface}>
      <div className={classes.grid}>
        {view.items.map((item) => (
          <CreativeCard
            key={item.id}
            item={item}
            view={view}
            onSelect={() => setSelected(item.id)}
          />
        ))}
      </div>
      {!view.items.length && (
        <p>Ad sets will appear after your account has synced.</p>
      )}
      <PeriodNote view={view} />
      {!!view.pulse.length && (
        <section className={classes.pulse}>
          <h3>Creative pulse</h3>
          <p className={classes.subtle}>
            Most results within their ad sets · selected period
          </p>
          <div className={classes.grid}>
            {view.pulse.map((p) => (
              <CreativeCard
                key={`${p.adsetId}:${p.item.id}`}
                item={p.item}
                view={view}
                onSelect={() => {
                  setAd(p.item.id);
                  setSelected(p.adsetId);
                }}
              />
            ))}
          </div>
        </section>
      )}
      <AdSetDrawer
        key={`${selected}:${ad}:${view.period}`}
        account={view.accountId}
        adset={selected}
        initialAd={ad}
        period={view.period}
        onClose={() => {
          setSelected(null);
          setAd(undefined);
        }}
        loader={loader}
      />
    </div>
  );
}
export default function CampaignExplorer({
  account,
  level,
  parent,
  campaignIds,
  onCampaign,
  onAdSet,
  loader = fetchView,
  revision = 0,
}: {
  account: string;
  level: "campaign" | "adset" | "ad";
  parent: string | null;
  campaignIds?: string[];
  onCampaign: (id: string) => void;
  onAdSet?: (id: string) => void;
  loader?: ExplorationFetcher;
  revision?: number;
}) {
  const [period, setPeriod] = useState<Period>("7d");
  const [selection, setSelection] = useState<{
    adset: string;
    ad?: string;
  } | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const scope = `${account}:${level}:${parent}`;
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope);
    setVisibleCount(12);
    setSelection(null);
  }
  const { data, error, retry } = useExploration(
    { account, level, parent, period },
    loader,
    revision,
  );
  const visible =
    data?.items.filter(
      (i) => level !== "campaign" || !campaignIds || campaignIds.includes(i.id),
    ) ?? [];
  return (
    <div className={classes.surface}>
      <div className={classes.toolbar}>
        <span>
          {data?.parent?.name ?? "Selected account"} /{" "}
          {level === "campaign"
            ? "Campaigns"
            : level === "adset"
              ? "Ad sets"
              : "Ads"}
        </span>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      {error ? (
        <div role="status" className={classes.error}>
          {error}
          <Button variant="subtle" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <ExplorationLoading />
      ) : (
        <>
          <div className={classes.grid}>
            {visible.slice(0, visibleCount).map((item) => (
              <CreativeCard
                key={item.id}
                item={item}
                view={data}
                onSelect={() => {
                  if (level === "campaign") onCampaign(item.id);
                  else {
                    const adset = level === "ad" ? parent! : item.id;
                    onAdSet?.(adset);
                    setSelection({
                      adset,
                      ad: level === "ad" ? item.id : undefined,
                    });
                  }
                }}
              />
            ))}
          </div>
          {visible.length > visibleCount && (
            <Button
              variant="default"
              mt="sm"
              onClick={() => setVisibleCount((n) => n + 12)}
            >
              Show more{" "}
              {level === "campaign"
                ? "campaigns"
                : level === "adset"
                  ? "ad sets"
                  : "ads"}
            </Button>
          )}
          {!visible.length && (
            <p>
              No synced{" "}
              {level === "campaign"
                ? "campaigns match these filters"
                : level === "adset"
                  ? "ad sets in this campaign"
                  : "ads in this ad set"}
              .
            </p>
          )}
          <PeriodNote view={data} />
        </>
      )}
      <AdSetDrawer
        key={`${selection?.adset}:${selection?.ad}:${period}`}
        account={account}
        adset={selection?.adset ?? null}
        initialAd={selection?.ad}
        period={period}
        onClose={() => setSelection(null)}
        loader={loader}
      />
    </div>
  );
}
