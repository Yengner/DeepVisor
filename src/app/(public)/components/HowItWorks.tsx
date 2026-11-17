'use client';
import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Plug, Sparkles } from 'lucide-react';
import { SiFacebook, SiInstagram, SiWhatsapp } from 'react-icons/si';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { useInView } from './useInView';
import classes from './HowItWorks.module.css';

/**
 * Three steps on one thread. When the section scrolls in, the thread draws across and each
 * step plays its small scene once: connect → read → you decide. Reduced motion: still scenes.
 */
export default function HowItWorks() {
  const t = useTranslations('public.how');
  const { ref, seen } = useInView<HTMLOListElement>(0.3);
  const step = (i: number) => ({ '--s': i } as CSSProperties);

  return (
    <ol ref={ref} className={classes.steps} data-seen={seen || undefined}>
      <li style={step(0)}>
        <span className={classes.knot} aria-hidden>1</span>
        <div className={classes.scene} aria-hidden="true">
          <span className={classes.logos}><SiFacebook /><SiInstagram /></span>
          <span className={classes.plug}><Plug size={18} /></span>
          <span className={classes.connected}><Check size={14} /> {t('connected')}</span>
        </div>
        <h3>{t('connectTitle')}</h3>
        <p>{t('connectBody')}</p>
      </li>
      <li style={step(1)}>
        <span className={classes.knot} aria-hidden>2</span>
        <div className={classes.scene} aria-hidden="true">
          <SpiderMascot state="scanning" size={40} />
          <span className={classes.rows}>
            <span style={{ '--r': 0 } as CSSProperties}><SiWhatsapp /> </span>
            <span style={{ '--r': 1 } as CSSProperties} />
            <span style={{ '--r': 2 } as CSSProperties} />
          </span>
        </div>
        <h3>{t('readTitle')}</h3>
        <p>{t('readBody')}</p>
      </li>
      <li style={step(2)}>
        <span className={classes.knot} aria-hidden>3</span>
        <div className={classes.scene} aria-hidden="true">
          <span className={classes.chips}>
            <span className={classes.chipHold}>{t('chipHold')}</span>
            <span className={classes.chipLook}>{t('chipLook')}</span>
            <span className={classes.chipDraft}><Sparkles size={12} /> {t('chipDraft')}</span>
          </span>
        </div>
        <h3>{t('decideTitle')}</h3>
        <p>{t('decideBody')}</p>
      </li>
    </ol>
  );
}
