'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import { createUserProfile } from '@/lib/actions/user.actions';
import { Loader, Title, Text, Stack, Button, TextInput, Center } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import toast from 'react-hot-toast';

export default function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    // Add new ref to store interval ID and verification status
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const verificationHandledRef = useRef<boolean>(false);

    // State variables
    const [status, setStatus] = useState<'loading' | 'loadingVerification' | 'success' | 'error' | 'manual'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState<number>(0);

    // Memoize functions with useCallback
    const handleVerificationSuccess = useCallback(async (userId: string) => {
        if (verificationHandledRef.current) {
            return;
        }
        verificationHandledRef.current = true;

        // Clear polling interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        try {
            const { success, errorMessage } = await createUserProfile(userId);

            if (!success) {
                console.error('Error creating profile:', errorMessage);
                toast.error('Account created but profile setup failed. Please contact support.');
            }

            setStatus('success');

            setTimeout(() => {
                router.push('/select-plan');
            }, 3000);
        } catch (err) {
            console.error('Error in verification success flow:', err);
            setStatus('error');
            setErrorMessage('Account verified but profile setup failed. Please contact support.');
        }
    }, [router]);

    const checkVerificationStatus = useCallback(async () => {
        // Don't check if we've already handled verification
        if (verificationHandledRef.current) {
            return;
        }

        try {
            const { data, error } = await supabase.auth.getUser();

            if (error) {
                console.warn('Error checking verification status:', error);
                return;
            }

            if (data?.user?.email_confirmed_at) {
                await handleVerificationSuccess(data.user.id);
            }
        } catch (err) {
            console.warn('No Auth Session during polling:', err);
        }
    }, [supabase, handleVerificationSuccess]);

    const verifyWithTokenHash = useCallback(async (tokenHash: string) => {
        setStatus('loadingVerification');
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: 'email',
            });

            if (error || !data) {
                console.error('Verification failed:', error);
                setStatus('error');
                setErrorMessage('Verification failed. Please try again or enter the code manually.');
            } else {
                if (data.user) {
                    await handleVerificationSuccess(data.user.id);
                } else {
                    setStatus('error');
                    setErrorMessage('Verification failed. User data is missing.');
                }
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setStatus('error');
            setErrorMessage('An unexpected error occurred. Please try again.');
        }
    }, [supabase, handleVerificationSuccess]);

    useEffect(() => {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const email = searchParams.get('email');

        if (tokenHash && type === 'email') {
            verifyWithTokenHash(tokenHash);
        } else {
            checkVerificationStatus();
            if (email) {
                localStorage.setItem('emailForVerification', email);
            }
            setStatus('manual');
        }

        // Store interval reference so we can clear it
        intervalRef.current = setInterval(checkVerificationStatus, 5000);

        // Clean up interval on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [searchParams, checkVerificationStatus, verifyWithTokenHash]);

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Handle verification with manual code
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
                setErrorMessage('Verification failed. Please check your code and try again.');
            } else {
                if (data.user) {
                    await handleVerificationSuccess(data.user.id);
                } else {
                    setStatus('error');
                    setErrorMessage('Verification failed. User data is missing.');
                }
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setStatus('error');
            setErrorMessage('An unexpected error occurred. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    // Handle resend verification email
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

    // Render different UI based on status
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
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
                <Stack align="center" className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
                    <Title order={2} className="text-gray-800">
                        Verify Your Email
                    </Title>
                    <Text className="text-center mb-4">
                        We sent a verification code to your email. Please enter it below to complete your account setup.
                    </Text>
                    <TextInput
                        placeholder="Enter 6-digit code"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        maxLength={6}
                        className="w-full"
                        error={errorMessage || undefined}
                    />
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
                <Stack align="center" className="bg-white p-8 rounded-lg shadow-md">
                    <div className="flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-4">
                        <IconCheck size={48} className="text-green-600" />
                    </div>
                    <Title order={2} className="text-green-600">
                        Email Verified!
                    </Title>
                    <Text className="text-center">
                        Your account has been successfully created. Redirecting to plan selection...
                    </Text>
                </Stack>
            )}

            {status === 'error' && (
                <Stack align="center" className="bg-white p-8 rounded-lg shadow-md">
                    <div className="flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-4">
                        <IconAlertCircle size={48} className="text-red-600" />
                    </div>
                    <Title order={2} className="text-red-600">
                        Verification Failed
                    </Title>
                    <Text className="text-center">{errorMessage}</Text>
                    <Button variant="outline" onClick={() => setStatus('manual')} className="mt-4">
                        Try Again
                    </Button>
                    <Button variant="subtle" onClick={() => router.push('/login')} className="mt-2">
                        Back to Login
                    </Button>
                </Stack>
            )}
        </div>
    );
}