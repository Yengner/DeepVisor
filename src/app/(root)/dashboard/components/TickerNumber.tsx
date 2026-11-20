'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { useSyncActivity } from '@/components/integrations/syncActivity';
import styles from './TickerNumber.module.css';

/** Whether a rise is good news: more conversations yes, a higher cost per conversation no, spend neither. */
export type Polarity = 'up-good' | 'up-bad' | 'neutral';
export type Flash = 'good' | 'bad' | 'neutral';

/** Green only when the change is good news for this metric, red only when it is bad; otherwise neutral. */
export function flashTone(before: number | null, after: number | null, polarity: Polarity): Flash {
  if (before === null || after === null || polarity === 'neutral') return 'neutral';
  const direction = Math.sign(after - before);
  if (direction === 0) return 'neutral';
  return (direction > 0) === (polarity === 'up-good') ? 'good' : 'bad';
}

const DIGITS = '0123456789';

/**
 * A dashboard number that rolls like an odometer when a Meta refresh brings a different value,
 * then glows briefly: green for good news, red for bad, blue when the change is neither (spend).
 * The first render never animates, only real changes after a refresh do. Reduced motion keeps
 * the colour and skips the roll. `text` is formatted on the server; `value` decides direction.
 */
export default function TickerNumber({ text, value, polarity }: { text: string; value: number | null; polarity: Polarity }) {
  const syncing = useSyncActivity();
  // The last value shown. Comparing during render (React's "previous props" pattern) means the
  // first render never flashes and each real change flashes exactly once.
  const [shown, setShown] = useState({ text, value });
  const [flash, setFlash] = useState<Flash | null>(null);
  if (shown.text !== text) {
    setShown({ text, value });
    setFlash(flashTone(shown.value, value, polarity));
  }
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(timer);
  }, [flash, shown]);

  const chars = Array.from(text);
  return (
    <span className={styles.ticker} data-flash={flash ?? undefined} data-syncing={syncing || undefined}>
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.chars} aria-hidden="true">
        {chars.map((char, index) => {
          // Keyed from the right so the ones digit stays the ones digit when the length changes.
          const place = chars.length - index;
          if (!DIGITS.includes(char)) return <span key={`c${place}`} className={styles.char}>{char}</span>;
          return (
            <span key={`d${place}`} className={styles.column} style={{ '--place': place } as CSSProperties}>
              <span className={styles.strip} style={{ '--digit': Number(char) } as CSSProperties}>
                {Array.from(DIGITS, digit => <span key={digit}>{digit}</span>)}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** The working spider in a KPI card's corner while Meta data is being fetched; nothing otherwise. */
export function SyncSpider({ announce = false }: { announce?: boolean }) {
  const syncing = useSyncActivity();
  const t = useTranslations('metrics');
  if (!syncing) return null;
  return (
    <span className={styles.spider}>
      <SpiderMascot state="working" size={32} label={t('syncing')} />
      {announce && <span className={styles.srOnly} role="status">{t('syncing')}</span>}
    </span>
  );
}
