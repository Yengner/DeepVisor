import { LoadingState } from '@/components/ui/states/LoadingState';
import OnboardingProvider from './components/OnboardingProvider';
import { Suspense } from 'react';
import { getLoggedInUser } from '@/lib/actions/user';

export default async function OnboardingPage() {
    const userId = await getLoggedInUser().then((user: { id: string }) => user?.id);
    return (
        <Suspense fallback={<LoadingState message="Loading Onboarding..." />}>
            <OnboardingProvider userId={userId} />;
        </Suspense>
    )
}
