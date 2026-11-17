import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink } from '@/components/design/Primitives';
import SpiderMascot from '@/components/brand/SpiderMascot';
import PlatformWeb from './PlatformWeb';
import classes from './Vision.module.css';

export const metadata: Metadata = {
  title: 'Vision | DeepVisor',
  description: 'Where DeepVisor is going: one simple place to run advertising on every platform, yourself or with an AI assistant.',
  alternates: { canonical: '/vision' },
};

type Status = 'today' | 'coming';
const Mark = ({ status }: { status: Status }) =>
  <span className={classes.mark} data-status={status}>{status === 'today' ? 'Today' : 'Coming'}</span>;

const intelligence: { title: string; status: Status }[] = [
  { title: 'Spot the changes that matter', status: 'today' },
  { title: 'Smarter budget suggestions', status: 'coming' },
  { title: 'Build and test campaigns', status: 'coming' },
  { title: 'Reports and routine work, handled', status: 'coming' },
];

const audiences = [
  { who: 'Small businesses', what: 'Run great ads without an agency.' },
  { who: 'Growing teams', what: 'Manage more campaigns with less busywork.' },
  { who: 'Larger companies and agencies', what: 'Every account, team, and platform in one view.' },
];

const promises = [
  'You set the budgets and permissions.',
  'You see where every dollar goes, and why.',
  'Nothing changes without your say.',
];

const road = [
  { when: 'Today', items: ['Meta ads, read-only', 'Overview, Decisions, Campaigns', 'Free beta'] },
  { when: 'Next', items: ['Google Ads, TikTok, and more', 'Budgets and campaigns from DeepVisor', 'Approve changes in one click'] },
  { when: 'Later', items: ['An AI assistant that runs ads with you', 'Automation within your limits', 'Teams and agencies'] },
];

export default function VisionPage() {
  return <DesignSurface label="DeepVisor / Vision">
    <section className={classes.hero} aria-labelledby="vision-heading">
      <div className={classes.heroInner}>
        <div className={classes.heroCopy}>
          <h1 id="vision-heading">DeepVisor handles the complexity. <span>You stay in control.</span></h1>
          <p>We’re building one simple place to run your advertising on every platform. Do it yourself, or let DeepVisor help.</p>
          <div className={classes.actions}>
            <ActionLink href="/sign-up">Start free beta <ArrowRight size={17} aria-hidden /></ActionLink>
          </div>
        </div>
        <PlatformWeb />
      </div>
    </section>

    <div className={classes.page}>
      <section className={classes.section} aria-labelledby="modes-heading">
        <h2 id="modes-heading">Two ways to run your ads.</h2>
        <p className={classes.sub}>Choose how involved you want to be.</p>
        <div className={classes.modes}>
          <article className={classes.mode}>
            <h3>Do it yourself</h3>
            <p>Everything in one place, without learning every ad platform.</p>
            <ul className={classes.modeList}>
              <li><span>See how your ads perform</span><Mark status="today" /></li>
              <li><span>Set budgets</span><Mark status="coming" /></li>
              <li><span>Build campaigns</span><Mark status="coming" /></li>
            </ul>
          </article>
          <article className={`${classes.mode} ${classes.modeAgent}`}>
            <h3>Let DeepVisor help</h3>
            <div className={classes.chat} aria-label="Example conversation">
              <p className={classes.you}>I want more customers for my salon with $500 a month.</p>
              <p className={classes.agent}>
                <SpiderMascot state="idea" size={32} tone="dark" className={classes.agentSpider} />
                Here’s a plan: $350 on Instagram, $150 on Facebook. I’ll check in weekly and only change what you approve.
              </p>
            </div>
            <p className={classes.modeFoot}><Mark status="coming" /></p>
          </article>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="intel-heading">
        <h2 id="intel-heading">From data to what to do next.</h2>
        <ul className={classes.intel}>
          {intelligence.map((item) => <li key={item.title}><span>{item.title}</span><Mark status={item.status} /></li>)}
        </ul>
      </section>

      <section className={classes.section} aria-labelledby="who-heading">
        <h2 id="who-heading">For every business.</h2>
        <dl className={classes.who}>
          {audiences.map((a) => <div key={a.who}><dt>{a.who}</dt><dd>{a.what}</dd></div>)}
        </dl>
      </section>

      <section className={`${classes.section} ${classes.promise}`} aria-labelledby="promise-heading">
        <SpiderMascot state="success" size={96} />
        <div>
          <h2 id="promise-heading">What never changes.</h2>
          <ul>{promises.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="road-heading">
        <h2 id="road-heading">The road ahead.</h2>
        <ol className={classes.road}>
          {road.map((stage) => (
            <li key={stage.when} data-now={stage.when === 'Today' || undefined}>
              <h3>{stage.when}</h3>
              <ul>{stage.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </li>
          ))}
        </ol>
      </section>
    </div>

    <section className={classes.finalCta} aria-labelledby="vision-start-heading">
      <div className={classes.finalInner}>
        <SpiderMascot state="wave" size={96} tone="dark" />
        <h2 id="vision-start-heading">Start with your Meta ads today.</h2>
        <ActionLink href="/sign-up">Start free beta <ArrowRight size={17} aria-hidden /></ActionLink>
      </div>
    </section>
  </DesignSurface>;
}
