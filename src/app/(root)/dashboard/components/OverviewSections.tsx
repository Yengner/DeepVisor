import Link from "next/link";
import StatusBadge from '@/components/product/StatusBadge';
import { monitoringSummary } from '@/components/product/presentation';
export { default as SectionLoading } from '@/components/product/SectionSkeleton';
import { IconArrowRight, IconClock } from "@tabler/icons-react";
import type {
  AttentionItem,
  DecisionsView,
  PerformanceView,
} from "@/lib/server/dashboard/overview/types";
import classes from "./Overview.module.css";

export function Badge({ children }: { children: string }) {
  return <StatusBadge status={children}/>;
}
export function money(value: number | null, currency: string | null) {
  return value === null
    ? "Unavailable"
    : currency
      ? new Intl.NumberFormat("en", {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(value)
      : "Unavailable";
}
export function number(value: number | null) {
  return value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en").format(value);
}
export function Unavailable({ children }: { children: string }) {
  return (
    <p className={classes.error} role="status">
      {children}
    </p>
  );
}
export function PerformanceMetrics({
  view,
  profileUnavailable,
}: {
  view: PerformanceView;
  profileUnavailable: boolean;
}) {
  return (
    <>
      <dl className={classes.metrics}>
        <div className={classes.metric}>
          <dt>Spend</dt>
          <dd>{money(view.metrics.spend, view.currency)}</dd>
        </div>
        <div className={classes.metric}>
          <dt>Results</dt>
          <dd>{number(view.metrics.results)}</dd>
        </div>
        <div className={classes.metric}>
          <dt>Cost per result</dt>
          <dd>{money(view.metrics.costPerResult, view.currency)}</dd>
        </div>
        <div className={`${classes.metric} ${classes.target}`}>
          <dt>Saved lead-cost target</dt>
          <dd>
            {profileUnavailable
              ? "Unavailable"
              : (view.targetLabel ?? "Not configured")}
          </dd>
          {view.targetLabel && (
            <p className={classes.subtle}>Target comparison unavailable</p>
          )}
        </div>
      </dl>
      <p className={classes.subtle}>
        {view.since} to {view.until} · Includes today, partial · Leads, messages
        and calls
        {view.missingDays > 0
          ? ` · ${view.missingDays} day${view.missingDays === 1 ? "" : "s"} without recorded data`
          : ""}
      </p>
    </>
  );
}
export function Attention({
  items,
  target,
}: {
  items: AttentionItem[];
  target: string | null;
}) {
  return items.length ? (
    <>
      {items.map((item, i) => (
        <article className={classes.attentionCard} key={i}>
          <div className={classes.tags}>
            <Badge>{item.state}</Badge>
            {item.mode && <Badge>{item.mode}</Badge>}
          </div>
          <h3>{item.entity}</h3>
          <strong>{item.title}</strong>
          <p className={classes.subtle}>{item.reason}</p>
          {item.detail && <p className={classes.subtle}>{item.detail}</p>}
          {item.evidence && (
            <p className={classes.subtle}>
              {item.evidence}
              {item.period ? ` · ${item.period}` : ""}
            </p>
          )}
          {target && (
            <p className={classes.subtle}>
              Saved lead-cost target: {target} · Comparison unavailable
            </p>
          )}
          {item.confidence !== null && (
            <p className={classes.subtle}>
              Confidence {Math.round(item.confidence * 100)}%
            </p>
          )}
          <Link href="/decisions" className={classes.link}>
            Review decision <IconArrowRight size={15} />
          </Link>
        </article>
      ))}
    </>
  ) : (
    <p className={classes.empty}>
      Nothing needs your attention right now.{" "}
      <Link href="/decisions" className={classes.link}>
        View decisions
      </Link>
    </p>
  );
}
export function Monitoring({ view }: { view: DecisionsView }) {
  const c = view.counts;
  return (
    <>
      <p className={classes.subtle}>{monitoringSummary(c.evaluations,c.holds)}</p>
      <p className={classes.subtle}>
        {number(c.checked)} ad sets checked today
      </p>
      <dl className={classes.counts}>
        {(
          [
            ["Evaluations", c.evaluations],
            ["No change recommended", c.holds],
            ["Recommendations", c.recommendations],
            ["Blocked", c.blocked],
            ["Approval required", c.approvals],
            ["Shadow observations", c.shadow],
            ["Executed actions", c.executed],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={classes.count}>
            <dt>{label}</dt>
            <dd>{number(value)}</dd>
          </div>
        ))}
      </dl>
      <p className={classes.subtle}>
        Evaluation categories can overlap. Executions are counted separately.
      </p>
      {view.provenanceUnavailable && (
        <p className={classes.subtle}>Some evaluation modes are unavailable.</p>
      )}
    </>
  );
}
export function Activity({
  view,
  zone,
}: {
  view: DecisionsView;
  zone: string;
}) {
  return (
    <>
      {view.activity.length ? (
        <ol className={classes.feed}>
          {view.activity.map((item, i) => (
            <li className={classes.event} key={i}>
              <IconClock size={17} />
              <div>
                <strong>{item.title}</strong>
                <p className={classes.subtle}>{item.entity}</p>
                <div className={classes.tags}>
                  <Badge>{item.state}</Badge>
                  {item.mode && <Badge>{item.mode}</Badge>}
                </div>
              </div>
              <time dateTime={item.at}>
                {new Intl.DateTimeFormat("en", {
                  timeZone: zone,
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(item.at))}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className={classes.empty}>No recorded DeepVisor activity today.</p>
      )}
      {view.outcomesUnavailable && (
        <p className={classes.subtle}>
          Performance observations are temporarily unavailable.
        </p>
      )}
    </>
  );
}
export function TopUnits({ view }: { view: PerformanceView }) {
  return view.units.length ? (
    <table className={classes.table}>
      <thead>
        <tr>
          <th>Ad set / state</th>
          <th>Spend</th>
          <th>Results</th>
          <th>Cost / result</th>
        </tr>
      </thead>
      <tbody>
        {view.units.map((unit, i) => (
          <tr key={i}>
            <td>
              <span>{unit.name}</span>
              <span>
                <Badge>{unit.state}</Badge>
              </span>
            </td>
            <td data-label="Spend">{money(unit.spend, view.currency)}</td>
            <td data-label="Results">{number(unit.results)}</td>
            <td data-label="Cost / result">
              {money(unit.costPerResult, view.currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p className={classes.empty}>
      Ad sets will appear after your account has synced.
    </p>
  );
}
