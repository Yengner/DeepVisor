'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PixelCompanion from '@/components/brand/PixelCompanion';
import { AccountSetupProgress } from './AccountSetupProgress';

/** Pages that work without the selected account's Meta history: setup, settings and WhatsApp leads. */
const OPEN_PREFIXES = ['/integration', '/settings', '/leads', '/notifications'];

export type AccountSetupState = {
  /** The selected ad account's first full Meta sync has not finished yet. */
  pending: boolean;
  jobId: string | null;
  status: string | null;
};

export const isOpenDuringAccountSetup = (pathname: string) =>
  OPEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * "Setting up your account": until the selected account's first full Meta sync finishes, pages that read or change Meta data (Overview,
 * Campaigns and ad creation, Reports, Calendar, Insights…) show the sync progress instead of their
 * content, so nobody acts on partial data. Connections, Settings, Leads and Notifications stay open.
 * The progress reloads the page when the sync completes, which lifts the gate.
 */
export default function AccountSetupGate({ state, children }: { state: AccountSetupState | null; children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  if (!state?.pending || isOpenDuringAccountSetup(pathname)) return <>{children}</>;
  const running = state.jobId !== null && (state.status === 'queued' || state.status === 'running');
  const failed = state.status === 'failed';
  return (
    <section
      aria-labelledby="account-setup-title"
      style={{ display: 'grid', gap: 16, justifyItems: 'start', maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}
    >
      <PixelCompanion size={64} state={failed ? 'attention' : running ? 'analyzing' : 'idle'} />
      <h1 id="account-setup-title" style={{ fontSize: 26, margin: 0 }}>Setting up your account</h1>
      <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--ui-muted, #5e6977)' }}>
        {failed
          ? 'Setting up your account could not finish. Open Connections to try again.'
          : 'DeepVisor is getting your campaigns, ads and results from Meta. This page opens when it is done, so nothing is based on half the data.'}
      </p>
      {running && state.jobId && <AccountSetupProgress jobId={state.jobId} />}
      <p style={{ margin: 0 }}>
        <Link href="/integration" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
          {failed ? 'Open Connections' : 'Connections'}
        </Link>
        {!failed && <span style={{ color: 'var(--ui-muted, #5e6977)' }}> · Settings and Leads are available meanwhile.</span>}
      </p>
    </section>
  );
}
