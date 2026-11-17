import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink } from '@/components/design/Primitives';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import AgencyPreview from './components/AgencyPreview';
import PlatformMarquee from './components/PlatformMarquee';
import classes from './Landing.module.css';

const readings: { state: SpiderMascotState; tone: 'attention' | 'hold' | 'waiting'; label: string; name: string; note: string }[] = [
  { state: 'attention', tone: 'attention', label: 'Worth a look', name: 'Weekend walk-ins', note: 'Cost per result up from $18 to $27 this week.' },
  { state: 'idle', tone: 'hold', label: 'Hold', name: 'New client offer', note: 'Steady and on target. Leave it running.' },
  { state: 'thinking', tone: 'waiting', label: 'Too early', name: 'Spring video', note: 'Two days old. Not enough data to judge yet.' },
];

const steps = [
  { title: 'Connect Meta', copy: 'Pick the ad account to watch.' },
  { title: 'DeepVisor reads', copy: 'Every campaign, ad set, and ad.' },
  { title: 'You decide', copy: 'See what deserves a look, and act on your terms.' },
];

const places = [
  { name: 'Overview', question: 'What’s running, and how is it doing?' },
  { name: 'Decisions', question: 'What changed, and should I act?' },
  { name: 'Campaigns', question: 'Where exactly is the money going?' },
];

const faqs = [
  { q: 'Is DeepVisor free?', a: 'Yes, while it’s in beta.' },
  { q: 'Can DeepVisor change my ads?', a: 'No. It only reads your account. Changes are always yours to make.' },
  { q: 'Who is it for?', a: 'Any business running ads, no marketing background needed. We’re starting with local businesses on Facebook and Instagram.' },
  { q: 'Which platforms does it support?', a: 'Meta today. Google Ads, TikTok, LinkedIn, and more are on the way.' },
  { q: 'What do you do with my data?', a: 'Use it to run DeepVisor for you. We never sell it, and you can delete it any time.' },
];

export default function HomePage() {
  return <DesignSurface label="DeepVisor">
    <div className={classes.landing}>
      <section className={classes.hero} aria-labelledby="hero-heading">
        <div className={classes.heroCopy}>
          <h1 id="hero-heading">Less noise.<br />More <span>perspective.</span></h1>
          <p className={classes.lede}>Advertising, made simpler for every business. DeepVisor reads your Meta ads, shows what’s working, and tells you what deserves a look. You stay in control.</p>
          <div className={classes.actions}>
            <ActionLink href="/sign-up">Start free beta <ArrowRight size={17} aria-hidden /></ActionLink>
            <ActionLink href="#how-it-works" secondary>How it works</ActionLink>
          </div>
        </div>
        <AgencyPreview />
      </section>

      <PlatformMarquee />

      <section className={classes.section} aria-labelledby="readings-heading">
        <div className={classes.split}>
          <div className={classes.sectionIntro}>
            <h2 id="readings-heading">Honest answers.</h2>
            <p>When to look, when to leave a good ad alone, and when it’s too early to tell.</p>
          </div>
          <ul className={classes.readout}>
            {readings.map((item) => (
              <li key={item.name} className={classes.reading} data-tone={item.tone}>
                <SpiderMascot state={item.state} size={32} className={classes.readingSpider} />
                <div className={classes.readingBody}>
                  <div className={classes.readingTop}>
                    <strong className={classes.stateChip}>{item.label}</strong>
                    <span>{item.name}</span>
                  </div>
                  <p>{item.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={classes.section} id="how-it-works" aria-labelledby="how-heading">
        <h2 id="how-heading" className={classes.sectionTitle}>Three steps. You stay in charge.</h2>
        <ol className={classes.steps}>
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className={classes.stepKnot} aria-hidden>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={classes.section} aria-labelledby="places-heading">
        <h2 id="places-heading" className={classes.sectionTitle}>One clear picture.</h2>
        <dl className={classes.places}>
          {places.map((place) => (
            <div key={place.name} className={classes.place}>
              <dt>{place.name}</dt>
              <dd>{place.question}</dd>
            </div>
          ))}
        </dl>
        <Link href="/features" className={classes.textLink}>See every feature <ArrowUpRight size={17} aria-hidden /></Link>
      </section>

      <section className={classes.spiderSection} aria-labelledby="spider-heading">
        <SpiderMascot state="dangle" size={128} className={classes.bigSpider} />
        <div>
          <h2 id="spider-heading">One center. A thread to every platform.</h2>
          <p>That’s why DeepVisor is a spider. It sits in the middle of your advertising with a thread to each place you run ads, so it all runs from one place. Meta today, more on the way.</p>
          <Link href="/vision" className={classes.textLink}>Where DeepVisor is going <ArrowUpRight size={17} aria-hidden /></Link>
        </div>
      </section>

      <section className={classes.section} id="faq" aria-labelledby="faq-heading">
        <div className={classes.split}>
          <h2 id="faq-heading" className={classes.sectionTitle}>Questions.</h2>
          <div className={classes.faq}>
            {faqs.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>

    <section className={classes.finalCta} aria-labelledby="start-heading">
      <div className={classes.finalInner}>
        <SpiderMascot state="wave" size={96} tone="dark" />
        <h2 id="start-heading">Give your ads a clearer direction.</h2>
        <ActionLink href="/sign-up">Start free beta <ArrowRight size={17} aria-hidden /></ActionLink>
      </div>
    </section>
  </DesignSurface>;
}
