'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@mantine/core';
import BlockingTaskScreen from '@/components/ui/states/BlockingTaskScreen';
import toast from 'react-hot-toast';
import PreferencesStep from './steps/PreferencesStep';
import BusinessProfileStep from './steps/BusinessProfileStep';
import ReviewStartStep from './steps/ReviewStartStep';
import { updateOnboardingProgress } from '@/lib/server/actions/business/onboarding';
import { UserData } from './types';
import { IconCheck, IconDeviceAnalytics, IconSettings, IconCircleCheck, IconClock } from '@tabler/icons-react';
import type { Database } from '@/lib/shared/types/supabase';
import classes from './OnboardingProvider.module.css';
import {
  DEFAULT_INTELLIGENCE_GOALS,
  DEFAULT_WATCH_SIGNALS,
} from '@/lib/shared/onboarding/businessProfileOptions';

type OrganizationType = Database['public']['Enums']['organization_type'];

export type OnboardingInitial = {
  step: number;
  completed: boolean;
  businessId: string | null;
  organizationId: string | null;
  organizationName: string;
  organizationType: OrganizationType;
  connectedPlatformKeys: string[];
  businessData: {
    businessName: string;
    industry: string | null;
    monthlyBudget: string | null;
    website: string | null;
    bookingLink: string | null;
    businessLocation: string | null;
    customerRadius: string | null;
    description: string | null;
    promotedServices: string[];
    mostValuableService: string | null;
    metaAdsStatus: string | null;
    primaryGoal: string | null;
    leadType: string | null;
    preferredContactMethod: string | null;
    leadQualitySignal: string | null;
    averageCustomerValue: string | null;
    targetCostPerLead: string | null;
    watchSignals: string[];
    recommendationStyle: string | null;
    safetyPreference: string | null;
    adGoals: string[];
    preferredPlatforms: string[];
  };
};

type OnboardingProviderProps = {
  initial: OnboardingInitial;
  userId: string;
};

