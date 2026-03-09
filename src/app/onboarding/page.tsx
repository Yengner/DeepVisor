import OnboardingProvider from './components/OnboardingProvider';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';
import { getOnboardingInitial } from '@/lib/server/actions/business/onboarding';

export default async function OnboardingPage() {
  const user = await getLoggedInUserOrRedirect();
  const res = await getOnboardingInitial();

  const init = res.success
    ? res.data
    : {
      step: 0,
      completed: false,
      businessId: null,
      connectedPlatformKeys: [],
      businessData: {
        businessName: '',
        industry: '',
        monthlyBudget: '',
        website: '',
        description: '',
        adGoals: [],
        preferredPlatforms: [],
      },
    };

  return <OnboardingProvider initial={init} userId={user.id} />;
}
