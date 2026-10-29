import Link from 'next/link';
import type { ReactNode } from 'react';
import PixelCompanion, { type CompanionState } from '@/components/brand/PixelCompanion';
import classes from './DesignSurface.module.css';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${classes.panel} ${className}`}>{children}</div>;
}
export function ActionLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link href={href} className={`${classes.action} ${secondary ? classes.secondary : classes.primary}`}>{children}</Link>;
}
/** Callers supply truthful copy/state; this component never simulates agent work. */
export function AgentMessage({ title, children, state = 'idle' }: { title: string; children: ReactNode; state?: CompanionState }) {
  return <div className={classes.agent}><PixelCompanion size={40} state={state} /><div><strong>{title}</strong><p>{children}</p></div></div>;
}
