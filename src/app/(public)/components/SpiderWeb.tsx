'use client';
import { useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import type { IconType } from 'react-icons';
import { SiGoogleads, SiLinkedin, SiMeta, SiOpenai, SiPinterest, SiSnapchat, SiTiktok, SiYoutube } from 'react-icons/si';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { useInView } from './useInView';
import classes from './SpiderWeb.module.css';

/**
 * DeepVisor at the center with a thread to every ad platform. Meta is connected today; data
 * flows in along its thread. The other threads are planned; the spider reaches out along them.
 * Angles in degrees (0 = right, clockwise); nodes sit on a circle of radius R in a 100×100 box.
 */
const R = 40;
const platforms: { name: string; icon: IconType; angle: number; live?: boolean }[] = [
  { name: 'Meta', icon: SiMeta, angle: 180, live: true },
  { name: 'Google Ads', icon: SiGoogleads, angle: 225 },
  { name: 'YouTube', icon: SiYoutube, angle: 270 },
  { name: 'TikTok', icon: SiTiktok, angle: 315 },
  { name: 'ChatGPT', icon: SiOpenai, angle: 0 },
  { name: 'LinkedIn', icon: SiLinkedin, angle: 45 },
  { name: 'Snapchat', icon: SiSnapchat, angle: 90 },
  { name: 'Pinterest', icon: SiPinterest, angle: 135 },
];
const point = (angle: number, radius: number) => {
  const a = (angle * Math.PI) / 180;
  return { x: +(50 + radius * Math.cos(a)).toFixed(2), y: +(50 + radius * Math.sin(a)).toFixed(2) };
};
const rings = [12, 22, 32].map((r) => platforms.map((p) => point(p.angle, r)).map(({ x, y }) => `${x},${y}`).join(' '));

export default function SpiderWeb({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const t = useTranslations('public.web');
  const { ref, seen, visible } = useInView<HTMLElement>(0.3);
  const [focus, setFocus] = useState<number | null>(null);

  return (
    <figure ref={ref} className={classes.web} data-tone={tone} data-seen={seen || undefined} data-playing={visible || undefined}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {rings.map((points, i) => <polygon key={i} points={points} className={classes.ring} style={{ '--i': i } as CSSProperties} />)}
        {platforms.map((p, i) => {
          const end = point(p.angle, R - 6);
          return <line key={p.name} x1="50" y1="50" x2={end.x} y2={end.y} pathLength={1}
            className={p.live ? classes.threadLive : classes.thread} data-active={focus === i || undefined}
            style={{ '--i': i } as CSSProperties} />;
        })}
        {platforms.map((p, i) => {
          const end = point(p.angle, R - 6);
          const dx = +(end.x - 50).toFixed(2), dy = +(end.y - 50).toFixed(2);
          // Live: three pulses flow in from Meta. Planned: one faint pulse reaches out.
          return (p.live ? [0, 1, 2] : [0]).map((k) => (
            <circle key={`${p.name}-${k}`} cx="50" cy="50" r={p.live ? 1.3 : 0.9}
              className={p.live ? classes.pulseIn : classes.pulseOut}
              style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, '--k': k, '--i': i } as CSSProperties} />
          ));
        })}
      </svg>
      <div className={classes.center}><SpiderMascot state="scanning" size={88} tone="dark" /></div>
      <ul className={classes.nodes}>
        {platforms.map(({ name, icon: Icon, angle, live }, i) => {
          const { x, y } = point(angle, R);
          return (
            <li key={name} data-live={live || undefined} style={{ '--x': `${x}%`, '--y': `${y}%`, '--i': i } as CSSProperties}
              onPointerEnter={() => setFocus(i)} onPointerLeave={() => setFocus(null)}>
              <Icon aria-hidden />
              <span className={classes.name}>{name}</span>
              <span className={classes.status}>{live ? t('today') : t('coming')}</span>
            </li>
          );
        })}
      </ul>
      <figcaption className={classes.srOnly}>{t('caption')}</figcaption>
    </figure>
  );
}
