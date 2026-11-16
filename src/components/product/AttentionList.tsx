import Link from 'next/link';
import { IconAlertTriangle, IconArrowUpRight, IconHourglassLow } from '@tabler/icons-react';
import type { AttentionItem } from '@/lib/shared/insights/attention';
import classes from './AttentionList.module.css';

/** Full-width "needs attention" rows: what Meta reports, what it means, and where to fix it. */
export default function AttentionList({ items, label = 'Needs attention' }: { items: AttentionItem[]; label?: string }) {
  if (!items.length) return null;
  return (
    <section className={classes.list} aria-label={label}>
      <ul>
        {items.map((item) => {
          const external = item.action && /^https?:\/\//.test(item.action.href);
          return (
            <li key={item.key} className={classes.item} data-tone={item.tone}>
              <span className={classes.icon} aria-hidden="true">
                {item.tone === 'urgent' ? <IconAlertTriangle size={20} /> : <IconHourglassLow size={20} />}
              </span>
              <div className={classes.copy}>
                <p className={classes.title}>{item.title}</p>
                <p className={classes.detail}>{item.detail}{item.note ? <span className={classes.note}> {item.note}.</span> : null}</p>
              </div>
              {item.action && (external ? (
                <a className={classes.action} href={item.action.href} target="_blank" rel="noopener noreferrer">
                  {item.action.label}
                  <IconArrowUpRight size={16} aria-hidden="true" />
                  <span className={classes.srOnly}> (opens in a new tab)</span>
                </a>
              ) : (
                <Link className={classes.action} href={item.action.href}>{item.action.label}</Link>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
