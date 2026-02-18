import { LoadingState } from '@/components/ui/states/LoadingState';
import OnboardingProvider from './components/OnboardingProvider';
import { Suspense } from 'react';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';

export default async function OnboardingPage() {
    const user = await getLoggedInUserOrRedirect()
    return (
        <Suspense fallback={<LoadingState message="Loading Onboarding..." />}>
            <OnboardingProvider userId={user.id} />
        </Suspense>
    )
}
