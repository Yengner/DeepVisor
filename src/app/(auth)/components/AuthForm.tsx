'use client';

import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBrandGoogle,
  IconCheck,
  IconChevronLeft,
  IconSparkles,
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

type SignupStep = 0 | 1 | 2 | 3 | 4 | 5;
type Choice = {
  value: string;
  label: string;
};

const SITUATION_OPTIONS: Choice[] = [
  { value: 'running_ads', label: 'I already run Facebook/Instagram ads' },
  { value: 'boosted_posts', label: 'I have boosted posts before' },
  { value: 'starting_ads', label: 'I want to start running ads' },
  { value: 'not_sure', label: 'I am not sure' },
];

const GOAL_OPTIONS: Choice[] = [
  { value: 'bookings', label: 'More bookings' },
  { value: 'messages', label: 'More messages' },
  { value: 'calls', label: 'More calls' },
  { value: 'form_leads', label: 'More form leads' },
  { value: 'roi', label: 'Better ROI from current ads' },
  { value: 'less_waste', label: 'Less wasted ad spend' },
];

const LEAD_OPTIONS: Choice[] = [
  { value: 'messages', label: 'Instagram/Facebook messages' },
  { value: 'calls', label: 'Phone calls' },
  { value: 'lead_form', label: 'Lead form' },
  { value: 'booking_link', label: 'Booking link' },
  { value: 'recommend', label: 'Not sure, recommend one' },
];

const TRUST_ITEMS = [
  'Secure Meta connection',
  'No automatic budget increases',
  '30-day free test',
  'You approve changes before anything goes live',
];