export default function OnboardingProvider({ initial }: OnboardingProviderProps) {
  const stepLabels = ['Business Context', 'Intelligence Goals', 'Review & Start'];
  const stepDescription = ['Business, services, budget', 'Goals, signals, guardrails', 'Confirm setup'];
  const totalSteps = stepLabels.length;
  const clampStep = (step: number) => Math.min(Math.max(step, 0), totalSteps - 1);

  const [active, setActive] = useState(() => {
    if (initial.completed) return totalSteps - 1;
    return clampStep(initial.step);
  });
  const [loading, setLoading] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<number | null>(null);

  const [userData, setUserData] = useState<UserData>(() => ({
    businessName: initial.businessData.businessName ?? '',
    industry: initial.businessData.industry ?? '',
    monthlyBudget: initial.businessData.monthlyBudget ?? '',
    website: initial.businessData.website ?? '',
    bookingLink: initial.businessData.bookingLink ?? '',
    businessLocation: initial.businessData.businessLocation ?? '',
    customerRadius: initial.businessData.customerRadius ?? '',
    description: initial.businessData.description ?? '',
    promotedServices: Array.isArray(initial.businessData.promotedServices)
      ? initial.businessData.promotedServices
      : [],
    mostValuableService: initial.businessData.mostValuableService ?? '',
    metaAdsStatus: initial.businessData.metaAdsStatus ?? '',
    primaryGoal: initial.businessData.primaryGoal ?? DEFAULT_INTELLIGENCE_GOALS.primaryGoal,
    leadType: initial.businessData.leadType ?? DEFAULT_INTELLIGENCE_GOALS.leadType,
    preferredContactMethod: initial.businessData.preferredContactMethod ?? DEFAULT_INTELLIGENCE_GOALS.preferredContactMethod,
    leadQualitySignal: initial.businessData.leadQualitySignal ?? DEFAULT_INTELLIGENCE_GOALS.leadQualitySignal,
    averageCustomerValue: initial.businessData.averageCustomerValue ?? '',
    targetCostPerLead: initial.businessData.targetCostPerLead ?? '',
    watchSignals: Array.isArray(initial.businessData.watchSignals) && initial.businessData.watchSignals.length > 0
      ? initial.businessData.watchSignals
      : [...DEFAULT_WATCH_SIGNALS],
    recommendationStyle: initial.businessData.recommendationStyle ?? DEFAULT_INTELLIGENCE_GOALS.recommendationStyle,
    safetyPreference: initial.businessData.safetyPreference ?? DEFAULT_INTELLIGENCE_GOALS.safetyPreference,
    adGoals: Array.isArray(initial.businessData.adGoals) ? initial.businessData.adGoals : [],
    preferredPlatforms: Array.isArray(initial.businessData.preferredPlatforms)
      ? initial.businessData.preferredPlatforms
      : [],
    emailNotifications: true,
    weeklyReports: true,
    performanceAlerts: true,
    connectedPlatforms: Array.isArray(initial.connectedPlatformKeys) ? initial.connectedPlatformKeys : [],
  }));

  const router = useRouter();
  const canPersist = Boolean(initial.businessId);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  const persistProgress = async (step: number, completed?: boolean) => {
    if (!canPersist) return true;
    setIsAutosaving(true);
    try {
      const progressRes = await updateOnboardingProgress({ step, completed });
      if (!progressRes.success) {
        toast.error(progressRes.error.userMessage);
        return false;
      }
      setLastSavedAt(new Date());
      return true;
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      toast.error('Error saving progress. Please try again.');
      return false;
    } finally {
      setIsAutosaving(false);
    }
  };

  const nextStep = async () => {
    if (loading) return;

    if (active >= totalSteps - 1) {
      setLoading(true);
      const saved = await persistProgress(totalSteps, true);
      setLoading(false);
      if (saved) router.push('/integration');
      return;
    }

    const nextStepIndex = active + 1;
    setActive(nextStepIndex);
    void persistProgress(Math.min(nextStepIndex, totalSteps), false);
  };

  const prevStep = () => {
    if (loading) return;
    const prevStepIndex = active > 0 ? active - 1 : 0;
    setActive(prevStepIndex);
    void persistProgress(prevStepIndex, false);
  };

  const handleUpdateUserData = (data: Partial<typeof userData>) => {
    setUserData((prev) => ({ ...prev, ...data }));
    setIsAutosaving(true);
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(() => {
      setIsAutosaving(false);
      setLastSavedAt(new Date());
    }, 800);
  };

  const progressValue = Math.min(100, Math.round(((Math.min(active, totalSteps - 1) + 1) / totalSteps) * 100));
  const autosaveLabel = isAutosaving
    ? 'Saving changes...'
    : lastSavedAt
      ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Autosave enabled';

  return (
    <Container size="lg" className={`py-10 relative ${classes.onboardingShell}`}>
      <BlockingTaskScreen
        opened={loading}
        title="Finishing onboarding"
        description="We are saving your salon profile and preparing your DeepVisor dashboard."
      />

      <Stack gap="lg" className={classes.headerStack}>
        <Group justify="space-between" align="flex-start">
          <div>
            <Badge variant="light" color="blue" mb="sm" radius="xl">
              Salon setup
            </Badge>
            <Title order={1} className={classes.pageTitle}>Set up your salon intelligence profile</Title>
            <Text c="dimmed" size="lg" className={classes.pageCopy}>
              Tell DeepVisor what services, leads, and outcomes matter before it reviews ad performance.
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

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, md: 4 }} className={classes.progressColumn}>
          <Card shadow="sm" radius="xl" p="lg" withBorder className={classes.progressCard}>
            <Stack gap="md">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Progress
                </Text>
                <Group justify="space-between" mt={4}>
                  <Text fw={600}>{progressValue}% complete</Text>
                  <Text size="xs" c="dimmed">
                    ~3-5 min
                  </Text>
                </Group>
                <Progress value={progressValue} size="sm" radius="xl" mt="xs" />
              </div>

              <Stack gap="sm">
                {stepLabels.map((label, idx) => {
                  const isDone = active > idx;
                  const isActive = active === idx;
                  return (
                    <Paper
                      key={label}
                      withBorder
                      radius="md"
                      p="sm"
                      style={{ borderColor: isActive ? 'var(--mantine-color-blue-5)' : undefined }}
                    >
                      <Group justify="space-between" align="center">
                        <Group gap="xs">
                          <ThemeIcon
                            size="sm"
                            radius="xl"
                            color={isDone ? 'green' : isActive ? 'blue' : 'gray'}
                            variant="light"
                          >
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
          <Card shadow="md" radius="xl" p="xl" withBorder className={classes.formCard}>
            <Stepper active={active} onStepClick={() => { }} size="sm">
              <Stepper.Step
                label={stepLabels[0]}
                description={stepDescription[0]}
                icon={<IconDeviceAnalytics size={16} />}
              >
                <BusinessProfileStep
                  onNext={nextStep}
                  onPrev={prevStep}
                  userData={userData}
                  updateUserData={handleUpdateUserData}
                  showBack={false}
                />
              </Stepper.Step>

              <Stepper.Step
                label={stepLabels[1]}
                description={stepDescription[1]}
                icon={<IconSettings size={16} />}
              >
                <PreferencesStep
                  onNext={nextStep}
                  onPrev={prevStep}
                  userData={userData}
                  updateUserData={handleUpdateUserData}
                />
              </Stepper.Step>

              <Stepper.Step
                label={stepLabels[2]}
                description={stepDescription[2]}
                icon={<IconCheck size={16} />}
              >
                <ReviewStartStep
                  onComplete={nextStep}
                  onPrev={prevStep}
                  userData={userData}
                  loading={loading}
                />
              </Stepper.Step>
            </Stepper>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
