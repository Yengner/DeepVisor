'use client';

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
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBrandGoogle,
  IconChartDots,
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
import classes from './AuthForm.module.css';

interface AuthFormProps {
  type: 'login' | 'signup';
}

function IntelligencePanel({ type }: AuthFormProps) {
  const isLogin = type === 'login';

  return (
    <section className={classes.intelligencePanel}>
      <div className={classes.panelBrand}>
        <span className={classes.panelBrandMark}>DV</span>
        <span>DEEPVISOR / AD INTELLIGENCE</span>
      </div>

      <div className={classes.panelMessage}>
        <span className={classes.panelEyebrow}>
          <span className={classes.liveDot} aria-hidden="true" />
          Decision signal active
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
          <span>ACCOUNT SIGNAL</span>
          <span className={classes.signalStatus}>MONITORING</span>
        </div>
        <div className={classes.signalScoreRow}>
          <strong>82</strong>
          <div>
            <span>Healthy momentum</span>
            <small>Signal quality is improving</small>
          </div>
        </div>
        <div className={classes.signalRows}>
          <div>
            <span>Lead efficiency</span>
            <strong className={classes.positiveSignal}>+12.4%</strong>
          </div>
          <div>
            <span>Spend pacing</span>
            <strong>On target</strong>
          </div>
          <div>
            <span>Action queue</span>
            <strong>3 ready</strong>
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
  const [showVerifyEmailButton, setShowVerifyEmailButton] = useState(false);

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
    const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
    const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0
      ? configuredBaseUrl
      : window.location.origin;
    const callbackUrl = new URL('/api/auth/callback', baseUrl);
    callbackUrl.searchParams.set('next', '/dashboard');
    callbackUrl.searchParams.set('auth_page', type);

    return callbackUrl.toString();
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

      if (password.length < 6) {
        toast.error('Password must be at least 6 characters.');
        return;
      }

      const res = await handleSignUp(email.trim(), password, firstName.trim());

      if (!res.success) {
        toast.error(res.error.userMessage ?? 'Signup failed.');
        return;
      }

      toast.success('Check your email to verify your account!');
      router.push('/login');
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
      const res = await handleResendVerificationEmail(email);

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
              <ThemeIcon size={42} radius="sm" color="green" variant="light" className={classes.authIcon}>
                <IconShieldCheck size={22} />
              </ThemeIcon>
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
              <Divider label="Or sign in with email" labelPosition="center" />
            </Stack>

            <form onSubmit={handleSubmit}>
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
            </form>

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

  return (
    <div className={classes.signupShell}>
      <IntelligencePanel type="signup" />

      <Paper radius="sm" p="xl" withBorder className={classes.flowCard}>
        <Stack gap="lg">
          <div className={classes.authHeading}>
            <ThemeIcon size={42} radius="sm" color="green" variant="light" className={classes.authIcon}>
              <IconChartDots size={22} />
            </ThemeIcon>
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

          <Divider label="Or sign up with email" labelPosition="center" />

          <form onSubmit={handleSubmit}>
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
              <PasswordInput
                label="Password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
              <Button
                type="submit"
                fullWidth
                loading={loading}
                radius="sm"
                size="md"
                className={classes.authPrimaryButton}
              >
                Create account
              </Button>
            </Stack>
          </form>

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
