import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { CircleCheck, MessageCircle, Sparkles } from 'lucide-react';
import { SiFacebook, SiInstagram, SiWhatsapp } from 'react-icons/si';
import SpiderMascot from '@/components/brand/SpiderMascot';
import classes from './HeroResults.module.css';

/** Seven example days of conversations; obviously generic, round numbers. */
const days = [2, 3, 2, 4, 3, 5, 4];
const max = Math.max(...days);

/**
 * What an owner sees, as one product-style card that assembles itself once on load:
 * conversations and their cost, the week growing in, the "how many became customers?"
 * check-in, then a Quick ad draft. Pure CSS; reduced motion shows the finished card.
 */
export default function HeroResults() {
  const t = useTranslations('public.heroCard');
  return (
    <figure className={classes.card} aria-label={t('label')}>
      <div className={classes.head}>
        <span className={classes.week}>{t('week')}</span>
        <span className={classes.sources}><SiFacebook aria-hidden /><SiInstagram aria-hidden /> {t('sources')}</span>
      </div>

      <div className={classes.metrics}>
        <div className={classes.metric} style={{ '--d': 1 } as CSSProperties}>
          <span><SiWhatsapp aria-hidden className={classes.wa} /> {t('conversations')}</span>
          <strong>23</strong>
        </div>
        <div className={classes.metric} style={{ '--d': 2 } as CSSProperties}>
          <span><MessageCircle size={14} aria-hidden /> {t('costEach')}</span>
          <strong>$8.40</strong>
        </div>
      </div>

      <div className={classes.chart} aria-hidden="true">
        {days.map((v, i) => <span key={i} style={{ '--h': v / max, '--b': i } as CSSProperties} />)}
      </div>

      <div className={classes.checkin} style={{ '--d': 6 } as CSSProperties}>
        <SpiderMascot state="thinking" size={32} />
        <div>
          <p>{t('question')}</p>
          <div className={classes.answer}><span>9</span><CircleCheck size={16} aria-hidden /> {t('answer')}</div>
        </div>
      </div>

      <div className={classes.draft} style={{ '--d': 8 } as CSSProperties}>
        <Sparkles size={16} aria-hidden />
        <span><strong>{t('draftTitle')}</strong> {t('draftBody')}</span>
      </div>
    </figure>
  );
}
