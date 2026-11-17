import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import { ActionLink } from '@/components/design/Primitives';
import SpiderMascot from '@/components/brand/SpiderMascot';
import SpiderWeb from '../components/SpiderWeb';
import classes from './Vision.module.css';

export async function generateMetadata() {
  const t = await getTranslations('public.meta');
  return { title: t('visionTitle'), description: t('visionDescription'), alternates: { canonical: '/vision' } };
}

type Status = 'today' | 'coming';
function Mark({ status, label }: { status: Status; label: string }) {
  return <span className={classes.mark} data-status={status}>{label}</span>;
}
const self: { key: 'self1' | 'self2' | 'self3' | 'self4'; status: Status }[] = [
  { key: 'self1', status: 'today' }, { key: 'self2', status: 'today' }, { key: 'self3', status: 'coming' }, { key: 'self4', status: 'coming' },
];
const intelligence: { key: 'intel1' | 'intel2' | 'intel3' | 'intel4' | 'intel5'; status: Status }[] = [
  { key: 'intel1', status: 'today' }, { key: 'intel2', status: 'today' }, { key: 'intel3', status: 'coming' },
  { key: 'intel4', status: 'coming' }, { key: 'intel5', status: 'coming' },
];
const road = [
  { when: 'roadToday', items: ['roadToday1', 'roadToday2', 'roadToday3'], now: true },
  { when: 'roadNext', items: ['roadNext1', 'roadNext2', 'roadNext3'] },
  { when: 'roadLater', items: ['roadLater1', 'roadLater2', 'roadLater3'] },
] as const;

export default async function VisionPage() {
  const [t, tNav] = await Promise.all([getTranslations('public.vision'), getTranslations('public.nav')]);
  return <DesignSurface label="DeepVisor / Vision">
    <section className={classes.hero} aria-labelledby="vision-heading">
      <div className={classes.heroInner}>
        <div className={classes.heroCopy}>
          <h1 id="vision-heading">{t.rich('title', { accent: (chunks) => <span>{chunks}</span> })}</h1>
          <p>{t('lede')}</p>
          <div className={classes.actions}>
            <ActionLink href="/sign-up">{tNav('start')} <ArrowRight size={17} aria-hidden /></ActionLink>
          </div>
        </div>
        <SpiderWeb />
      </div>
    </section>

    <div className={classes.page}>
      <section className={classes.section} aria-labelledby="modes-heading">
        <h2 id="modes-heading">{t('modesTitle')}</h2>
        <p className={classes.sub}>{t('modesSub')}</p>
        <div className={classes.modes}>
          <article className={classes.mode}>
            <h3>{t('selfTitle')}</h3>
            <p>{t('selfBody')}</p>
            <ul className={classes.modeList}>
              {self.map((item) => <li key={item.key}><span>{t(item.key)}</span><Mark status={item.status} label={t(item.status)} /></li>)}
            </ul>
          </article>
          <article className={`${classes.mode} ${classes.modeAgent}`}>
            <h3>{t('helpTitle')}</h3>
            <div className={classes.chat} aria-label={t('chatLabel')}>
              <p className={classes.you}>{t('chatYou')}</p>
              <p className={classes.agent}>
                <SpiderMascot state="idea" size={32} tone="dark" className={classes.agentSpider} />
                {t('chatSpider')}
              </p>
            </div>
            <p className={classes.modeFoot}><Mark status="coming" label={t('coming')} /></p>
          </article>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="intel-heading">
        <h2 id="intel-heading">{t('intelTitle')}</h2>
        <ul className={classes.intel}>
          {intelligence.map((item) => <li key={item.key}><span>{t(item.key)}</span><Mark status={item.status} label={t(item.status)} /></li>)}
        </ul>
      </section>

      <section className={classes.section} aria-labelledby="who-heading">
        <h2 id="who-heading">{t('whoTitle')}</h2>
        <dl className={classes.who}>
          {(['who1', 'who2', 'who3'] as const).map((k) => <div key={k}><dt>{t(k)}</dt><dd>{t(`${k}Body`)}</dd></div>)}
        </dl>
      </section>

      <section className={`${classes.section} ${classes.promise}`} aria-labelledby="promise-heading">
        <SpiderMascot state="success" size={96} />
        <div>
          <h2 id="promise-heading">{t('promiseTitle')}</h2>
          <ul>{(['promise1', 'promise2', 'promise3'] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="road-heading">
        <h2 id="road-heading">{t('roadTitle')}</h2>
        <ol className={classes.road}>
          {road.map((stage) => (
            <li key={stage.when} data-now={'now' in stage || undefined}>
              <h3>{t(stage.when)}</h3>
              <ul>{stage.items.map((item) => <li key={item}>{t(item)}</li>)}</ul>
            </li>
          ))}
        </ol>
      </section>
    </div>

    <section className={classes.finalCta} aria-labelledby="vision-start-heading">
      <div className={classes.finalInner}>
        <SpiderMascot state="wave" size={96} tone="dark" />
        <h2 id="vision-start-heading">{t('finalTitle')}</h2>
        <ActionLink href="/sign-up">{tNav('start')} <ArrowRight size={17} aria-hidden /></ActionLink>
      </div>
    </section>
  </DesignSurface>;
}
