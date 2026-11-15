'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, Sparkle } from 'lucide-react';
import { headline } from '@/lib/shared/insights/model';
import type { Presentation } from '@/lib/shared/insights/model';
import styles from './InsightsEntry.module.css';

type Summary = { unread: number; openIssues: number; topIssue?: string | null; latest: { id: string; created_at: string; payload: Presentation } | null };

/**
 * Overview entry point to the saved Insights & Events history (which has no sidebar item).
 * Read-only: it never prepares, claims or acknowledges an update, and hides itself when there is
 * nothing saved or the counts can't be loaded.
 */
export default function InsightsEntry() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/insights/summary', { cache: 'no-store' });
      if (r.ok) setSummary(await r.json());
    } catch { /* keep the last summary */ }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from an external API
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('deepvisor:insights-read', refresh);
    window.addEventListener('deepvisor:data-updated', refresh);
    return () => { window.removeEventListener('deepvisor:insights-read', refresh); window.removeEventListener('deepvisor:data-updated', refresh); };
  }, [load]);
  if (!summary?.latest) return null;
  const { openIssues, unread, latest } = summary;
  const tone = openIssues ? 'urgent' : unread ? 'new' : 'quiet';
  const label = openIssues ? `${openIssues} ${openIssues === 1 ? 'issue' : 'issues'} to check`
    : unread ? `${unread} new ${unread === 1 ? 'update' : 'updates'}` : 'Latest update';
  return <Link href={openIssues || unread !== 1 ? '/insights' : `/insights?id=${latest.id}`} className={styles.entry} data-tone={tone}>
    {openIssues ? <AlertTriangle size={14} aria-hidden="true" /> : <Sparkle size={14} aria-hidden="true" />}
    <strong>{label}</strong>
    <span className={styles.detail}>{openIssues && summary.topIssue ? summary.topIssue : headline(latest.payload)}</span>
    <ChevronRight size={14} aria-hidden="true" />
  </Link>;
}
