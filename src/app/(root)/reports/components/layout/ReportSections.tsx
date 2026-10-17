'use client';
import { useEffect, useRef, useState } from 'react';
import classes from '../Workspace.module.css';
export const REPORT_SECTIONS = [
  ['performance', 'Performance'], ['audience', 'Audience'], ['geography', 'Geography'],
  ['delivery', 'Placements & devices'], ['time', 'Time & day'], ['advertising', 'Advertising'], ['findings', 'Findings'],
] as const;
export type ReportSection = typeof REPORT_SECTIONS[number][0];
export function reportSectionFromHash(hash: string): ReportSection {
  return REPORT_SECTIONS.find(([key]) => `#${key}` === hash)?.[0] ?? 'performance';
}
export function useReportSection() {
  const [section, setSection] = useState<ReportSection>('performance');
  useEffect(() => {
    const sync = () => setSection(reportSectionFromHash(window.location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  const select = (next: ReportSection) => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${next}`);
    setSection(next);
  };
  return { section, select };
}
export function ReportSections({ section, onSelect }: { section: ReportSection; onSelect: (section: ReportSection) => void }) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = navigation.current;
    const active = container?.querySelector<HTMLElement>('[aria-current]');
    if (!container || !active) return;
    // Reveal hash/history selections inside the strip without scrolling the page.
    const bounds = container.getBoundingClientRect(), selected = active.getBoundingClientRect();
    if (selected.left < bounds.left) container.scrollLeft -= bounds.left - selected.left;
    else if (selected.right > bounds.right) container.scrollLeft += selected.right - bounds.right;
  }, [section]);
  return <nav ref={navigation} aria-label="Report sections" className={classes.navigation}>
    {REPORT_SECTIONS.map(([key, label]) => <button key={key} type="button"
      aria-current={section === key ? 'page' : undefined} onClick={() => onSelect(key)}>{label}</button>)}
  </nav>;
}
