import type { IconType } from 'react-icons';
import { FaMicrosoft } from 'react-icons/fa6';
import { SiGoogleads, SiGoogleanalytics, SiGooglegemini, SiLinkedin, SiMeta, SiOpenai, SiPinterest, SiShopify, SiSnapchat, SiTiktok, SiYoutube } from 'react-icons/si';
import classes from '../Landing.module.css';

/** Only Meta is connected today; every other logo is a potential future integration. */
const roadmap: { name: string; icon: IconType }[] = [
  { name: 'Google Ads', icon: SiGoogleads },
  { name: 'TikTok', icon: SiTiktok },
  { name: 'ChatGPT', icon: SiOpenai },
  { name: 'YouTube', icon: SiYoutube },
  { name: 'Gemini', icon: SiGooglegemini },
  { name: 'Shopify', icon: SiShopify },
  { name: 'Snapchat', icon: SiSnapchat },
  { name: 'Pinterest', icon: SiPinterest },
  { name: 'LinkedIn', icon: SiLinkedin },
  { name: 'Microsoft Ads', icon: FaMicrosoft },
  { name: 'Google Analytics', icon: SiGoogleanalytics },
];

function Logos({ hidden }: { hidden?: boolean }) {
  return <ul className={classes.marqueeGroup} aria-hidden={hidden || undefined}>
    {roadmap.map(({ name, icon: Icon }) => <li key={name}><Icon aria-hidden /> {name}</li>)}
  </ul>;
}

export default function PlatformMarquee() {
  return <section className={classes.platforms} aria-labelledby="platforms-heading">
    <div className={classes.platformsLabel}>
      <span className={classes.liveChip}><SiMeta aria-hidden /> Meta <em>Connected today</em></span>
      <span id="platforms-heading">Where we’re headed next</span>
    </div>
    <div className={classes.marquee}>
      <div className={classes.marqueeTrack}><Logos /><Logos hidden /></div>
    </div>
  </section>;
}
