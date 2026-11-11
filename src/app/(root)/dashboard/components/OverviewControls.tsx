"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionIcon, Alert, SegmentedControl, Tooltip } from "@mantine/core";
import { IconRefresh, IconBrandFacebook, IconBrandInstagram } from "@tabler/icons-react";
import type { Period } from "@/lib/server/dashboard/overview/types";

export function PeriodControl({ period }: { period: Period }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <SegmentedControl
      aria-label="Performance period"
      size="sm"
      radius="sm"
      styles={{ label: { minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center" } }}
      value={period}
      disabled={pending}
      data={[
        { value: "today", label: "Today" },
        { value: "7d", label: "7D" },
        { value: "30d", label: "30D" },
      ]}
      onChange={(value) => {
        const next = new URLSearchParams(params);
        next.set("period", value);
        start(() => router.replace(`/dashboard?${next}`, { scroll: false }));
      }}
    />
  );
}
export function RefreshOverview({ disabled = false, onCompleted, label = 'Refresh Meta data' }: { disabled?: boolean; onCompleted?: () => void; label?: string }) {
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
      <Tooltip label={loading ? "Refreshing Meta data…" : label}>
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
      </Tooltip>
      {message && (
        <Alert mt="xs" color={failed ? "red" : "blue"} role="status">
          {message}
        </Alert>
      )}
    </div>
  );
}

export function PlatformControl({ platform }: { platform: 'combined' | 'facebook' | 'instagram' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return <div role="group" aria-label="Advertising delivery platform" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
    {(['facebook', 'instagram'] as const).map(value => <button key={value} type="button" disabled={pending} aria-pressed={platform === value}
      title={`Select ${value}; select again for combined Meta data`} onClick={() => { const next = new URLSearchParams(params); if (platform === value) next.delete('publisher'); else next.set('publisher', value); start(() => router.replace(`/dashboard?${next}`, { scroll: false })); }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '9px 14px', border: platform === value ? '2px solid currentColor' : '1px solid #aebdce', background: platform === value ? value === 'facebook' ? '#e7f0ff' : '#f9e9fa' : 'transparent', color: value === 'facebook' ? '#1264cc' : '#963fa4' }}>
      {value === 'facebook' ? <IconBrandFacebook size={23} /> : <IconBrandInstagram size={23} />}<span>{value === 'facebook' ? 'Facebook' : 'Instagram'}{platform === value ? ' ✓' : ''}</span>
    </button>)}
    <span style={{ alignSelf: 'center', fontSize: 12 }}>{platform === 'combined' ? 'Combined Meta' : ''}</span>
  </div>;
}
