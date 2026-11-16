"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionIcon, Alert, Button, Tooltip } from "@mantine/core";
import RangeSwitch, { RANGE_LABELS } from "@/components/design/RangeSwitch";
import { IconRefresh, IconBrandFacebook, IconBrandInstagram, IconBrandMeta } from "@tabler/icons-react";
import type { Period } from "@/lib/server/dashboard/overview/types";

export function PeriodControl({ period }: { period: Period }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <RangeSwitch
      label="Performance period"
      value={period}
      pending={pending}
      options={[
        { value: "today", label: RANGE_LABELS.today },
        { value: "7d", label: RANGE_LABELS["7d"] },
        { value: "30d", label: RANGE_LABELS["30d"] },
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
export function RefreshOverview({ disabled = false, onCompleted, label = 'Refresh Meta data', updatedAt }: { disabled?: boolean; onCompleted?: () => void; label?: string; updatedAt?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
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
        setMessage(`Please wait before refreshing again. Try in ${Math.max(1, Math.ceil((Number(body.retryAfterMs) || 30000) / 1000))} seconds.`);
        return;
      }
      if (!response.ok || !body.success || !body.jobId) throw new Error('Refresh request failed');
      setMessage(body.message || 'Refresh in progress.');
      const deadline = Date.now() + 5 * 60_000;
      for (let attempt = 0; attempt < 100 && Date.now() < deadline; attempt++) {
        if (abort.signal.aborted) return;
        await new Promise<void>(resolve => setTimeout(resolve, 3000));
        if (Date.now() >= deadline || abort.signal.aborted) break;
        const statusResponse = await fetch(`/api/sync/refresh?jobId=${encodeURIComponent(body.jobId)}`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now())))]), cache: 'no-store' });
        const status = await statusResponse.json();
        if (!statusResponse.ok || !status.success) throw new Error('Refresh status unavailable');
        if (status.status === 'completed' && status.completedAt) {
          setMessage(status.unchanged === true
            ? 'Refresh completed. Dashboard statistics are unchanged.'
            : `Meta data updated · ${new Date(status.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
          onCompleted?.();
          router.refresh();
          return;
        }
        if (status.status === 'failed' || status.status === 'partial') throw new Error('Refresh did not complete');
      }
      setMessage('Refresh is still in progress. Status checking has stopped; check again shortly.');
    } catch (error) {
      if (abort.signal.aborted) return;
      console.error('Overview refresh unavailable', error);
      setFailed(true);
      setMessage(
        'Could not confirm a completed Meta refresh. Some data may have updated; check your connection before trying again.',
      );
    } finally {
      setLoading(false);
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
          Refresh<span style={{ fontWeight: 500, opacity: .7, marginLeft: 6 }}>· {updatedLabel(updatedAt)}</span>
        </Button>
      ) : <Tooltip label={loading ? "Refreshing Meta data…" : label}>
        <ActionIcon
          aria-label={loading ? "Refreshing Meta data…" : label}
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
}

function updatedLabel(at: string | null): string {
  if (!at || !Number.isFinite(Date.parse(at))) return 'Not synced yet';
  const date = new Date(at), today = new Date();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toDateString() === today.toDateString() ? `Updated ${time}` : `Updated ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export function PlatformControl({ platform }: { platform: 'combined' | 'facebook' | 'instagram' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <RangeSwitch
      label="Advertising delivery platform"
      value={platform}
      pending={pending}
      options={[
        { value: "combined", label: "All Meta", icon: <IconBrandMeta size={16} aria-hidden /> },
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
