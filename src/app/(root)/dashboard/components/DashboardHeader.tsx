import type { ReactNode } from "react";
import type { Period } from "@/lib/server/dashboard/overview/types";
import { PeriodControl, PlatformControl } from "./OverviewControls";
import classes from "./ControlCenter.module.css";

/**
 * Who this is for and how to slice it. Nothing here repeats itself: housekeeping (when the numbers
 * were read, limited comparisons, recovery) lives behind `info`, and `notice` is set only when the
 * numbers are stale or unavailable.
 */
export default function DashboardHeader({ businessName, accountName, platform, period, insights, info, notice }: {
  businessName: string;
  accountName: string;
  platform: "combined" | "facebook" | "instagram";
  period: Period;
  insights?: ReactNode;
  info: ReactNode;
  notice?: string | null;
}) {
  return (
    <>
      <header className={classes.workspaceHeader}>
        <div>
          <h1>{businessName}</h1>
          <p>{accountName}</p>
          {insights}
        </div>
        <div className={classes.headerControls}>
          <PlatformControl platform={platform} />
          <PeriodControl period={period} />
          <div className={classes.infoSlot}>{info}</div>
        </div>
      </header>
      {notice ? <p className={classes.dataNotice} role="status">{notice}</p> : null}
    </>
  );
}
