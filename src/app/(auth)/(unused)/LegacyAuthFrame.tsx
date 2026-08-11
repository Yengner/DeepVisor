import type { ReactNode } from 'react';
import { ChartNoAxesCombined, Check, ShieldCheck } from 'lucide-react';
import classes from './LegacyAuth.module.css';

type LegacyAuthFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  steps: readonly string[];
  activeStep: number;
  children: ReactNode;
  wide?: boolean;
};

export function LegacyAuthFrame({
  eyebrow,
  title,
  description,
  steps,
  activeStep,
  children,
  wide = false,
}: LegacyAuthFrameProps) {
  return (
    <div className={classes.shell}>
      <aside className={classes.stagePanel} aria-label="Account setup progress">
        <div className={classes.panelBrand}>
          <span className={classes.panelBrandMark}>
            <ChartNoAxesCombined size={16} aria-hidden="true" />
          </span>
          <span>DEEPVISOR / SECURE SETUP</span>
        </div>

        <div className={classes.panelIntro}>
          <p className={classes.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <ol className={classes.stageList}>
          {steps.map((step, index) => {
            const isComplete = index < activeStep;
            const isActive = index === activeStep;

            return (
              <li
                key={step}
                className={isActive ? classes.stageActive : undefined}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={classes.stageIndex} aria-hidden="true">
                  {isComplete ? <Check size={14} /> : index + 1}
                </span>
                <span>
                  <strong>{step}</strong>
                  <small>{isComplete ? 'Complete' : isActive ? 'Current' : 'Next'}</small>
                </span>
              </li>
            );
          })}
        </ol>

        <div className={classes.securityNote}>
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Encrypted account and billing handoff</span>
        </div>
      </aside>

      <div className={wide ? classes.contentWide : classes.contentNarrow}>
        {children}
      </div>
    </div>
  );
}
