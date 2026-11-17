'use client';
import { useEffect, useState } from 'react';
import { ScanLine, ShieldCheck, Workflow } from 'lucide-react';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import classes from '../Landing.module.css';

/** Each step uses a visually distinct sprite row so switching steps visibly changes the spider. */
const steps: { title: string; state: SpiderMascotState; heading: string; copy: string; icon: typeof ScanLine }[] = [
  { title: 'Observe', state: 'scanning', heading: 'Start with the evidence.', copy: 'Spend, results, and creative from your Meta account.', icon: ScanLine },
  { title: 'Understand', state: 'thinking', heading: 'Context before conclusions.', copy: 'A real change, or just a noisy day? If it can’t tell, it says so.', icon: Workflow },
  { title: 'Review', state: 'working', heading: 'A clear next step. Your call.', copy: 'DeepVisor never changes your ads. What happens next is up to you.', icon: ShieldCheck },
];
const AUTO_ADVANCE_MS = 5200;

/**
 * Auto-advances like a short explainer. It holds still while the pointer or focus is
 * inside, stops for good once someone picks a step, and never moves under reduced motion.
 */
export default function AgencyPreview() {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState(false);
  const [held, setHeld] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const current = steps[step];
  const running = !chosen && !held && !reducedMotion;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps.length), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [running]);

  return <div className={classes.preview}
    onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
    onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
    <div className={classes.constellation} data-step={step} aria-hidden="true">
      <svg viewBox="0 0 440 220" preserveAspectRatio="none"><path d="M70 65H140L220 110L300 65H370M70 165H140L220 110L300 165H370" /></svg>
      <span className={`${classes.node} ${classes.nodeOne}`}>Campaigns</span>
      <span className={`${classes.node} ${classes.nodeTwo}`}>Creative</span>
      <span className={`${classes.node} ${classes.nodeThree}`}>Ad sets</span>
      <span className={`${classes.node} ${classes.nodeFour}`}>Budget</span>
      <div className={classes.spiderCore}><SpiderMascot size={96} state={current.state} /></div>
    </div>
    <div className={classes.previewTabs} role="group" aria-label="Choose a step">
      {steps.map((item, index) => <button type="button" key={item.title} aria-pressed={step === index} aria-controls="loop-step-copy"
        onClick={() => { setChosen(true); setStep(index); }}><item.icon size={15} aria-hidden />{item.title}</button>)}
    </div>
    <div id="loop-step-copy" className={classes.previewCopy} aria-live={running ? 'off' : 'polite'}>
      <div key={current.title} className={classes.stepCopy}><h3>{current.heading}</h3><p>{current.copy}</p></div>
    </div>
  </div>;
}
