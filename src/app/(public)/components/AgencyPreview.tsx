'use client';
import { useState } from 'react';
import { Check, ScanLine, ShieldCheck, Workflow } from 'lucide-react';
import PixelCompanion, { type CompanionState } from '@/components/brand/PixelCompanion';
import classes from '../Landing.module.css';

const steps: { title: string; state: CompanionState; heading: string; copy: string; icon: typeof ScanLine }[] = [
  { title: 'Observe', state: 'analyzing', heading: 'Start with the evidence.', copy: 'Spend, results, and creative performance belong in the same conversation.', icon: ScanLine },
  { title: 'Understand', state: 'thinking', heading: 'Context before conclusions.', copy: 'Recent history and available evidence help separate a signal from a noisy day.', icon: Workflow },
  { title: 'Review', state: 'planning', heading: 'A clear next step. Your call.', copy: 'Recommendations show their evidence. Eligible changes require permission and safety checks.', icon: ShieldCheck },
];

export default function AgencyPreview() {
  const [step, setStep] = useState(0);
  const current = steps[step];
  return <div className={classes.preview}>
    <div className={classes.previewHeader}><span><span className={classes.pixelDot} /> THE INTELLIGENCE LOOP</span><span>Interactive illustration</span></div>
    <div className={classes.constellation} aria-hidden="true">
      <svg viewBox="0 0 440 220" preserveAspectRatio="none"><path d="M70 65H140L220 110L300 65H370M70 165H140L220 110L300 165H370" /></svg>
      <span className={`${classes.node} ${classes.nodeOne}`}>Campaigns</span>
      <span className={`${classes.node} ${classes.nodeTwo}`}>Creative</span>
      <span className={`${classes.node} ${classes.nodeThree}`}>Ad sets</span>
      <span className={`${classes.node} ${classes.nodeFour}`}>Budget</span>
      <div className={classes.spiderCore}><PixelCompanion key={current.state} size={76} tone="dark" state={current.state} /></div>
    </div>
    <div className={classes.previewTabs} role="group" aria-label="Explore the illustrative workflow">
      {steps.map((item, index) => <button type="button" key={item.title} aria-pressed={step === index} onClick={() => setStep(index)}><item.icon size={15} aria-hidden />{item.title}</button>)}
    </div>
    <div className={classes.previewCopy} aria-live="polite"><h3>{current.heading}</h3><p>{current.copy}</p></div>
    <div className={classes.previewFooter}><ShieldCheck size={14} aria-hidden /> Illustration only. No account actions. <Check size={14} aria-hidden /></div>
  </div>;
}
