'use client';

import { BrandLockup, BrandMark } from '@/components/brand/Brand';
import PixelCompanion from '@/components/brand/PixelCompanion';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Anchor,
  Button,
  Divider,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconBrandGoogle,
  IconChartDots,
  IconCheck,
  IconCircle,
  IconShieldCheck,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import {
  handleLogin,
  handleResendVerificationEmail,
  handleSignUp,
} from '@/lib/server/actions/user/auth';
import { createClient } from '@/lib/client/supabase/browser';
import { ErrorCode } from '@/lib/shared/types/api';
import { passwordChecks, passwordMeetsPolicy } from '@/lib/shared/auth/passwordPolicy';
import classes from './AuthForm.module.css';
import { buildOAuthCallbackUrl } from './oauthCallback';

interface AuthFormProps {
  type: 'login' | 'signup';
}

function IntelligencePanel({ type }: AuthFormProps) {
  const isLogin = type === 'login';

  return (
    <section className={classes.intelligencePanel}>
      <div className={classes.panelBrand}>
        <BrandLockup inverse />
      </div>

      <div className={classes.panelMessage}>
        <span className={classes.panelEyebrow}>
          <PixelCompanion size={32} tone="dark" />
          Your ad intelligence companion
        </span>
        <h1 className={classes.panelTitle}>
          {isLogin ? 'Know what to do next.' : 'Start with signal, not guesswork.'}
        </h1>
        <p className={classes.panelCopy}>
          {isLogin
            ? 'Return to a clear read on spend, leads, and the decisions waiting for you.'
            : 'Build a focused intelligence profile around the outcomes that matter to your business.'}
        </p>
      </div>

      <div className={classes.signalPreview} aria-label="DeepVisor intelligence preview">
        <div className={classes.signalPreviewHeader}>
          <span>WHAT YOU WILL SEE</span>
        </div>
        <div className={classes.signalScoreRow}>
          <SpiderMascot state="scanning" size={64} tone="dark" />
          <div>
            <span>Your ads, read from your own account</span>
            <small>Spend, results, and what deserves your attention.</small>
          </div>
        </div>
        <div className={classes.signalRows}>
          <div>
            <span>Performance</span>
            <strong>From live Meta data</strong>
          </div>
          <div>
            <span>Decisions</span>
            <strong>You approve every change</strong>
          </div>
          <div>
            <span>Thin data</span>
            <strong>We say so plainly</strong>
          </div>
        </div>
      </div>

      <div className={classes.panelFooter}>
        <span><IconChartDots size={16} />Evidence-led</span>
        <span><IconShieldCheck size={16} />Approval-first</span>
      </div>
    </section>
  );
}

