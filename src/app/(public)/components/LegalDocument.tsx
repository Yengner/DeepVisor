import DesignSurface from '@/components/design/DesignSurface';
import classes from './Legal.module.css';

export type LegalBlock = string | { list: string[] };

export type LegalSection = {
  id: string;
  title: string;
  body: LegalBlock[];
};

type LegalDocumentProps = {
  title: string;
  lastUpdated: string;
  /** ISO date (YYYY-MM-DD) for the machine-readable <time> value. */
  lastUpdatedISO: string;
  summary: string[];
  sections: LegalSection[];
  /** Translated headings (English by default). */
  labels?: { updated: string; summary: string; contents: string };
  /** Shown between the summary and the sections, e.g. a status lookup. */
  children?: React.ReactNode;
};
const ENGLISH = { updated: 'Updated', summary: 'The short version', contents: 'Contents' };

function Contents({ sections }: { sections: LegalSection[] }) {
  return <ol>
    {sections.map((section) => (
      <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
    ))}
  </ol>;
}

export default function LegalDocument({ title, lastUpdated, lastUpdatedISO, summary, sections, labels = ENGLISH, children }: LegalDocumentProps) {
  return (
    <DesignSurface label={`DeepVisor / ${title}`}>
      <div className={classes.page}>
        <header className={classes.header}>
          <h1>{title}</h1>
          <p className={classes.meta}>{labels.updated} <time dateTime={lastUpdatedISO}>{lastUpdated}</time></p>
        </header>

        <section className={classes.summary} aria-labelledby="summary-heading">
          <h2 id="summary-heading">{labels.summary}</h2>
          <ul>{summary.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        {children}

        <div className={classes.layout}>
          <nav className={classes.toc} aria-label={`${title} contents`}>
            <details className={classes.tocMobile}>
              <summary>{labels.contents}</summary>
              <Contents sections={sections} />
            </details>
            <div className={classes.tocDesktop}>
              <h2>{labels.contents}</h2>
              <Contents sections={sections} />
            </div>
          </nav>

          <article className={classes.article}>
            {sections.map((section, index) => (
              <section id={section.id} key={section.id} className={classes.section} aria-labelledby={`${section.id}-heading`}>
                <h2 id={`${section.id}-heading`}><span aria-hidden="true">{index + 1}.</span> {section.title}</h2>
                {section.body.map((block, blockIndex) => typeof block === 'string'
                  ? <p key={blockIndex}>{block}</p>
                  : <ul key={blockIndex}>{block.list.map((item) => <li key={item}>{item}</li>)}</ul>)}
              </section>
            ))}

          </article>
        </div>
      </div>
    </DesignSurface>
  );
}
