'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleLogin, handleSignUp, resendVerificationEmail } from '@/lib/actions/user.actions';
import { TextInput, PasswordInput, Button, Paper, Group, Divider, Stack, Title, Text, Anchor } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';
import toast from 'react-hot-toast';

interface AuthFormProps {
  type: 'login' | 'signup';
}

export default function AuthForm({ type }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerifyEmailButton, setShowVerifyEmailButton] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (type === 'login') {
        const { errorMessage } = await handleLogin(email, password);
        if (errorMessage) {
          if (errorMessage === 'Email not confirmed') {
            toast.error('Your email is not confirmed. Please verify your email.');
            setShowVerifyEmailButton(true); // Show the verify email button
          } else {
            toast.error(errorMessage);
          }
        } else {
          toast.success('Logged In!');
          router.push('/dashboard');
        }
      } else if (type === 'signup') {
        const { errorMessage } = await handleSignUp(email, password, firstName, lastName, businessName, phoneNo);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.success('Verify Your Email!');
          router.push('/verify-email?email=' + encodeURIComponent(email) + '&type=email');
        }
      }
    } catch (error) {
      console.error('Error during submission:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setLoading(true);
    try {
      const { success, error } = await resendVerificationEmail(email);
      if (success) {
        toast.success('Verification email sent!');
        router.push('/verify-email?email=' + encodeURIComponent(email) + '&type=email');
      } else {
        toast.error(error || 'Failed to resend verification email.');
      }
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
                  label="Business Name"
                  placeholder="Enter your business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
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

            <Button type="submit" fullWidth loading={loading}>
              {type === 'signup' ? 'Sign Up' : 'Sign In'}
            </Button>
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