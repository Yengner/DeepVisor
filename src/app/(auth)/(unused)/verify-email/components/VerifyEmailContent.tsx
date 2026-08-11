'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Loader, TextInput } from '@mantine/core';
import { AlertTriangle, ArrowRight, Check, MailCheck, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/client/supabase/browser';
import { createUserProfile } from '@/lib/server/actions/user/profile';
import { LegacyAuthFrame } from '../../LegacyAuthFrame';
import classes from '../../LegacyAuth.module.css';

type VerificationStatus = 'loading' | 'loadingVerification' | 'success' | 'error' | 'manual';

export default function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verificationHandledRef = useRef(false);
  const tokenVerificationRef = useRef<string | null>(null);

  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const handleVerificationSuccess = useCallback(async (userId: string) => {
    if (verificationHandledRef.current) return;
    verificationHandledRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      const result = await createUserProfile(userId);

      if (!result.success) {
        verificationHandledRef.current = false;
        setStatus('error');
        setErrorMessage(result.errorMessage || 'Your email is verified, but profile setup could not be completed.');
        toast.error('Profile setup could not be completed.');
        return;
      }

      setStatus('success');
      redirectTimerRef.current = setTimeout(() => router.push('/select-plan'), 3000);
    } catch (profileError) {
      console.error('Error in verification success flow:', profileError);
      verificationHandledRef.current = false;
      setStatus('error');
      setErrorMessage('Your email is verified, but profile setup could not be completed.');
    }
  }, [router]);

  const checkVerificationStatus = useCallback(async () => {
    if (verificationHandledRef.current) return;

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.warn('Error checking verification status:', error);
        return;
      }

      if (data.user?.email_confirmed_at) {
        await handleVerificationSuccess(data.user.id);
      }
    } catch (statusError) {
      console.warn('No auth session during verification polling:', statusError);
    }
  }, [handleVerificationSuccess, supabase]);

  const verifyWithTokenHash = useCallback(async (tokenHash: string) => {
    if (tokenVerificationRef.current === tokenHash) return;
    tokenVerificationRef.current = tokenHash;
    setStatus('loadingVerification');
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email',
      });

      if (error || !data.user) {
        console.error('Verification failed:', error);
        setStatus('error');
        setErrorMessage('The verification link is invalid or expired. Request a new code or enter one manually.');
        return;
      }

      await handleVerificationSuccess(data.user.id);
    } catch (verificationError) {
      console.error('Unexpected email verification error:', verificationError);
      setStatus('error');
      setErrorMessage('Email verification could not be completed. Please try again.');
    }
  }, [handleVerificationSuccess, supabase]);

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const email = searchParams.get('email');

    if (email) {
      try {
        localStorage.setItem('emailForVerification', email);
      } catch {
        // Manual verification can still use a session-confirmed account.
      }
    }

    if (tokenHash && type === 'email') {
      void verifyWithTokenHash(tokenHash);
    } else {
      setStatus('manual');
      void checkVerificationStatus();
      intervalRef.current = setInterval(() => void checkVerificationStatus(), 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [checkVerificationStatus, searchParams, verifyWithTokenHash]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  function getStoredEmail() {
    try {
      return localStorage.getItem('emailForVerification') || '';
    } catch {
      return '';
    }
  }

  async function verifyWithManualCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d{6}$/.test(manualCode)) {
      setErrorMessage('Enter the complete 6-digit verification code.');
      return;
    }

    const email = getStoredEmail();
    if (!email) {
      setErrorMessage('The verification email is missing. Return to sign up and request a new code.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token: manualCode,
        type: 'email',
        email,
      });

      if (error || !data.user) {
        console.error('Verification failed:', error);
        setStatus('error');
        setErrorMessage('The code is invalid or expired. Check the code or request a new one.');
        return;
      }

      await handleVerificationSuccess(data.user.id);
    } catch (verificationError) {
      console.error('Unexpected email verification error:', verificationError);
      setStatus('error');
      setErrorMessage('Email verification could not be completed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function resendVerificationEmail() {
    const email = getStoredEmail();
    if (!email) {
      setErrorMessage('The verification email is missing. Return to sign up and request a new code.');
      return;
    }

    setResendTimer(30);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });

      if (error) {
        console.error('Error resending verification email:', error);
        setErrorMessage('A new verification email could not be sent. Please try again.');
        setResendTimer(0);
        return;
      }

      toast.success('Verification email sent.');
    } catch (resendError) {
      console.error('Unexpected resend error:', resendError);
      setErrorMessage('A new verification email could not be sent. Please try again.');
      setResendTimer(0);
    }
  }

  const activeStep = status === 'success' ? 2 : 1;

  return (
    <LegacyAuthFrame
      eyebrow="Identity confirmation"
      title={status === 'success' ? 'Email confirmed.' : 'Secure your account.'}
      description="Confirm the email attached to this account before selecting workspace access."
      steps={['Account created', 'Verify email', 'Select access']}
      activeStep={activeStep}
    >
      <section className={classes.surface} aria-live="polite">
        {status === 'loading' || status === 'loadingVerification' ? (
          <div className={classes.statusBlock}>
            <span className={classes.statusIcon}><Loader size="sm" color="signal" /></span>
            <p className={classes.surfaceKicker}>Email verification</p>
            <h2 className={classes.statusTitle}>
              {status === 'loadingVerification' ? 'Checking your verification link' : 'Loading verification'}
            </h2>
            <p className={classes.statusCopy}>Confirming the account and email status.</p>
          </div>
        ) : null}

        {status === 'manual' ? (
          <>
            <header className={classes.surfaceHeader}>
              <p className={classes.surfaceKicker}>Email verification</p>
              <h2>Enter your verification code</h2>
              <p>Use the 6-digit code sent to the email address attached to your new account.</p>
            </header>

            <form className={classes.formStack} onSubmit={verifyWithManualCode}>
              <TextInput
                label="Verification code"
                placeholder="000000"
                value={manualCode}
                onChange={(event) => {
                  setManualCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6));
                  setErrorMessage(null);
                }}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                error={errorMessage || undefined}
                className={classes.codeInput}
              />
              <Button type="submit" loading={isVerifying} className={classes.primaryButton}>
                Verify email
              </Button>
              <Button
                type="button"
                onClick={resendVerificationEmail}
                disabled={resendTimer > 0}
                variant="outline"
                className={classes.secondaryButton}
                leftSection={<RotateCcw size={15} />}
              >
                {resendTimer > 0 ? `Resend available in ${resendTimer}s` : 'Resend verification email'}
              </Button>
              <Button component={Link} href="/login" variant="subtle" color="dark">
                Back to login
              </Button>
            </form>
          </>
        ) : null}

        {status === 'success' ? (
          <div className={classes.statusBlock}>
            <span className={classes.statusIcon}><Check size={23} /></span>
            <p className={classes.surfaceKicker}>Email confirmed</p>
            <h2 className={classes.statusTitle}>Your identity is verified</h2>
            <p className={classes.statusCopy}>
              Account setup is complete. Plan selection opens automatically in a moment.
            </p>
            <div className={classes.statusActions}>
              <Button
                component={Link}
                href="/select-plan"
                className={classes.primaryButton}
                rightSection={<ArrowRight size={16} />}
              >
                Continue to plans
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
            <h2 className={classes.statusTitle}>Email could not be verified</h2>
            <p className={classes.statusCopy}>{errorMessage || 'Verification could not be completed.'}</p>
            <div className={classes.statusActions}>
              <Button
                className={classes.primaryButton}
                leftSection={<MailCheck size={16} />}
                onClick={() => {
                  tokenVerificationRef.current = null;
                  setErrorMessage(null);
                  setStatus('manual');
                }}
              >
                Enter a code
              </Button>
              <Button component={Link} href="/login" className={classes.secondaryButton} variant="outline">
                Back to login
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </LegacyAuthFrame>
  );
}
