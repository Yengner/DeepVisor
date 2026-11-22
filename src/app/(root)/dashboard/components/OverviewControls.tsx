"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionIcon, Alert, Button, Tooltip } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import RangeSwitch from "@/components/design/RangeSwitch";
import { IconRefresh, IconBrandFacebook, IconBrandInstagram, IconBrandMeta } from "@tabler/icons-react";
import type { Period } from "@/lib/server/dashboard/overview/types";
import { setSyncActivity } from "@/components/integrations/syncActivity";

export function PeriodControl({ period }: { period: Period }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const t = useTranslations("controls");
  return (
    <RangeSwitch
      label={t("period")}
      value={period}
      pending={pending}
      options={[
        { value: "today", label: t("range.today") },
        { value: "7d", label: t("range.7d") },
        { value: "30d", label: t("range.30d") },
      ]}
      onChange={(value) => {
        const next = new URLSearchParams(params);
        next.set("period", value);
        start(() => router.replace(`/dashboard?${next}`, { scroll: false }));
      }}
    />
  );
}
/**
 * `updatedAt` turns the icon into a labeled control ("Refresh · Updated 1:34 PM") so the page says
 * which data it refreshes and how current it is.
 */
export function RefreshOverview({ disabled = false, onCompleted, label: labelProp, updatedAt, visibleLabel = false }: { disabled?: boolean; onCompleted?: () => void; label?: string; updatedAt?: string | null; /** Show the label as text instead of an icon-only button. */ visibleLabel?: boolean }) {
  const t = useTranslations("controls");
  const intl = useLocale() === "es" ? "es-US" : "en-US";
  const label = labelProp ?? t("refreshMeta");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); setSyncActivity("manual", false); }, []);
  const refresh = async () => {
    if (pending.current || disabled) return;
    pending.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setMessage(null);
    setFailed(false);
    try {
      const response = await fetch("/api/sync/refresh", { method: "POST", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]) });
      const body = await response.json();
      if (response.status === 429) {
        setMessage(t("wait", { seconds: Math.max(1, Math.ceil((Number(body.retryAfterMs) || 30000) / 1000)) }));
        return;
      }
      if (!response.ok || !body.success || !body.jobId) throw new Error('Refresh request failed');
      // While Meta works, the numbers show the working spider; no "in progress" banner.
      setSyncActivity("manual", true);
      const deadline = Date.now() + 5 * 60_000;
      for (let attempt = 0; attempt < 100 && Date.now() < deadline; attempt++) {
        if (abort.signal.aborted) return;
        await new Promise<void>(resolve => setTimeout(resolve, 3000));
        if (Date.now() >= deadline || abort.signal.aborted) break;
        const statusResponse = await fetch(`/api/sync/refresh?jobId=${encodeURIComponent(body.jobId)}`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now())))]), cache: 'no-store' });
        const status = await statusResponse.json();
        if (!statusResponse.ok || !status.success) throw new Error('Refresh status unavailable');
        if (status.status === 'completed' && status.completedAt) {
          // New numbers roll into place on the cards; the button already shows "Updated <time>".
          onCompleted?.();
          router.refresh();
          return;
        }
        if (status.status === 'failed' || status.status === 'partial') throw new Error('Refresh did not complete');
      }
      setMessage(t("stillRunning"));
    } catch (error) {
      if (abort.signal.aborted) return;
      console.error('Overview refresh unavailable', error);
      setFailed(true);
      setMessage(t("failed"));
    } finally {
      setLoading(false);
      setSyncActivity("manual", false);
      pending.current = false;
    }
  };
  return (
    <div>
      {updatedAt !== undefined ? (
        <Button
          variant="default"
          size="sm"
          radius="xl"
          leftSection={<IconRefresh size={15} />}
          loading={loading}
          disabled={disabled}
          onClick={refresh}
          aria-label={`${label}. ${updatedLabel(updatedAt)}`}
        >
          {t("refresh")}<span style={{ fontWeight: 500, opacity: .7, marginLeft: 6 }}>· {updatedLabel(updatedAt)}</span>
        </Button>
      ) : visibleLabel ? (
        <Button variant="default" size="sm" radius="xl" leftSection={<IconRefresh size={15} aria-hidden="true" />} loading={loading} disabled={disabled} onClick={refresh}>
          {loading ? t("refreshing") : label}
        </Button>
      ) : <Tooltip label={loading ? t("refreshing") : label}>
        <ActionIcon
          aria-label={loading ? t("refreshing") : label}
          variant="default"
          size="lg"
          radius="sm"
          loading={loading}
          disabled={disabled}
          onClick={refresh}
        >
          <IconRefresh size={18} />
        </ActionIcon>
      </Tooltip>}
      {message && (
        <Alert mt="xs" color={failed ? "red" : "blue"} role="status">
          {message}
        </Alert>
      )}
    </div>
  );

  function updatedLabel(at: string | null): string {
    if (!at || !Number.isFinite(Date.parse(at))) return t("notSynced");
    const date = new Date(at), today = new Date();
    const time = date.toLocaleTimeString(intl, { hour: 'numeric', minute: '2-digit' });
    return date.toDateString() === today.toDateString() ? t("updatedToday", { time }) : t("updatedDay", { day: date.toLocaleDateString(intl, { month: 'short', day: 'numeric' }), time });
  }
}

export function PlatformControl({ platform }: { platform: 'combined' | 'facebook' | 'instagram' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const t = useTranslations("controls");
  return (
    <RangeSwitch
      label={t("platform")}
      value={platform}
      pending={pending}
      options={[
        { value: "combined", label: t("allMeta"), icon: <IconBrandMeta size={16} aria-hidden /> },
        { value: "facebook", label: "Facebook", icon: <IconBrandFacebook size={16} color="#1264cc" aria-hidden />, iconOnlyOnPhone: true },
        { value: "instagram", label: "Instagram", icon: <IconBrandInstagram size={16} color="#c13584" aria-hidden />, iconOnlyOnPhone: true },
      ]}
      onChange={(value) => {
        const next = new URLSearchParams(params);
        if (value === "combined") next.delete("publisher");
        else next.set("publisher", value);
        start(() => router.replace(`/dashboard?${next}`, { scroll: false }));
      }}
    />
  );
}
