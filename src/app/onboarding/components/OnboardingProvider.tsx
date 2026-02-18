'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Container,
  Stepper,
  Title,
  Text,
  Card,
  Group,
  Badge,
  Stack,
  Grid,
  Paper,
  Progress,
  ThemeIcon,
  LoadingOverlay
} from '@mantine/core';
import WelcomeStep from './steps/WelcomeStep';
import toast from 'react-hot-toast';
import ConnectAccountsStep from './steps/ConnectAccountsStep';
import PreferencesStep from './steps/PreferencesStep';
import BusinessProfileStep from './steps/BusinessProfileStep';
import CompletionStep from './steps/CompletionStep';
import { getOnboardingProgress, updateBusinessProfileData, updateOnboardingProgress } from '@/lib/server/actions/business/onboarding/onboarding';
import { UserData } from './types';
import { updateConnectedAccountsInDatabase } from './utils';
import { IconCheck, IconDeviceAnalytics, IconPlug, IconSettings, IconCircleCheck, IconClock } from '@tabler/icons-react';


export default function OnboardingProvider({ userId }: { userId: string }) {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<number | null>(null);

  const [userData, setUserData] = useState<UserData>({
    businessName: '',
    businessType: '',
    industry: '',
    monthlyBudget: '',
    website: '',
    description: '',
    adGoals: [],
    preferredPlatforms: [],
    emailNotifications: true,
    weeklyReports: true,
    performanceAlerts: true,
    connectedAccounts: [],
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  // Load initial state when component mounts
  useEffect(() => {
    async function loadOnboardingProgress() {
      try {
        const { success, step, connectedAccounts, businessData } = await getOnboardingProgress(userId);

        if (success) {
          setActive(step);

          if (connectedAccounts && connectedAccounts.length > 0) {
            setUserData(prev => ({
              ...prev,
              connectedAccounts: connectedAccounts
            }));
          }

          if (businessData) {
            setUserData(prev => ({
              ...prev,
              businessName: businessData.businessName || prev.businessName,
              businessType: businessData.businessType || prev.businessType,
              industry: businessData.industry || prev.industry,
              monthlyBudget: businessData.monthlyBudget || prev.monthlyBudget,
              adGoals: Array.isArray(businessData.adGoals) && businessData.adGoals.length ? businessData.adGoals : prev.adGoals,
              website: businessData.website || prev.website,
              description: businessData.description || prev.description,
              preferredPlatforms: Array.isArray(businessData.preferredPlatforms) && businessData.preferredPlatforms.length ? businessData.preferredPlatforms : prev.preferredPlatforms,
              emailNotifications: businessData.emailNotifications !== undefined ? businessData.emailNotifications : prev.emailNotifications,
              weeklyReports: businessData.weeklyReports !== undefined ? businessData.weeklyReports : prev.weeklyReports,
              performanceAlerts: businessData.performanceAlerts !== undefined ? businessData.performanceAlerts : prev.performanceAlerts,
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

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  // Check for account connection callbacks (only after initial load)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!initialLoadComplete) return;

    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const accountId = searchParams.get('account_id');

    if (platform && status === 'success' && accountId) {
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
        updateConnectedAccountsInDatabase({ userId, accounts: newConnectedAccounts });

        toast.success(`Successfully connected ${platform} account!`);

        // If we're on the connect step, move to next step
        if (active === 1) {
          nextStep();
        }
      } else {
        toast(`Your ${platform} account was already connected.`);
      }

      router.replace('/onboarding');
    } else if (platform && status === 'error') {
      toast.error(`Failed to connect ${platform} account. Please try again.`);
      // Clear URL params
      router.replace('/onboarding');
    }
  }, [searchParams, initialLoadComplete, userData.connectedAccounts, active, router]);

  // Save connected accounts to database


  const nextStep = async () => {
    setLoading(true);
    setIsAutosaving(true);
    try {
      if (active === 2) {
        console.log("Saving business profile data:", {
          businessName: userData.businessName,
          businessType: userData.businessType,
          industry: userData.industry,
          website: userData.website,
          description: userData.description,
          monthlyBudget: userData.monthlyBudget
        });
        await updateBusinessProfileData({
          businessName: userData.businessName,
          businessType: userData.businessType,
          industry: userData.industry,
          website: userData.website,
          description: userData.description,
          monthlyBudget: userData.monthlyBudget
        });
      }
      else if (active === 3) {
        console.log("Saving preferences data:", {
          adGoals: userData.adGoals,
          preferredPlatforms: userData.preferredPlatforms,
          emailNotifications: userData.emailNotifications,
          weeklyReports: userData.weeklyReports,
          performanceAlerts: userData.performanceAlerts
        });
        await updateBusinessProfileData({
          adGoals: userData.adGoals,
          preferredPlatforms: userData.preferredPlatforms,
          emailNotifications: userData.emailNotifications,
          weeklyReports: userData.weeklyReports,
          performanceAlerts: userData.performanceAlerts
        });
      }

      // After saving, proceed to next step
      const nextStepIndex = active + 1;

      // Save current progress
      await updateOnboardingProgress(nextStepIndex === 4, nextStepIndex);

      // If this is the last step, redirect to dashboard
      if (nextStepIndex >= 5) {
        router.push('/dashboard');
        return;
      }

      setActive(nextStepIndex);
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      toast.error('Error saving progress. Please try again.');
    } finally {
      setLoading(false);
      setIsAutosaving(false);
      setLastSavedAt(new Date());
    }
  };

  const prevStep = () => {
    const prevStepIndex = active > 0 ? active - 1 : 0;
    updateOnboardingProgress(false, prevStepIndex).catch(console.error);
    setActive(prevStepIndex);
  };

  const handleUpdateUserData = (data: Partial<typeof userData>) => {
    console.log("Updating userData in parent:", data);
    setUserData(prev => {
      const newState = { ...prev, ...data };
      console.log("New userData state:", newState);
      return newState;
    });
    setIsAutosaving(true);
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(() => {
      setIsAutosaving(false);
      setLastSavedAt(new Date());
    }, 800);
  };

  const stepLabels = ["Welcome", "Connect", "Business", "Preferences"];
  const stepDescription = [
    "Get started",
    "Link platforms",
    "About your business",
    "Customize your experience",
  ];
  const totalSteps = 4;
  const progressValue = Math.min(100, Math.round(((Math.min(active, totalSteps)) / totalSteps) * 100));
  const autosaveLabel = isAutosaving
    ? "Saving changes…"
    : lastSavedAt
      ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Autosave enabled";

  return (
    <Container size="lg" className="py-10 relative">
      <LoadingOverlay visible={loading} />

      <Stack gap="lg" className="mb-8">
        <Group justify="apart" align="flex-start">
          <div>
            <Title order={1} className="text-3xl mb-2">Welcome to DeepVisor</Title>
            <Text c="dimmed" size="lg">
              Let&apos;s set up your account with a few quick steps.
            </Text>
          </div>
          <Stack gap={4} align="flex-end">
            <Badge size="lg" variant="light">
              Step {Math.min(active + 1, totalSteps)} of {totalSteps}
            </Badge>
            <Text size="xs" c="dimmed">
              {autosaveLabel}
            </Text>
          </Stack>
        </Group>
      </Stack>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" radius="lg" p="lg" withBorder>
            <Stack gap="md">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Progress
                </Text>
                <Group justify="apart" mt={4}>
                  <Text fw={600}>{progressValue}% complete</Text>
                  <Text size="xs" c="dimmed">
                    ~3–5 min
                  </Text>
                </Group>
                <Progress value={progressValue} size="sm" radius="xl" mt="xs" />
              </div>

              <Stack gap="sm">
                {stepLabels.map((label, idx) => {
                  const isDone = active > idx;
                  const isActive = active === idx;
                  return (
                    <Paper key={label} withBorder radius="md" p="sm" style={{ borderColor: isActive ? "var(--mantine-color-blue-5)" : undefined }}>
                      <Group justify="apart" align="center">
                        <Group gap="xs">
                          <ThemeIcon size="sm" radius="xl" color={isDone ? "green" : isActive ? "blue" : "gray"} variant="light">
                            {isDone ? <IconCircleCheck size={14} /> : <IconClock size={14} />}
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={600}>{label}</Text>
                            <Text size="xs" c="dimmed">{stepDescription[idx]}</Text>
                          </div>
                        </Group>
                        {isDone && (
                          <Badge size="xs" color="green" variant="light">
                            Done
                          </Badge>
                        )}
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card shadow="md" radius="lg" p="xl" withBorder>
            <Stepper active={active} onStepClick={() => { }} size="sm">
              <Stepper.Step
                label={stepLabels[0]}
                description={stepDescription[0]}
                icon={<IconCheck size={16} />}
              >
                <WelcomeStep
                  onNext={nextStep}
                  userData={userData}
                  updateUserData={handleUpdateUserData}
                />
              </Stepper.Step>

              <Stepper.Step
                label={stepLabels[1]}
                description={stepDescription[1]}
                icon={<IconPlug size={16} />}
              >
                <ConnectAccountsStep
                  onNext={nextStep}
                  onPrev={prevStep}
                  userData={userData}
                  updateUserData={handleUpdateUserData}
                />
              </Stepper.Step>

              <Stepper.Step
                label={stepLabels[2]}
                description={stepDescription[2]}
                icon={<IconDeviceAnalytics size={16} />}
              >
                <BusinessProfileStep
                  onNext={nextStep}
                  onPrev={prevStep}
                  userData={userData}
                  updateUserData={handleUpdateUserData}
                />
              </Stepper.Step>

              <Stepper.Step
                label={stepLabels[3]}
                description={stepDescription[3]}
                icon={<IconSettings size={16} />}
              >
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
        </Grid.Col>
      </Grid>
    </Container>
  );
}
