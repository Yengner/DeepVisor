import { Suspense } from 'react';
import { Loader } from '@mantine/core';
import { LegacyAuthFrame } from '../LegacyAuthFrame';
import classes from '../LegacyAuth.module.css';
import VerifyEmailContent from './components/VerifyEmailContent';

function VerificationFallback() {
  return (
    <LegacyAuthFrame
      eyebrow="Identity confirmation"
      title="Secure your account."
      description="Confirm the email attached to this account before selecting workspace access."
      steps={['Account created', 'Verify email', 'Select access']}
      activeStep={1}
    >
      <section className={classes.surface} aria-live="polite">
        <div className={classes.statusBlock}>
          <span className={classes.statusIcon}><Loader size="sm" color="signal" /></span>
          <p className={classes.surfaceKicker}>Email verification</p>
          <h2 className={classes.statusTitle}>Loading verification</h2>
          <p className={classes.statusCopy}>Preparing the secure verification session.</p>
        </div>
      </section>
    </LegacyAuthFrame>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerificationFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
