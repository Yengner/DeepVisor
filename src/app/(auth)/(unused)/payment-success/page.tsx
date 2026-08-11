import { Suspense } from 'react';
import { Loader } from '@mantine/core';
import { LegacyAuthFrame } from '../LegacyAuthFrame';
import classes from '../LegacyAuth.module.css';
import PaymentSuccessContent from './components/PaymentSuccessContent';

function PaymentFallback() {
  return (
    <LegacyAuthFrame
      eyebrow="Billing confirmation"
      title="Confirming your access."
      description="DeepVisor validates the Stripe checkout before enabling workspace setup."
      steps={['Checkout complete', 'Verify payment', 'Workspace setup']}
      activeStep={1}
    >
      <section className={classes.surface} aria-live="polite">
        <div className={classes.statusBlock}>
          <span className={classes.statusIcon}><Loader size="sm" color="signal" /></span>
          <p className={classes.surfaceKicker}>Secure verification</p>
          <h2 className={classes.statusTitle}>Loading checkout details</h2>
          <p className={classes.statusCopy}>Preparing the payment verification session.</p>
        </div>
      </section>
    </LegacyAuthFrame>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
