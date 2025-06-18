'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import { Loader, Title, Text, Stack, Button, TextInput, Center } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import toast from 'react-hot-toast';

export default function VerifyEmailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const [status, setStatus] = useState<'loading' | 'loadingVerification' | 'success' | 'error' | 'manual'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState<number>(0); // Timer for resend button

    useEffect(() => {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const email = searchParams.get('email');

        if (tokenHash && type === 'email') {
            verifyWithTokenHash(tokenHash);
        } else {
            checkVerificationStatus();
            localStorage.setItem('emailForVerification', email || '');
            setStatus('manual'); // Allow manual entry if no token_hash is present
        }

        // Start polling to check verification status
        const interval = setInterval(checkVerificationStatus, 5000); // Poll every 5 seconds
        return () => clearInterval(interval); // Cleanup interval on component unmount
    }, [searchParams]);

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const verifyWithTokenHash = async (tokenHash: string) => {
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: 'email',
            });

            if (error || !data) {
                console.error('Verification failed:', error);
                setStatus('error');
                setErrorMessage('Verification failed. Please try again.');
            } else {
                setStatus('success');
                setTimeout(() => {
                    router.push('/onboarding'); // Redirect to onboarding after success
                }, 4000);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setStatus('error');
            setErrorMessage('An unexpected error occurred. Please try again.');
        }
    };

    const verifyWithManualCode = async () => {
        if (!manualCode || manualCode.length !== 6) {
            setErrorMessage('Please enter a valid 6-digit code.');
            return;
        }

        setIsVerifying(true);
        try {
            const email = localStorage.getItem('emailForVerification') || '';
            const { data, error } = await supabase.auth.verifyOtp({
                token: manualCode,
                type: 'email',
                email: email,
            });

            if (error || !data) {
                console.error('Verification failed:', error);
                setStatus('error');
                setErrorMessage('Verification failed. Please try again.');
            } else {
                setStatus('success');
                setTimeout(() => {
                    router.push('/onboarding'); // Redirect to onboarding after success
                }, 4000);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setStatus('error');
            setErrorMessage('An unexpected error occurred. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    const checkVerificationStatus = async () => {
        try {
            const { data: user, error } = await supabase.auth.getUser();

            if (error) {
                console.warn('Error checking verification status:', error);
                return;
            }
            if (user?.user?.email_confirmed_at) {
                setStatus('success');
                setTimeout(() => {
                    router.push('/onboarding'); // Redirect to onboarding after success
                }, 4000);
            }
        } catch (err) {
            console.warn('No Auth Session during polling:', err);
        }
    };

    const resendVerificationEmail = async () => {
        setResendTimer(30); // Set timer to 30 seconds
        try {
            const email = localStorage.getItem('emailForVerification') || '';
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
            });

            if (error) {
                console.error('Error resending verification email:', error);
                setErrorMessage('Failed to resend verification email. Please try again.');
            } else {
                setErrorMessage(null);
                toast.success('Verification email sent!');
            }
        } catch (err) {
            console.error('Unexpected error while resending verification email:', err);
            setErrorMessage('An unexpected error occurred. Please try again.');
        }
    };

    return (
        <div className="flex justify-center items-center h-auto bg-gray-50">
            {status === 'loading' && (
                <Center>
                    <Loader size="xl" color="blue" />
                </Center>
            )}

            {status === 'loadingVerification' && (
                <Stack align="center">
                    <Loader size="xl" color="blue" />
                    <Title order={2} className="text-gray-800">
                        Verifying your email...
                    </Title>
                    <Text>Please wait while we verify your email address.</Text>
                </Stack>
            )}

            {status === 'manual' && (
                <Stack align="center" className="w-full max-w-md">
                    <Title order={2} className="text-gray-800">
                        Enter Your Verification Code
                    </Title>
                    <Text>
                        If you received a 6-digit code in your email, please enter it below to verify your account.
                    </Text>
                    <TextInput
                        placeholder="Enter 6-digit code"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        maxLength={6}
                        className="w-full"
                    />
                    {errorMessage && <Text className="text-red-600">{errorMessage}</Text>}
                    <Button
                        onClick={verifyWithManualCode}
                        loading={isVerifying}
                        fullWidth
                        className="mt-4"
                    >
                        Verify Code
                    </Button>
                    <Button
                        onClick={resendVerificationEmail}
                        disabled={resendTimer > 0}
                        fullWidth
                        variant="outline"
                        className="mt-4"
                    >
                        {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend Verification Code'}
                    </Button>
                </Stack>
            )}

            {status === 'success' && (
                <Stack align="center">
                    <div className="flex items-center justify-center w-32 h-32 rounded-full bg-green-100">
                        <IconCheck size={64} color="green" />
                    </div>
                    <Title order={2} className="text-green-600">
                        Email Verified!
                    </Title>
                    <Text>Your email has been successfully verified. Redirecting to your dashboard...</Text>
                </Stack>
            )}

            {status === 'error' && (
                <Stack align="center">
                    <Title order={2} className="text-red-600">
                        Verification Failed
                    </Title>
                    <Text>{errorMessage}</Text>
                    <Button variant="outline" onClick={() => router.push('/login')}>
                        Go to Login
                    </Button>
                </Stack>
            )}
        </div>
    );
}