function AnimatedWelcome() {
  return (
    <div className={classes.animatedWelcome} aria-label="Welcome">
      {'Welcome'.split('').map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          style={{ '--letter-index': index } as CSSProperties}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

function ChoiceGrid({
  options,
  selected,
  onSelect,
}: {
  options: Choice[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            type="button"
            className={[
              classes.choiceButton,
              isSelected ? classes.choiceButtonSelected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(option.value)}
          >
            <span>{option.label}</span>
            {isSelected ? <IconCheck size={16} /> : null}
          </button>
        );
      })}
    </SimpleGrid>
  );
}

export default function AuthForm({ type }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [signupStep, setSignupStep] = useState<SignupStep>(0);
  const [situation, setSituation] = useState('');
  const [goal, setGoal] = useState('');
  const [leadPreference, setLeadPreference] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showVerifyEmailButton, setShowVerifyEmailButton] = useState(false);

  const signupProgress = useMemo(
    () => Math.min(100, Math.round(((signupStep + 1) / 6) * 100)),
    [signupStep]
  );

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('error');

    if (type !== 'login' || !authError) return;

    const message =
      authError === 'google_oauth_failed'
        ? 'Google sign-in was canceled or failed.'
        : 'Google sign-in could not be completed. Please try again.';

    toast.error(message);
    router.replace('/login');
  }, [router, type]);

  function goToNextStep() {
    setSignupStep((current) => Math.min(current + 1, 5) as SignupStep);
  }

  function goToPreviousStep() {
    setSignupStep((current) => Math.max(current - 1, 0) as SignupStep);
  }

  function saveSignupPreferences() {
    if (type !== 'signup') return;

    try {
      window.localStorage.setItem(
        'deepvisor_signup_preferences',
        JSON.stringify({
          situation,
          goal,
          leadPreference,
        })
      );
    } catch {
      // Signup preferences are nice-to-have client context only.
    }
  }

  function getAuthCallbackUrl() {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
    const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0
      ? configuredBaseUrl
      : window.location.origin;
    const callbackUrl = new URL('/api/auth/callback', baseUrl);
    callbackUrl.searchParams.set('next', '/dashboard');

    return callbackUrl.toString();
  }

  async function handleGoogleOAuth() {
    setGoogleLoading(true);
    setShowVerifyEmailButton(false);

    try {
      saveSignupPreferences();

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

      if (!firstName.trim() || !lastName.trim() || !email.trim() || !phoneNo.trim()) {
        toast.error('Please fill in all required fields.');
        return;
      }

      if (password.length < 6) {
        toast.error('Password must be at least 6 characters.');
        return;
      }

      if (password !== confirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }

      saveSignupPreferences();

      const res = await handleSignUp(
        email,
        password,
        firstName.trim(),
        lastName.trim(),
        phoneNo.trim()
      );

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
        <section className={classes.loginIntro}>
          <Badge variant="light" color="blue" radius="xl" className={classes.salonBadge}>
            DeepVisor workspace
          </Badge>
          <AnimatedWelcome />
          <Title order={1} className={classes.introTitle}>
            Pick up where your lead intelligence left off.
          </Title>
          <Text className={classes.introCopy}>
            Sign in to review the latest ad account signals, queued next steps, and
            owner-ready reports from one focused workspace.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" className={classes.loginMetricGrid}>
            {[
              { label: 'Dashboard', value: 'Today view' },
              { label: 'Calendar', value: 'Queued work' },
              { label: 'Reports', value: 'Clear next steps' },
            ].map((metric) => (
              <div key={metric.label} className={classes.loginMetric}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </SimpleGrid>
          <div className={classes.colorOrbit} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>

        <Paper shadow="xl" radius="xl" p="xl" withBorder className={classes.loginCard}>
          <Stack gap="lg">
            <div>
              <ThemeIcon size={52} radius="lg" color="blue" variant="light">
                <IconSparkles size={26} />
              </ThemeIcon>
              <Title order={2} mt="md">
                Sign in to DeepVisor
              </Title>
              <Text c="dimmed" mt={6}>
                Access your dashboard, reports, and approval queue.
              </Text>
            </div>

            <Stack gap="md">
              <Button
                fullWidth
                radius="xl"
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
                    radius="xl"
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
                radius="xl"
              >
                Resend verification email
              </Button>
            ) : null}

            <Text>
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
      <section className={classes.signupIntro}>
        <Badge variant="light" color="blue" radius="xl" className={classes.salonBadge}>
          Built for salons running Meta ads
        </Badge>
        <AnimatedWelcome />
        <Title order={1} className={classes.introTitle}>
          Grow your salon with smarter Meta ads.
        </Title>
        <Text className={classes.introCopy}>
          DeepVisor helps salons understand what ads are bringing leads, what is wasting
          money, and what to improve next.
        </Text>
        <div className={classes.colorOrbit} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <Paper shadow="xl" radius="xl" p="xl" withBorder className={classes.flowCard}>
        <Stack gap="lg">
          <div>
            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={800} tt="uppercase" c="dimmed">
                Free setup
              </Text>
              <Text size="xs" fw={800} c="dimmed">
                Step {signupStep + 1} of 6
              </Text>
            </Group>
            <Progress value={signupProgress} radius="xl" size="sm" />
          </div>

          {signupStep > 0 && signupStep < 5 ? (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconChevronLeft size={14} />}
              className={classes.backButton}
              onClick={goToPreviousStep}
            >
              Back
            </Button>
          ) : null}

          {signupStep === 0 ? (
            <Stack gap="lg">
              <ThemeIcon size={54} radius="lg" color="blue" variant="light">
                <IconSparkles size={28} />
              </ThemeIcon>
              <div>
                <Title order={2}>Grow your salon with smarter Meta ads.</Title>
                <Text c="dimmed" mt="sm">
                  Answer a few quick questions so DeepVisor can personalize setup before
                  your free account is created.
                </Text>
              </div>
              <Button
                size="md"
                radius="xl"
                rightSection={<IconArrowRight size={18} />}
                onClick={goToNextStep}
              >
                Start free
              </Button>
            </Stack>
          ) : null}

          {signupStep === 1 ? (
            <Stack gap="md">
              <div>
                <Title order={2}>Where are you right now?</Title>
                <Text c="dimmed" mt={6}>
                  Pick the closest answer.
                </Text>
              </div>
              <ChoiceGrid
                options={SITUATION_OPTIONS}
                selected={situation}
                onSelect={(value) => {
                  setSituation(value);
                  goToNextStep();
                }}
              />
            </Stack>
          ) : null}

          {signupStep === 2 ? (
            <Stack gap="md">
              <div>
                <Title order={2}>What do you want more of?</Title>
                <Text c="dimmed" mt={6}>
                  This helps us prioritize the first dashboard experience.
                </Text>
              </div>
              <ChoiceGrid
                options={GOAL_OPTIONS}
                selected={goal}
                onSelect={(value) => {
                  setGoal(value);
                  goToNextStep();
                }}
              />
            </Stack>
          ) : null}

          {signupStep === 3 ? (
            <Stack gap="md">
              <div>
                <Title order={2}>How do you prefer new clients to contact you?</Title>
                <Text c="dimmed" mt={6}>
                  DeepVisor will keep the recommendation focused on your lead path.
                </Text>
              </div>
              <ChoiceGrid
                options={LEAD_OPTIONS}
                selected={leadPreference}
                onSelect={(value) => {
                  setLeadPreference(value);
                  goToNextStep();
                }}
              />
            </Stack>
          ) : null}

          {signupStep === 4 ? (
            <Stack gap="lg">
              <div>
                <Title order={2}>You stay in control.</Title>
                <Text c="dimmed" mt={6}>
                  DeepVisor does not publish, pause, or change ads without your approval.
                </Text>
              </div>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {TRUST_ITEMS.map((item) => (
                  <div key={item} className={classes.trustItem}>
                    <ThemeIcon color="green" variant="light" radius="xl" size="sm">
                      <IconCheck size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={700}>
                      {item}
                    </Text>
                  </div>
                ))}
              </SimpleGrid>
              <Button
                size="md"
                radius="xl"
                rightSection={<IconArrowRight size={18} />}
                onClick={goToNextStep}
              >
                Create my free account
              </Button>
            </Stack>
          ) : null}

          {signupStep === 5 ? (
            <Stack gap="lg">
              <div>
                <Group justify="space-between" gap="xs" wrap="wrap">
                  <Title order={2}>Create your free account</Title>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    leftSection={<IconChevronLeft size={14} />}
                    onClick={() => setSignupStep(4)}
                  >
                    Trust step
                  </Button>
                </Group>
                <Text c="dimmed" mt={6}>
                  Salon and business details come after signup.
                </Text>
              </div>

              <Button
                fullWidth
                radius="xl"
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
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="First name"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                    <TextInput
                      label="Last name"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </SimpleGrid>
                  <TextInput
                    label="Email"
                    placeholder="you@salon.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <TextInput
                    label="Phone number"
                    placeholder="Your phone number"
                    value={phoneNo}
                    onChange={(e) => setPhoneNo(e.target.value)}
                    required
                  />
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <PasswordInput
                      label="Password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <PasswordInput
                      label="Confirm password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </SimpleGrid>
                  <Button type="submit" fullWidth loading={loading} radius="xl" size="md">
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

              <Text>
                Already have an account?{' '}
                <Anchor href="/login" fz="md" fw={500}>
                  Login
                </Anchor>
              </Text>
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </div>
  );
}
