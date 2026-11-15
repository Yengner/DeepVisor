import { ArrowRight, ArrowUpRight, Layers3, LayoutDashboard, LockKeyhole, ScanLine, Table2 } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink, AgentMessage, Panel } from '@/components/design/Primitives';
import SpiderMascot from '@/components/brand/SpiderMascot';
import AgencyPreview from './components/AgencyPreview';
import PlatformMarquee from './components/PlatformMarquee';
import classes from './Landing.module.css';

const pillars = [
  { icon: LayoutDashboard, number: 'Overview', title: 'What’s running, and how it’s doing.', copy: 'Spend, results, and the ads actually delivering right now, shown with their real creative next to how the last 7 or 30 days went.', detail: 'Active now vs. the period you pick' },
  { icon: ScanLine, number: 'Decisions', title: 'What changed, and whether to act.', copy: 'DeepVisor writes down what it noticed and the numbers behind it. “Hold” and “not enough data yet” are honest answers, not failures.', detail: 'Evidence attached to every call' },
  { icon: Table2, number: 'Campaigns', title: 'Every campaign, ad set, and ad.', copy: 'One table you can drill through, from the whole account down to a single ad, without losing track of where you are.', detail: 'Account → campaign → ad set → ad' },
];

export default function HomePage() {
  return <DesignSurface label="DeepVisor / Advertising intelligence">
    <div className={classes.landing}>
      <section className={classes.hero} id="top" aria-labelledby="hero-heading">
        <div className={classes.heroCopy}>
          <span className={classes.eyebrow}><span className={classes.pixelDot} /> A CLEARER MIND FOR YOUR META ADS</span>
          <h1 id="hero-heading">Less noise.<br />More <span>perspective.</span></h1>
          <p className={classes.lede}>DeepVisor reads your Meta ad account, shows what’s running and how it’s performing, and points out what deserves a look, with the evidence attached. You decide what changes.</p>
          <div className={classes.actions}><ActionLink href="/sign-up">Start with DeepVisor <ArrowRight size={17} aria-hidden /></ActionLink><ActionLink href="#how-it-works" secondary>Explore the workflow</ActionLink></div>
          <p className={classes.heroNote}><LockKeyhole size={14} aria-hidden /> Nothing changes in your ad account without your approval.</p>
        </div>
        <AgencyPreview />
      </section>
      <PlatformMarquee />
      <section className={classes.section} id="how-it-works" aria-labelledby="workflow-heading">
        <div className={`${classes.sectionHeading} ${classes.reveal}`}><div><span className={classes.eyebrow}>HOW IT’S ORGANIZED</span><h2 id="workflow-heading">Three places.<br />One clear picture.</h2></div><p>Built around the questions owners actually ask: what’s running, what changed, and where should I look?</p></div>
        <div className={classes.pillars}>{pillars.map(({ icon: Icon, ...item }) => <Panel key={item.number} className={`${classes.pillar} ${classes.reveal}`}><div className={classes.pillarTop}><Icon size={22} strokeWidth={1.5} aria-hidden /><span>{item.number}</span></div><h3>{item.title}</h3><p>{item.copy}</p><div className={classes.pillarDetail}>{item.detail}</div></Panel>)}</div>
      </section>
      <section className={classes.agencySection} aria-labelledby="agency-heading">
        <div className={classes.reveal}><span className={classes.eyebrow}>SMALL COMPANION. CONNECTED PERSPECTIVE.</span><h2 id="agency-heading">A little character.<br />A lot of clarity.</h2><p>Why a spider? Good ad decisions are a web: creative, delivery, budget, and results all pull on each other. Ours sits in the middle and keeps an eye on every thread.</p><a href="/features" className={classes.textLink}>Explore DeepVisor <ArrowUpRight size={17} aria-hidden /></a></div>
        <Panel className={`${classes.companionNote} ${classes.reveal}`}><SpiderMascot state="dangle" size={64} className={classes.noteSpider} /><div className={classes.noteLabel}><Layers3 size={16} aria-hidden /> THE DEEPVISOR APPROACH</div><AgentMessage title="Look closely. Think clearly.">When there isn’t enough evidence, the right answer can be to wait. Understanding comes before action.</AgentMessage><div className={classes.noteFooter}>Sometimes the best recommendation is to leave a good ad alone.</div></Panel>
      </section>
      <section className={`${classes.finalCta} ${classes.reveal}`} aria-labelledby="start-heading"><div><span className={classes.eyebrow}>YOUR NEXT CHAPTER</span><h2 id="start-heading">Give your ads a clearer direction.</h2><p>Connect your Meta account and start with what the data actually says.</p></div><div className={classes.ctaAction}><SpiderMascot state="wave" size={64} /><ActionLink href="/sign-up">Get started <ArrowRight size={17} aria-hidden /></ActionLink></div></section>
    </div>
  </DesignSurface>;
}
