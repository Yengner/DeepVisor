'use client';
import { useAccountSignals } from '@/lib/client/hooks/useAccountSignals';

/** Mounted once in the app shell; renders nothing. */
export default function AccountSignals({ accountId, enabled }: { accountId: string | null; enabled: boolean }) {
  useAccountSignals(accountId, enabled);
  return null;
}
