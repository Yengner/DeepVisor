"use client";
import Link from "next/link";
import { ActionIcon, Popover } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshOverview } from "./OverviewControls";
import classes from "./DataInfo.module.css";

export type DataInfoProps = {
  /** Ads are delivering today, so the numbers move during the day. */
  live: boolean;
  /** When Meta's numbers were last read, or null when only a saved sync exists. */
  retrievedAt: string | null;
  storedSyncAt: string | null;
  zone: string;
  /** Set when the comparison period has data for only part of its days. */
  coverage: { days: number; observed: number } | null;
  /** The preview mode cannot refresh anything. */
  disabled?: boolean;
};

/**
 * The page's housekeeping in one place: when the numbers were read, why a comparison may be limited,
 * and how to recover saved data. It sits next to the controls instead of repeating itself on the
 * page; the page itself only speaks up when the numbers are actually stale or unavailable.
 */
export default function DataInfo({ live, retrievedAt, storedSyncAt, zone, coverage, disabled = false }: DataInfoProps) {
  const t = useTranslations("dashboardInfo");
  const intl = useLocale() === "es" ? "es-US" : "en-US";
  const when = (at: string | null) =>
    at && Number.isFinite(Date.parse(at))
      ? new Intl.DateTimeFormat(intl, { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(at))
      : null;
  const read = when(retrievedAt);
  const saved = when(storedSyncAt);

  return (
    <Popover width={320} position="bottom-end" shadow="md" radius="md" withArrow withinPortal={false}>
      <Popover.Target>
        <ActionIcon variant="default" size={44} radius="xl" aria-label={t("label")} className={classes.trigger}>
          <IconInfoCircle size={20} aria-hidden="true" />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown className={classes.dropdown}>
        <p className={classes.status}>{read ? t("updated", { time: read }) : saved ? t("storedSync", { time: saved }) : t("savedData")}</p>
        {live ? <p>{t("live")}</p> : null}
        {coverage ? <p>{t("comparison", { days: coverage.days, observed: coverage.observed })}</p> : null}
        <p>{t("attribution")} {t("timezone", { zone })}</p>
        <div className={classes.actions}>
          <RefreshOverview disabled={disabled} label={t("recover")} visibleLabel />
          <Link href="/integration">{t("connection")}</Link>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