export default function AuthForm({ type }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Google is the way in; email stays available behind a link for existing email accounts.
  const [showEmail, setShowEmail] = useState(false);
  const [showVerifyEmailButton, setShowVerifyEmailButton] = useState(false);
  /** Address a verification email was just sent to; kept in memory only (never URL or storage). */
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const passwordRules = passwordChecks(password);
  const passwordReady = passwordMeetsPolicy(password);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('error');

    if (!authError) return;

    const authAction = type === 'login' ? 'sign-in' : 'sign-up';
    const message =
      authError === 'google_oauth_failed'
        ? `Google ${authAction} was canceled or failed.`
        : `Google ${authAction} could not be completed. Please try again.`;

    toast.error(message);
    router.replace(type === 'login' ? '/login' : '/sign-up');
  }, [router, type]);

  function getAuthCallbackUrl() {
    return buildOAuthCallbackUrl(window.location.origin, type, process.env.NEXT_PUBLIC_BASE_URL);
  }

  async function handleGoogleOAuth() {
    setGoogleLoading(true);
    setShowVerifyEmailButton(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthCallbackUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        toast.error(error.message || 'Google sign-in failed.');
        setGoogleLoading(false);
      }
    } catch (err) {
      console.error('Error starting Google sign-in:', err);
      toast.error('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setShowVerifyEmailButton(false);

    try {
      if (type === 'login') {
        const res = await handleLogin(email, password);
        if (!res.success) {
          if (res.error.message === 'Email not confirmed') {
            toast.error(res.error.userMessage);
            setShowVerifyEmailButton(true);
            return;
          }

          if (res.error.message === 'Invalid login credentials') {
            toast.error(res.error.userMessage);
            return;
          }

          toast.error(res.error.userMessage ?? 'Login failed.');
          return;
        }

        toast.success('Logged in!');
        router.replace('/api/auth/redirect');
        return;
      }

      if (!firstName.trim() || !email.trim()) {
        toast.error('Please fill in all required fields.');
        return;
      }

      if (!passwordReady) {
        toast.error('Your password needs every item in the checklist.');
        return;
      }

      const res = await handleSignUp(email.trim(), password, firstName.trim());

      if (!res.success) {
        toast.error(res.error.userMessage ?? 'Signup failed.');
        return;
      }

      setPassword('');
      setSentToEmail(email.trim());
    } catch (err) {
      console.error('Error during submission:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setLoading(true);
    try {
      const res = await handleResendVerificationEmail(sentToEmail ?? email);

      if (!res.success) {
        if (res.error.code === ErrorCode.RATE_LIMITED) {
          toast.error('Too many requests. Please wait a bit and try again.');
          return;
        }

        toast.error(res.error.userMessage ?? 'Failed to resend verification email.');
        return;
      }

      toast.success('Verification email sent!');
    } catch (err) {
      console.error('Error resending verification email:', err);
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (type === 'login') {
    return (
      <div className={classes.loginShell}>
        <IntelligencePanel type="login" />

        <Paper radius="sm" p="xl" withBorder className={classes.loginCard}>
          <Stack gap="lg">
            <div className={classes.authHeading}>
              <BrandMark tone="light" className="h-10 w-10" />
              <Title order={2} mt="md">
                Welcome back
              </Title>
              <Text c="dimmed" mt={6}>
                Sign in to your DeepVisor workspace.
              </Text>
            </div>

            <Stack gap="md">
              <Button
                fullWidth
                radius="sm"
                size="md"
                className={classes.googlePrimaryButton}
                leftSection={<IconBrandGoogle size={18} />}
                loading={googleLoading}
                onClick={handleGoogleOAuth}
              >
                Continue with Google
              </Button>
              {!showEmail && (
                <Anchor component="button" type="button" size="sm" c="dimmed" ta="center" onClick={() => setShowEmail(true)}>
                  Use email instead
                </Anchor>
              )}
              {showEmail && <Divider label="Or sign in with email" labelPosition="center" />}
            </Stack>

            {showEmail && <form onSubmit={handleSubmit}>
              <Stack>
                <TextInput
                  label="Email"
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <PasswordInput
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />

                {!showVerifyEmailButton ? (
                  <Button
                    type="submit"
                    fullWidth
                    loading={loading}
                    radius="sm"
                    size="md"
                    className={classes.authPrimaryButton}
                  >
                    Sign in
                  </Button>
                ) : null}
              </Stack>
            </form>}

            {showVerifyEmailButton ? (
              <Button
                variant="outline"
                fullWidth
                onClick={handleResendVerification}
                loading={loading}
                radius="sm"
                className={classes.secondaryButton}
              >
                Resend verification email
              </Button>
            ) : null}

            <Text size="sm" className={classes.switchAuth}>
              Don&apos;t have an account?{' '}
              <Anchor href="/sign-up" fz="md" fw={700}>
                Sign up
              </Anchor>
            </Text>
          </Stack>
        </Paper>
      </div>
    );
  }

  if (sentToEmail) {
    return (
      <div className={classes.signupShell}>
        <IntelligencePanel type="signup" />

        <Paper radius="sm" p="xl" withBorder className={classes.flowCard}>
          <Stack gap="lg" className={classes.inboxView} aria-live="polite">
            <SpiderMascot state="wave" size={64} />
            <div className={classes.authHeading}>
              <Title order={2}>Check your inbox</Title>
              <Text c="dimmed" mt={6}>
                We sent a verification link to <strong className={classes.inboxEmail}>{sentToEmail}</strong>.
                Open it to finish creating your account.
              </Text>
            </div>
            <Text size="sm" c="dimmed">
              It can take a minute. Check spam or promotions if you do not see it.
            </Text>
            <Button
              fullWidth
              radius="sm"
              size="md"
              variant="outline"
              loading={loading}
              onClick={handleResendVerification}
              className={classes.secondaryButton}
            >
              Resend email
            </Button>
            <Button
              fullWidth
              radius="sm"
              size="md"
              variant="subtle"
              disabled={loading}
              onClick={() => setSentToEmail(null)}
            >
              Use a different email
            </Button>
            <Text size="sm" className={classes.switchAuth}>
              Already verified?{' '}
              <Anchor href="/login" fz="md" fw={500}>
                Log in
              </Anchor>
            </Text>
          </Stack>
        </Paper>
      </div>
    );
  }

  return (
    <div className={classes.signupShell}>
      <IntelligencePanel type="signup" />

      <Paper radius="sm" p="xl" withBorder className={classes.flowCard}>
        <Stack gap="lg">
          <div className={classes.authHeading}>
            <BrandMark tone="light" className="h-10 w-10" />
            <Title order={2} mt="md">Create your account</Title>
            <Text c="dimmed" mt={6}>
              Business details take one short step after signup.
            </Text>
          </div>

          <Button
            fullWidth
            radius="sm"
            size="md"
            className={classes.googlePrimaryButton}
            leftSection={<IconBrandGoogle size={18} />}
            loading={googleLoading}
            onClick={handleGoogleOAuth}
          >
            Continue with Google
          </Button>

          {!showEmail && (
            <Anchor component="button" type="button" size="sm" c="dimmed" ta="center" onClick={() => setShowEmail(true)}>
              Use email instead
            </Anchor>
          )}
          {showEmail && <Divider label="Or sign up with email" labelPosition="center" />}

          {showEmail && <form onSubmit={handleSubmit}>
            <Stack>
              <TextInput
                label="First name"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
              <TextInput
                label="Email"
                placeholder="you@company.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <div>
                <PasswordInput
                  label="Password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  aria-describedby="password-rules"
                />
                <ul id="password-rules" className={classes.passwordRules} aria-label="Password requirements">
                  {passwordRules.map((rule) => (
                    <li key={rule.key} data-passed={rule.passed || undefined}>
                      {rule.passed ? <IconCheck size={13} aria-hidden /> : <IconCircle size={11} aria-hidden />}
                      <span>{rule.label}</span>
                      <span className={classes.visuallyHidden}>{rule.passed ? ' (done)' : ' (needed)'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                type="submit"
                fullWidth
                disabled={!passwordReady}
                loading={loading}
                radius="sm"
                size="md"
                className={classes.authPrimaryButton}
              >
                Create account
              </Button>
            </Stack>
          </form>}

          <Text size="xs" c="dimmed">
            By creating an account, you agree to DeepVisor&apos;s{' '}
            <Anchor href="/terms-of-service" size="xs" fw={700}>
              Terms
            </Anchor>{' '}
            and{' '}
            <Anchor href="/privacy-policy" size="xs" fw={700}>
              Privacy Policy
            </Anchor>
            .
          </Text>

          <Text size="sm" className={classes.switchAuth}>
            Already have an account?{' '}
            <Anchor href="/login" fz="md" fw={500}>
              Login
            </Anchor>
          </Text>
        </Stack>
      </Paper>
    </div>
  );
}
