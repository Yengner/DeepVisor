import type { CSSProperties } from 'react';
import type { IconType } from 'react-icons';
import { SiGoogleads, SiLinkedin, SiMeta, SiReddit, SiSnapchat, SiTiktok, SiX, SiYoutube } from 'react-icons/si';
import SpiderMascot from '@/components/brand/SpiderMascot';
import classes from './Vision.module.css';

/** Meta is connected today; every other thread is planned. Positions are % of the web's box. */
const platforms: { name: string; icon: IconType; x: number; y: number; live?: boolean }[] = [
  { name: 'Meta', icon: SiMeta, x: 14, y: 50, live: true },
  { name: 'Google Ads', icon: SiGoogleads, x: 22, y: 14 },
  { name: 'YouTube', icon: SiYoutube, x: 50, y: 6 },
  { name: 'TikTok', icon: SiTiktok, x: 78, y: 14 },
  { name: 'LinkedIn', icon: SiLinkedin, x: 86, y: 50 },
  { name: 'Reddit', icon: SiReddit, x: 78, y: 86 },
  { name: 'Snapchat', icon: SiSnapchat, x: 50, y: 94 },
  { name: 'X', icon: SiX, x: 22, y: 86 },
];

export default function PlatformWeb() {
  return <figure className={classes.web}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {[18, 30, 42].map((r) => <ellipse key={r} cx="50" cy="50" rx={r} ry={r} className={classes.ring} />)}
      {platforms.map((p) => <line key={p.name} x1="50" y1="50" x2={p.x} y2={p.y} className={p.live ? classes.threadLive : classes.thread} />)}
    </svg>
    <div className={classes.webCenter}><SpiderMascot state="scanning" size={96} tone="dark" /></div>
    <ul className={classes.webNodes}>
      {platforms.map(({ name, icon: Icon, x, y, live }) => (
        <li key={name} data-live={live || undefined} style={{ '--x': `${x}%`, '--y': `${y}%` } as CSSProperties}>
          <Icon aria-hidden /><span className={classes.nodeName}>{name}</span>{live ? <span className={classes.srOnly}> (connected today)</span> : <span className={classes.srOnly}> (coming)</span>}
        </li>
      ))}
    </ul>
    <figcaption className={classes.srOnly}>DeepVisor at the center, with a thread to each ad platform. Meta is connected today; the others are coming.</figcaption>
  </figure>;
}
