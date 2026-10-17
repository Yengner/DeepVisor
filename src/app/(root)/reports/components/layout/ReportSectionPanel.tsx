'use client';
import { useState, type ReactNode } from 'react';
/** Mount a section on first visit, then retain its independent exploration controls. */
export function ReportSectionPanel({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return <div hidden={!active}>{active || visited ? children : null}</div>;
}
