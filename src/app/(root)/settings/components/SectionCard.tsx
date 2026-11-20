import type { ReactNode } from 'react';
import classes from '../SettingsSurface.module.css';

type Props = {
  id?: string;
  icon: ReactNode;
  title: string;
  lead?: string;
  aside?: ReactNode;
  children: ReactNode;
};

/** One calm card per topic: icon tile, display-font title, one plain sentence. */
export default function SectionCard({ id, icon, title, lead, aside, children }: Props) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} className={classes.section} aria-labelledby={titleId}>
      <header className={classes.sectionHead}>
        <span className={classes.sectionIcon} aria-hidden>{icon}</span>
        <div>
          <h2 id={titleId} className={classes.sectionTitle}>{title}</h2>
          {lead && <p className={classes.sectionLead}>{lead}</p>}
        </div>
        {aside && <div className={classes.sectionAside}>{aside}</div>}
      </header>
      {children}
    </section>
  );
}
