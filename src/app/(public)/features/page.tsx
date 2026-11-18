import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Check } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink } from '@/components/design/Primitives';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import classes from './Features.module.css';

export async function generateMetadata() {
  const t = await getTranslations('public.meta');
  return {
    title: t('featuresTitle'),
    description: t('featuresDescription'),
    alternates: { canonical: '/features' },
    openGraph: { title: t('featuresTitle'), description: t('featuresDescription'), url: '/features', type: 'website' },
  };
}

const features: { id: 'overview' | 'customers' | 'quickAd' | 'decisions' | 'campaigns' | 'language' | 'connections'; spider: SpiderMascotState }[] = [
  { id: 'overview', spider: 'scanning' },
  { id: 'customers', spider: 'success' },
  { id: 'quickAd', spider: 'idea' },
  { id: 'decisions', spider: 'thinking' },
  { id: 'campaigns', spider: 'walking' },
  { id: 'language', spider: 'wave' },
  { id: 'connections', spider: 'working' },
];

export default async function FeaturesPage() {
  const t = await getTranslations('public');
  return <DesignSurface label="DeepVisor / Features">
    <div className={classes.page}>
      <section className={classes.hero} aria-labelledby="features-heading">
        <div>
          <h1 id="features-heading">{t('features.title')}</h1>
          <p className={classes.lede}>{t('features.lede')}</p>
          <div className={classes.actions}>
            <ActionLink href="/sign-up">{t('nav.start')} <ArrowRight size={17} aria-hidden /></ActionLink>
          </div>
        </div>
        <SpiderMascot state="idea" size={192} className={classes.heroSpider} />
      </section>

      {features.map(({ id, spider }) => (
        <section key={id} id={id} className={classes.feature} aria-labelledby={`${id}-heading`}>
          <div className={classes.featureHead}>
            <SpiderMascot state={spider} size={64} />
            <h2 id={`${id}-heading`}>{t(`features.${id}Name`)}</h2>
            <p>{t(`features.${id}Title`)}</p>
          </div>
          <ul className={classes.points}>
            {([1, 2, 3] as const).map((n) => <li key={n}><Check size={18} aria-hidden />{t(`features.${id}${n}`)}</li>)}
          </ul>
        </section>
      ))}

      <p className={classes.coming}>{t.rich('features.coming', { link: (chunks) => <Link href="/vision">{chunks}</Link> })}</p>
    </div>

    <section className={classes.finalCta} aria-labelledby="features-start-heading">
      <div className={classes.finalInner}>
        <SpiderMascot state="wave" size={96} tone="dark" />
        <h2 id="features-start-heading">{t('features.finalTitle')}</h2>
        <ActionLink href="/sign-up">{t('nav.start')} <ArrowRight size={17} aria-hidden /></ActionLink>
      </div>
    </section>
  </DesignSurface>;
}
