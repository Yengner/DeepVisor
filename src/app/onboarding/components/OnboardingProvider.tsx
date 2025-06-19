'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Container,
  Stepper,
  Title,
  Text,
  Card,
  LoadingOverlay
} from '@mantine/core';
import { updateOnboardingProgress } from '@/lib/actions/user.actions';
import WelcomeStep from './steps/WelcomeStep';
import toast from 'react-hot-toast';
import ConnectAccountsStep from './steps/ConnectAccountsStep';
import PreferencesStep from './steps/PreferencesStep';
import BusinessProfileStep from './steps/BusinessProfileStep';
import CompletionStep from './steps/CompletionStep';

export default function OnboardingProvider() {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  interface ConnectedAccount {
    platform: string;
    accountId: string;
    connectedAt: string;
  }

  interface UserData {
    businessName: string;
    businessType: string;
    industry: string;
    adGoals: string[];
    monthlyBudget: string;
    preferredPlatforms: string[];
    connectedAccounts: ConnectedAccount[];
  }

  const [userData, setUserData] = useState<UserData>({
    businessName: '',
    businessType: '',
    industry: '',
    adGoals: [],
    monthlyBudget: '',
    preferredPlatforms: [],
    connectedAccounts: [],
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for account connection callbacks
  useEffect(() => {
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const accountId = searchParams.get('account_id');

    if (platform && status === 'success' && accountId) {
      // Add connected account
      setUserData(prev => ({
        ...prev,
        connectedAccounts: [...prev.connectedAccounts, {
          platform,
          accountId,
          connectedAt: new Date().toISOString()
        }]
      }));

      toast.success(`Successfully connected ${platform} account!`);

      // If we're on the connect step, move to next step
      if (active === 1) {
        nextStep();
      }
    } else if (platform && status === 'error') {
      toast.error(`Failed to connect ${platform} account. Please try again.`);
    }
  }, [searchParams]);

  const nextStep = async () => {
    setLoading(true);
    try {
      // Save current progress
      await updateOnboardingProgress(active === 4, active + 1);

      // If this is the last step, redirect to dashboard
      if (active === 4) {
        router.push('/dashboard');
        return;
      }

      setActive((current) => current + 1);
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      toast.error('Error saving progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const prevStep = () => {
    setActive((current) => (current > 0 ? current - 1 : current));
  };

  const handleUpdateUserData = (data: Partial<typeof userData>) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  return (
    <Container size="md" className="py-12 relative">
      <LoadingOverlay visible={loading} />

      <div className="text-center mb-12">
        <Title order={1} className="text-3xl mb-2">Welcome to DeepVisor</Title>
        <Text c="dimmed" size="lg">
          Let&apos;s set up your account to get you the best experience
        </Text>
      </div>

      <Card shadow="md" radius="lg" p="xl" withBorder>
        <Stepper active={active} onStepClick={setActive}>
          <Stepper.Step
            label="Welcome"
            description="Get started">
            <WelcomeStep
              onNext={nextStep}
              userData={userData}
              updateUserData={handleUpdateUserData}
            />
          </Stepper.Step>

          <Stepper.Step
            label="Connect Accounts"
            description="Link your platforms">
            <ConnectAccountsStep
              onNext={nextStep}
              onPrev={prevStep}
              userData={userData}
              updateUserData={handleUpdateUserData}
            />
          </Stepper.Step>

          <Stepper.Step
            label="Business Profile"
            description="About your business">
            <BusinessProfileStep
              onNext={nextStep}
              onPrev={prevStep}
              userData={userData}
              updateUserData={handleUpdateUserData}
            />
          </Stepper.Step>

          <Stepper.Step
            label="Preferences"
            description="Customize your experience">
            <PreferencesStep
              onNext={nextStep}
              onPrev={prevStep}
              userData={userData}
              updateUserData={handleUpdateUserData}
            />
          </Stepper.Step>

          <Stepper.Completed>
            <CompletionStep
              onComplete={nextStep}
              userData={userData}
            />
          </Stepper.Completed>
        </Stepper>
      </Card>
    </Container>
  );
}