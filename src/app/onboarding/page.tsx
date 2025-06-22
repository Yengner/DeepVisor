import { LoadingState } from '@/components/ui/states/LoadingState';
import OnboardingProvider from './components/OnboardingProvider';
import { Suspense } from 'react';

export default function OnboardingPage() {
    return (
        <Suspense fallback={<LoadingState message="Loading Onboarding..." />}>
            <OnboardingProvider />;
        </Suspense>
    )
}
