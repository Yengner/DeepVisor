import { ArrowRight, ArrowUpRight, BarChart3, Layers3, LockKeyhole, ScanLine } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink, AgentMessage, Panel } from '@/components/design/Primitives';
import AgencyPreview from './components/AgencyPreview';
import classes from './Landing.module.css';

const pillars = [
  { icon: BarChart3, number: '01', title: 'See the whole picture.', copy: 'Your spend, results, and running ads. Together, with the context that makes the numbers useful.', detail: 'Account → campaign → ad set → ad' },
  { icon: ScanLine, number: '02', title: 'Know what deserves a look.', copy: 'Understand the evidence behind an observation. Missing data stays missing, and uncertainty stays visible.', detail: 'Evidence before recommendations' },
  { icon: LockKeyhole, number: '03', title: 'Keep the final say.', copy: 'Review eligible recommendations on your terms. A suggestion is never permission to change your advertising.', detail: 'Your business. Your control.' },
];

export default function HomePage() {
  return <DesignSurface label="DeepVisor / Advertising intelligence">
    <div className={classes.landing}>
      <section className={classes.hero} id="top" aria-labelledby="hero-heading">
        <div className={classes.heroCopy}>
          <span className={classes.eyebrow}><span className={classes.pixelDot} /> A CLEARER MIND FOR YOUR META ADS</span>
          <h1 id="hero-heading">Less noise.<br />More <span>perspective.</span></h1>
          <p className={classes.lede}>Meet the intelligence behind your next move. DeepVisor connects your advertising, finds the signals, and helps you decide what comes next.</p>
          <div className={classes.actions}><ActionLink href="/sign-up">Start with DeepVisor <ArrowRight size={17} aria-hidden /></ActionLink><ActionLink href="#how-it-works" secondary>Explore the workflow</ActionLink></div>
          <p className={classes.heroNote}><LockKeyhole size={14} aria-hidden /> Built around evidence. Guided by you.</p>
        </div>
        <AgencyPreview />
      </section>
      <div className={classes.principles} aria-label="Product principles"><span>Meta-first intelligence</span><i aria-hidden /><span>Clear account context</span><i aria-hidden /><span>Human-controlled decisions</span></div>
      <section className={classes.section} id="how-it-works" aria-labelledby="workflow-heading">
        <div className={classes.sectionHeading}><div><span className={classes.eyebrow}>FROM INFORMATION TO DIRECTION</span><h2 id="workflow-heading">Connected thinking.<br />Clearer decisions.</h2></div><p>One focused workspace for understanding your advertising, without losing sight of the details.</p></div>
        <div className={classes.pillars}>{pillars.map(({ icon: Icon, ...item }) => <Panel key={item.number} className={classes.pillar}><div className={classes.pillarTop}><Icon size={22} strokeWidth={1.5} aria-hidden /><span>{item.number}</span></div><h3>{item.title}</h3><p>{item.copy}</p><div className={classes.pillarDetail}>{item.detail}</div></Panel>)}</div>
      </section>
      <section className={classes.agencySection} aria-labelledby="agency-heading">
        <div><span className={classes.eyebrow}>SMALL COMPANION. CONNECTED PERSPECTIVE.</span><h2 id="agency-heading">A little character.<br />A lot of clarity.</h2><p>Our pixel spider represents a simple idea: good decisions connect many perspectives. Creative, delivery, performance, and policy—working toward a clearer next step.</p><a href="/features" className={classes.textLink}>Explore DeepVisor <ArrowUpRight size={17} aria-hidden /></a></div>
        <Panel className={classes.companionNote}><div className={classes.noteLabel}><Layers3 size={16} aria-hidden /> THE DEEPVISOR APPROACH</div><AgentMessage title="Look closely. Think clearly.">When there isn’t enough evidence, the right answer can be to wait. Understanding comes before action.</AgentMessage><div className={classes.noteFooter}>A brand companion, never a claim of live agent activity.</div></Panel>
      </section>
      <section className={classes.finalCta} aria-labelledby="start-heading"><div><span className={classes.eyebrow}>YOUR NEXT CHAPTER</span><h2 id="start-heading">Give your ads a clearer direction.</h2><p>Connect your Meta account and start with what the data actually says.</p></div><ActionLink href="/sign-up">Get started <ArrowRight size={17} aria-hidden /></ActionLink></section>
    </div>
  </DesignSurface>;
}
