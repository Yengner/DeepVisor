'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { ScanLine, ShieldCheck, Workflow } from 'lucide-react';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import classes from '../Landing.module.css';

/** Each step uses a visually distinct sprite row so switching steps visibly changes the spider. */
const steps: { title: string; state: SpiderMascotState; heading: string; copy: string; icon: typeof ScanLine }[] = [
  { title: 'Observe', state: 'scanning', heading: 'Start with the evidence.', copy: 'Spend, results, and creative performance from your Meta account, read at the right level: campaign, ad set, or ad.', icon: ScanLine },
  { title: 'Understand', state: 'thinking', heading: 'Context before conclusions.', copy: 'Recent history and data coverage help separate a real signal from a noisy day. Not enough evidence? It says so.', icon: Workflow },
  { title: 'Review', state: 'working', heading: 'A clear next step. Your call.', copy: 'Recommendations show their evidence. Nothing changes in your ad account without your approval and safety checks.', icon: ShieldCheck },
];
const AUTO_ADVANCE_MS = 5200;

export default function AgencyPreview() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const current = steps[step];

  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps.length), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [auto]);

  return <div className={classes.preview} data-auto={auto || undefined} style={{ '--advance-ms': `${AUTO_ADVANCE_MS}ms` } as CSSProperties}>
    <div className={classes.previewHeader}><span><span className={classes.pixelDot} /> THE INTELLIGENCE LOOP</span><span>Illustration</span></div>
    <div className={classes.constellation} data-step={step} aria-hidden="true">
      <svg viewBox="0 0 440 220" preserveAspectRatio="none"><path d="M70 65H140L220 110L300 65H370M70 165H140L220 110L300 165H370" /></svg>
      <span className={`${classes.node} ${classes.nodeOne}`}>Campaigns</span>
      <span className={`${classes.node} ${classes.nodeTwo}`}>Creative</span>
      <span className={`${classes.node} ${classes.nodeThree}`}>Ad sets</span>
      <span className={`${classes.node} ${classes.nodeFour}`}>Budget</span>
      <div className={classes.spiderCore}><SpiderMascot size={96} state={current.state} /></div>
    </div>
    <div className={classes.previewTabs} role="group" aria-label="Explore the illustrative workflow">
      {steps.map((item, index) => <button type="button" key={item.title} aria-pressed={step === index} onClick={() => { setAuto(false); setStep(index); }}><item.icon size={15} aria-hidden />{item.title}</button>)}
    </div>
    <div className={classes.previewCopy} aria-live={auto ? 'off' : 'polite'}><h3 key={current.title} className={classes.previewHeading}>{current.heading}</h3><p>{current.copy}</p></div>
  </div>;
}
