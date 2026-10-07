"use client";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionIcon, Alert, SegmentedControl, Tooltip } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import type { Period } from "@/lib/server/dashboard/overview/types";
import { ownerMessages } from '@/components/product/presentation';

export function PeriodControl({ period }: { period: Period }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <SegmentedControl
      aria-label="Performance period"
      size="xs"
      radius="sm"
      value={period}
      disabled={pending}
      data={[
        { value: "today", label: "Today" },
        { value: "7d", label: "7 days" },
        { value: "30d", label: "30 days" },
      ]}
      onChange={(value) => {
        const next = new URLSearchParams(params);
        next.set("period", value);
        start(() => router.replace(`/dashboard?${next}`, { scroll: false }));
      }}
    />
  );
}
export function RefreshOverview({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = async () => {
    setLoading(true);
    setMessage(null);
    setFailed(false);
    try {
      const response = await fetch("/api/sync/refresh", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(
          body.message || "Refresh could not finish. Please try again shortly.",
        );
      setMessage(body.message || "Refresh request received.");
      router.refresh();
    } catch (error) {
      console.error('Overview refresh unavailable', error);
      setFailed(true);
      setMessage(
        ownerMessages.refresh,
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <Tooltip label="Refresh account">
        <ActionIcon
          aria-label="Refresh account"
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
