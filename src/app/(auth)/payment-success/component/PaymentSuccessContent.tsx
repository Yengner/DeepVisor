'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingState } from '@/components/ui/states/LoadingState';
import { ErrorState } from '@/components/ui/states/ErrorState';
import { SuccessState } from '@/components/ui/states/SuccessState';
import toast from 'react-hot-toast';
import { verifyPaymentAndStoreSubscription } from '@/lib/actions/stripe/stripe.actions';

export default function PaymentSuccessContent() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        if (!sessionId || typeof sessionId !== 'string') {
            setStatus('error');
            setError('Invalid session information. Please contact support.');
            return;
        }

        async function verifyAndStore() {
            try {
                const result = await verifyPaymentAndStoreSubscription(sessionId as string);

                if (result.success) {
                    setStatus('success');
                    // Wait a moment before redirecting to onboarding
                    setTimeout(() => {
                        router.push('/onboarding');
                    }, 3000);
                } else {
                    setStatus('error');
                    setError(result.error || 'Something went wrong with your payment verification.');
                }
            } catch (err) {
                console.error('Error verifying payment:', err);
                setStatus('error');
                setError('Failed to verify your payment. Please contact support.');
                toast.error('Something went wrong. Our team has been notified.');
            }
        }

        verifyAndStore();
    }, [sessionId, router]);

    if (status === 'loading') {
        return <LoadingState message="Verifying your payment..." />;
    }

    if (status === 'error') {
        return (
            <ErrorState
                title="Payment Verification Failed"
                message={error || 'Something went wrong. Please contact our support team.'}
                primaryAction={{
                    label: "Contact Support",
                    href: "/support"
                }}
                secondaryAction={{
                    label: "Return to Plans",
                    href: "/select-plan",
                    onClick: () => { }
                }}
            />
        );
    }

    return (
        <SuccessState
            title="Payment Successful!"
            message="Thank you for subscribing to DeepVisor! We're setting up your account and will guide you through the next steps momentarily."
            primaryAction={{
                label: "Continue to Onboarding",
                href: "/onboarding"
            }}
        />
    );
}