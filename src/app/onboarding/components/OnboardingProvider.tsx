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
import { updateOnboardingProgress, getOnboardingProgress, getLoggedInUser } from '@/lib/actions/user.actions';
import WelcomeStep from './steps/WelcomeStep';
import toast from 'react-hot-toast';
import ConnectAccountsStep from './steps/ConnectAccountsStep';
import PreferencesStep from './steps/PreferencesStep';
import BusinessProfileStep from './steps/BusinessProfileStep';
import CompletionStep from './steps/CompletionStep';
import { createClient } from '@/lib/utils/supabase/clients/browser';

export default function OnboardingProvider() {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

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

  // Load initial state when component mounts
  useEffect(() => {
    async function loadOnboardingProgress() {
      try {
        const { success, step, connectedAccounts } = await getOnboardingProgress();

        if (success) {
          // Set the active step
          setActive(step);

          // Set connected accounts from database
          if (connectedAccounts && connectedAccounts.length > 0) {
            setUserData(prev => ({
              ...prev,
              connectedAccounts: connectedAccounts
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load onboarding progress:', error);
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    }

    loadOnboardingProgress();
  }, []);

  // Check for account connection callbacks (only after initial load)
  useEffect(() => {
    if (!initialLoadComplete) return;

    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const accountId = searchParams.get('account_id');

    if (platform && status === 'success' && accountId) {
      // Check if this account is already connected
      const isAlreadyConnected = userData.connectedAccounts.some(
        acc => acc.platform === platform && acc.accountId === accountId
      );

      if (!isAlreadyConnected) {
        // Add connected account
        const newConnectedAccounts = [
          ...userData.connectedAccounts,
          {
            platform,
            accountId,
            connectedAt: new Date().toISOString()
          }
        ];

        setUserData(prev => ({
          ...prev,
          connectedAccounts: newConnectedAccounts
        }));

        // Also save to database
        updateConnectedAccountsInDatabase(newConnectedAccounts);

        toast.success(`Successfully connected ${platform} account!`);

        // If we're on the connect step, move to next step
        if (active === 1) {
          nextStep();
        }
      } else {
        toast(`Your ${platform} account was already connected.`);
      }

      // Clear URL params to avoid reprocessing on refresh
      router.replace('/onboarding');
    } else if (platform && status === 'error') {
      toast.error(`Failed to connect ${platform} account. Please try again.`);
      // Clear URL params
      router.replace('/onboarding');
    }
  }, [searchParams, initialLoadComplete, userData.connectedAccounts, active, router]);

  // Save connected accounts to database
  const updateConnectedAccountsInDatabase = async (accounts: ConnectedAccount[]) => {
    try {
      const supabase = createClient();
      const user = await getLoggedInUser();;
      if (user) {
        await supabase
          .from('profiles')
          .update({
            connected_accounts: accounts,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    } catch (error) {
      console.error('Failed to update connected accounts:', error);
    }
  };

  const nextStep = async () => {
    setLoading(true);
    try {
      const nextStepIndex = active + 1;

      // Save current progress
      await updateOnboardingProgress(nextStepIndex === 4, nextStepIndex);

      // If this is the last step, redirect to dashboard
      if (nextStepIndex === 5) {
        router.push('/dashboard');
        return;
      }

      setActive(nextStepIndex);
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      toast.error('Error saving progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const prevStep = () => {
    const prevStepIndex = active > 0 ? active - 1 : 0;
    updateOnboardingProgress(false, prevStepIndex).catch(console.error);
    setActive(prevStepIndex);
  };

  const handleUpdateUserData = (data: Partial<typeof userData>) => {
    setUserData(prev => ({ ...prev, ...data }));
  };

  return (
    <Container size="md" className="py-8 relative">
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