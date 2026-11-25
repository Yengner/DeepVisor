import Link from 'next/link';
import type { ReactNode } from 'react';
import classes from './DesignSurface.module.css';
export function ActionLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link href={href} className={`${classes.action} ${secondary ? classes.secondary : classes.primary}`}>{children}</Link>;
}
