import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink } from '@/components/design/Primitives';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import classes from './Features.module.css';

export const metadata: Metadata = {
  title: 'Features | DeepVisor',
  description: 'What DeepVisor shows you about your Facebook and Instagram ads today.',
  alternates: { canonical: '/features' },
  openGraph: {
    title: 'Features | DeepVisor',
    description: 'See what’s running, how it’s doing, and what deserves a look.',
    url: '/features',
    type: 'website',
  },
};

const features: { id: string; name: string; spider: SpiderMascotState; title: string; points: string[] }[] = [
  {
    id: 'overview', name: 'Overview', spider: 'scanning',
    title: 'What’s running, and how it’s doing.',
    points: ['Today, 7 days, or 30 days.', 'What’s live now, kept apart from the past.', 'Your real ad images and videos.'],
  },
  {
    id: 'decisions', name: 'Decisions', spider: 'thinking',
    title: 'What changed, and whether to act.',
    points: ['The numbers behind every call.', '“Hold” and “too early” are real answers.', 'Missing data is never shown as zero.'],
  },
  {
    id: 'campaigns', name: 'Campaigns', spider: 'walking',
    title: 'Every campaign, ad set, and ad.',
    points: ['One table, from account to single ad.', 'Live status straight from Meta.', 'Open any ad set to see its ads.'],
  },
  {
    id: 'connections', name: 'Connections', spider: 'working',
    title: 'Read-only. Your ads stay yours.',
    points: ['DeepVisor can see your ads, never change them.', 'Refresh whenever you like.', 'Disconnect any time.'],
  },
];

export default function FeaturesPage() {
  return <DesignSurface label="DeepVisor / Features">
    <div className={classes.page}>
      <section className={classes.hero} aria-labelledby="features-heading">
        <div>
          <h1 id="features-heading">Everything you need to see. Nothing you don’t.</h1>
          <p className={classes.lede}>Three places to look and one read-only connection.</p>
          <div className={classes.actions}>
            <ActionLink href="/sign-up">Start free beta <ArrowRight size={17} aria-hidden /></ActionLink>
          </div>
        </div>
        <SpiderMascot state="idea" size={192} className={classes.heroSpider} />
      </section>

      {features.map((feature) => (
        <section key={feature.id} id={feature.id} className={classes.feature} aria-labelledby={`${feature.id}-heading`}>
          <div className={classes.featureHead}>
            <SpiderMascot state={feature.spider} size={64} />
            <h2 id={`${feature.id}-heading`}>{feature.name}</h2>
            <p>{feature.title}</p>
          </div>
          <ul className={classes.points}>
            {feature.points.map((point) => <li key={point}><Check size={18} aria-hidden />{point}</li>)}
          </ul>
        </section>
      ))}

      <p className={classes.coming}>Coming later: more platforms, campaign building, and an AI assistant. <Link href="/vision">See where we’re going</Link></p>
    </div>

    <section className={classes.finalCta} aria-labelledby="features-start-heading">
      <div className={classes.finalInner}>
        <SpiderMascot state="wave" size={96} tone="dark" />
        <h2 id="features-start-heading">See your own account clearly.</h2>
        <ActionLink href="/sign-up">Start free beta <ArrowRight size={17} aria-hidden /></ActionLink>
      </div>
    </section>
  </DesignSurface>;
}
