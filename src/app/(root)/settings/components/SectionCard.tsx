import type { ReactNode } from 'react';
import classes from '../SettingsSurface.module.css';

type Props = {
  id: string;
  icon: ReactNode;
  title: string;
  lead?: string;
  /** A short status beside the title (a pill), never a second action. */
  aside?: ReactNode;
  tone?: 'default' | 'danger';
  children: ReactNode;
};

/**
 * One topic per card, read top to bottom like the Insights popup: icon tile + display-font
 * title, one plain sentence, then the content and its single main button.
 */
export default function SectionCard({ id, icon, title, lead, aside, tone = 'default', children }: Props) {
  return (
    <section id={id} className={`${classes.section} ${tone === 'danger' ? classes.sectionDanger : ''}`} aria-labelledby={`${id}-title`}>
      <header className={classes.sectionHead}>
        <span className={classes.sectionIcon} aria-hidden="true">{icon}</span>
        <div className={classes.sectionHeading}>
          <h2 id={`${id}-title`}>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
        {aside && <div className={classes.sectionAside}>{aside}</div>}
      </header>
      {children}
    </section>
  );
}
