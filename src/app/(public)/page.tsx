import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, ArrowUpRight, Languages, MessageCircle, Sparkles, UsersRound } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink } from '@/components/design/Primitives';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import HeroResults from './components/HeroResults';
import HowItWorks from './components/HowItWorks';
import SpiderWeb from './components/SpiderWeb';
import classes from './Landing.module.css';

export async function generateMetadata() {
  const t = await getTranslations('public.meta');
  return { title: t('title'), description: t('description'), alternates: { canonical: '/' } };
}

const readings: { state: SpiderMascotState; tone: 'attention' | 'hold' | 'waiting'; key: 'look' | 'hold' | 'early' }[] = [
  { state: 'attention', tone: 'attention', key: 'look' },
  { state: 'idle', tone: 'hold', key: 'hold' },
  { state: 'thinking', tone: 'waiting', key: 'early' },
];
const todayItems = [
  { key: 'conversations', icon: MessageCircle },
  { key: 'customers', icon: UsersRound },
  { key: 'quickAd', icon: Sparkles },
  { key: 'language', icon: Languages },
] as const;
const faqs = ['free', 'change', 'who', 'spanish', 'website', 'platforms', 'data'] as const;

export default async function HomePage() {
  const t = await getTranslations('public');
  return <DesignSurface label="DeepVisor">
    <div className={classes.landing}>
      <section className={classes.hero} aria-labelledby="hero-heading">
        <div className={classes.heroCopy}>
          <h1 id="hero-heading">{t.rich('hero.title', { accent: (chunks) => <span>{chunks}</span> })}</h1>
          <p className={classes.lede}>{t('hero.lede')}</p>
          <div className={classes.actions}>
            <ActionLink href="/sign-up">{t('hero.start')} <ArrowRight size={17} aria-hidden /></ActionLink>
            <ActionLink href="/vision" secondary>{t('hero.vision')}</ActionLink>
          </div>
        </div>
        <HeroResults />
      </section>

      <Link href="/vision" className={classes.ribbon}>
        <span className={classes.ribbonChip}>{t('ribbon.chip')}</span>
        <span className={classes.ribbonText}>{t('ribbon.text')}</span>
        <span className={classes.ribbonLink}>{t('ribbon.link')} <ArrowRight size={16} aria-hidden /></span>
      </Link>

      <section className={classes.section} aria-labelledby="today-heading">
        <div className={classes.sectionIntro}>
          <h2 id="today-heading">{t('today.title')}</h2>
          <p>{t('today.intro')}</p>
        </div>
        <ul className={classes.today}>
          {todayItems.map(({ key, icon: Icon }) => (
            <li key={key}>
              <div className={classes.todayTop}><span className={classes.todayIcon}><Icon size={20} aria-hidden /></span><span className={classes.todayChip}>{t('today.chip')}</span></div>
              <h3>{t(`today.${key}Title`)}</h3>
              <p>{t(`today.${key}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={classes.section} id="how-it-works" aria-labelledby="how-heading">
        <h2 id="how-heading" className={classes.sectionTitle}>{t('how.title')}</h2>
        <HowItWorks />
      </section>

      <section className={classes.section} aria-labelledby="readings-heading">
        <div className={classes.split}>
          <div className={classes.sectionIntro}>
            <h2 id="readings-heading">{t('honest.title')}</h2>
            <p>{t('honest.intro')}</p>
          </div>
          <ul className={classes.readout}>
            {readings.map((item) => (
              <li key={item.key} className={classes.reading} data-tone={item.tone}>
                <SpiderMascot state={item.state} size={32} className={classes.readingSpider} />
                <div className={classes.readingBody}>
                  <div className={classes.readingTop}>
                    <strong className={classes.stateChip}>{t(`honest.${item.key}Label`)}</strong>
                    <span>{t(`honest.${item.key}Name`)}</span>
                  </div>
                  <p>{t(`honest.${item.key}Note`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>

    <section className={classes.webBand} aria-labelledby="web-heading">
      <div className={classes.webInner}>
        <div className={classes.webCopy}>
          <p className={classes.eyebrow}>{t('web.eyebrow')}</p>
          <h2 id="web-heading">{t('web.title')}</h2>
          <p>{t('web.body')}</p>
          <div className={classes.assistant} aria-hidden="true">
            <p className={classes.you}>{t('web.assistantYou')}</p>
            <p className={classes.spiderSays}><SpiderMascot state="idea" size={28} tone="dark" /> <span>{t('web.assistantSpider')}</span><em>{t('web.coming')}</em></p>
          </div>
          <ActionLink href="/vision">{t('web.cta')} <ArrowUpRight size={17} aria-hidden /></ActionLink>
        </div>
        <SpiderWeb />
      </div>
    </section>

    <div className={classes.landing}>
      <section className={classes.section} id="faq" aria-labelledby="faq-heading">
        <div className={classes.split}>
          <h2 id="faq-heading" className={classes.sectionTitle}>{t('faq.title')}</h2>
          <div className={classes.faq}>
            {faqs.map((key) => (
              <details key={key}>
                <summary>{t(`faq.${key}Q`)}</summary>
                <p>{t(`faq.${key}A`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>

    <section className={classes.finalCta} aria-labelledby="start-heading">
      <div className={classes.finalInner}>
        <SpiderMascot state="wave" size={96} tone="dark" />
        <h2 id="start-heading">{t('final.title')}</h2>
        <ActionLink href="/sign-up">{t('final.start')} <ArrowRight size={17} aria-hidden /></ActionLink>
      </div>
    </section>
  </DesignSurface>;
}
