'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Loader } from '@mantine/core';
import { AlertTriangle, ArrowRight, Check, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { verifyPaymentAndStoreSubscription } from '@/lib/server/actions/stripe/stripe.actions';
import { LegacyAuthFrame } from '../../LegacyAuthFrame';
import classes from '../../LegacyAuth.module.css';

type PaymentStatus = 'loading' | 'success' | 'error';

export default function PaymentSuccessContent() {
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const startedSessionRef = useRef<string | null>(null);
  const verificationPromiseRef = useRef<ReturnType<typeof verifyPaymentAndStoreSubscription> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('The checkout session is missing or invalid.');
      return;
    }

    if (startedSessionRef.current !== sessionId || !verificationPromiseRef.current) {
      startedSessionRef.current = sessionId;
      verificationPromiseRef.current = verifyPaymentAndStoreSubscription(sessionId);
    }

    const verificationPromise = verificationPromiseRef.current;

    let isCurrent = true;

    async function verifyAndStore() {
      try {
        const result = await verificationPromise;

        if (!isCurrent) return;

        if (!result.success) {
          setStatus('error');
          setError(result.error || 'Payment verification could not be completed.');
          return;
        }

        setStatus('success');
        redirectTimerRef.current = setTimeout(() => router.push('/onboarding'), 3000);
      } catch (verificationError) {
        console.error('Error verifying payment:', verificationError);
        if (!isCurrent) return;
        setStatus('error');
        setError('Payment verification could not be completed. Please contact support.');
        toast.error('Payment verification failed.');
      }
    }

    void verifyAndStore();

    return () => {
      isCurrent = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [router, sessionId]);

  return (
    <LegacyAuthFrame
      eyebrow="Billing confirmation"
      title={status === 'success' ? 'Payment confirmed.' : 'Confirming your access.'}
      description="DeepVisor validates the Stripe checkout before enabling workspace setup."
      steps={['Checkout complete', 'Verify payment', 'Workspace setup']}
      activeStep={status === 'success' ? 2 : 1}
    >
      <section className={classes.surface} aria-live="polite">
        {status === 'loading' ? (
          <div className={classes.statusBlock}>
            <span className={classes.statusIcon}><Loader size="sm" color="signal" /></span>
            <p className={classes.surfaceKicker}>Secure verification</p>
            <h2 className={classes.statusTitle}>Checking payment</h2>
            <p className={classes.statusCopy}>
              Stripe checkout has returned. DeepVisor is validating the subscription now.
            </p>
          </div>
        ) : null}

        {status === 'success' ? (
          <div className={classes.statusBlock}>
            <span className={classes.statusIcon}><Check size={23} /></span>
            <p className={classes.surfaceKicker}>Payment confirmed</p>
            <h2 className={classes.statusTitle}>Your workspace is ready for setup</h2>
            <p className={classes.statusCopy}>
              Your subscription was recorded successfully. Onboarding opens automatically in a moment.
            </p>
            <div className={classes.statusActions}>
              <Button
                component={Link}
                href="/onboarding"
                className={classes.primaryButton}
                rightSection={<ArrowRight size={16} />}
              >
                Continue to onboarding
              </Button>
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className={classes.statusBlock} role="alert">
            <span className={`${classes.statusIcon} ${classes.statusIconError}`}>
              <AlertTriangle size={22} />
            </span>
            <p className={classes.surfaceKicker}>Verification interrupted</p>
            <h2 className={classes.statusTitle}>Payment could not be verified</h2>
            <p className={classes.statusCopy}>{error}</p>
            <div className={classes.statusActions}>
              <Button
                component="a"
                href="mailto:info@deepvisor.com?subject=Payment%20verification%20help"
                className={classes.primaryButton}
                leftSection={<Mail size={16} />}
              >
                Contact support
              </Button>
              <Button component={Link} href="/select-plan" className={classes.secondaryButton} variant="outline">
                Return to plans
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </LegacyAuthFrame>
  );
}
