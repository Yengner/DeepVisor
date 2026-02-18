'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TextInput, PasswordInput, Button, Paper, Group, Divider, Stack, Title, Text, Anchor } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { handleLogin, handleSignUp, handleResendVerificationEmail } from '@/lib/server/actions/user/auth';
import { ErrorCode } from '@/lib/shared/types/api';

interface AuthFormProps {
  type: 'login' | 'signup';
}

export default function AuthForm({ type }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNo, setPhoneNo] = useState('');

  const [loading, setLoading] = useState(false);
  const [showVerifyEmailButton, setShowVerifyEmailButton] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setShowVerifyEmailButton(false);

    try {
      if (type === 'login') {
        const res = await handleLogin(email, password);
        if (!res.success) {

          if (res.error.message === "Email not confirmed") {
            toast.error(res.error.userMessage);
            setShowVerifyEmailButton(true);
            return;
          }

          if (res.error.message === "Invalid login credentials") {
            toast.error(res.error.userMessage);
            return
          }

          toast.error(res.error.userMessage ?? 'Login failed.');
          return;
        }

        toast.success('Logged in!');
        router.push('/dashboard');
        return;
      }

      // signup
      const res = await handleSignUp(email, password, firstName, lastName, phoneNo);

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
        // show a nicer message
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

  return (
    <div className="flex justify-center items-center h-auto bg-gray-50">
      <Paper shadow="md" radius="md" p="xl" withBorder className="w-full max-w-md">
        <Title order={2} mb="md">
          {type === 'login' ? 'Sign In to Your Account' : 'Sign Up for an Account'}
        </Title>

        <form onSubmit={handleSubmit}>
          <Stack>
            {type === 'signup' && (
              <>
                <TextInput
                  label="First Name"
                  placeholder="Enter your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <TextInput
                  label="Last Name"
                  placeholder="Enter your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
                <TextInput
                  label="Phone Number"
                  placeholder="Enter your phone number"
                  value={phoneNo}
                  onChange={(e) => setPhoneNo(e.target.value)}
                />
              </>
            )}

            <TextInput
              label="Email"
              placeholder="Enter your email"
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

            {!showVerifyEmailButton && <Button type="submit" fullWidth loading={loading}>
              {type === 'signup' ? 'Sign Up' : 'Sign In'}
            </Button>}
          </Stack>
        </form>

        {showVerifyEmailButton && (
          <Button
            variant="outline"
            fullWidth
            mt="md"
            onClick={handleResendVerification}
            loading={loading}
          >
            Resend Verification Email
          </Button>
        )}

        <Divider my="lg" label="Or continue with" labelPosition="center" />

        <Group grow>
          <Button
            variant="outline"
            leftSection={<IconBrandGoogle size={18} />}
            onClick={() => toast.success('Google Sign-Up Coming Soon!')}
          >
            Google
          </Button>
        </Group>

        <Text mt="md">
          {type === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Anchor href={`/${type === 'signup' ? 'login' : 'sign-up'}`} fz={'md'} fw={500}>
            {type === 'signup' ? 'Login' : 'Sign Up'}
          </Anchor>
        </Text>
      </Paper>
    </div>
  );
}