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
import WelcomeStep from './steps/WelcomeStep';
import toast from 'react-hot-toast';
import PreferencesStep from './steps/PreferencesStep';
import BusinessProfileStep from './steps/BusinessProfileStep';
import CompletionStep from './steps/CompletionStep';
import { updateOnboardingProgress } from '@/lib/server/actions/business/onboarding';
import { UserData } from './types';
import { IconCheck, IconDeviceAnalytics, IconSettings, IconCircleCheck, IconClock } from '@tabler/icons-react';

export type OnboardingInitial = {
  step: number;
  completed: boolean;
  businessId: string | null;
  organizationId: string | null;
  organizationName: string;
  organizationType: 'agency' | 'business';
  connectedPlatformKeys: string[];
  businessData: {
    businessName: string;
    industry: string | null;
    monthlyBudget: string | null;
    website: string | null;
    description: string | null;
    adGoals: string[];
    preferredPlatforms: string[];
  };
};

type OnboardingProviderProps = {
  initial: OnboardingInitial;
  userId: string;
};

export default function OnboardingProvider({ initial }: OnboardingProviderProps) {
  const stepLabels = ['Welcome', 'Business', 'Intelligence'];
  const stepDescription = ['What we need', 'Business context', 'Goals and signals'];
  const totalSteps = stepLabels.length;
  const clampStep = (step: number) => Math.min(Math.max(step, 0), totalSteps);

  const [active, setActive] = useState(() => {
    if (initial.completed) return totalSteps;
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
    description: initial.businessData.description ?? '',
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
    const nextStepIndex = active + 1;

    if (nextStepIndex > totalSteps) {
      setLoading(true);
      const saved = await persistProgress(totalSteps, true);
      setLoading(false);
      if (saved) router.push('/integration');
      return;
    }

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

  const progressValue = Math.min(100, Math.round((Math.min(active, totalSteps) / totalSteps) * 100));
  const autosaveLabel = isAutosaving
    ? 'Saving changes...'
    : lastSavedAt
      ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Autosave enabled';

  return (
    <Container size="lg" className="py-10 relative">
      <BlockingTaskScreen
        opened={loading}
        title="Finishing onboarding"
        description="We are saving your setup and taking you to Integrations so you can connect a platform there."
      />

      <Stack gap="lg" className="mb-8">
        <Group justify="apart" align="flex-start">
          <div>
            <Badge variant="light" color="blue" mb="sm">
              Required setup
            </Badge>
            <Title order={1} className="text-3xl mb-2">Set up your account intelligence profile</Title>
            <Text c="dimmed" size="lg">
              Answer the core questions first. Platform connection happens after onboarding in Integrations.
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
                      <Group justify="apart" align="center">
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
                label={stepLabels[2]}
                description={stepDescription[2]}
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
                <CompletionStep onComplete={nextStep} userData={userData} />
              </Stepper.Completed>
            </Stepper>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
