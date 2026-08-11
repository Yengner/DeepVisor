'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Stepper,
  Title,
  Text,
  Grid,
  Progress,
} from '@mantine/core';
import BlockingTaskScreen from '@/components/ui/states/BlockingTaskScreen';
import toast from 'react-hot-toast';
import PreferencesStep from './steps/PreferencesStep';
import BusinessProfileStep from './steps/BusinessProfileStep';
import ReviewStartStep from './steps/ReviewStartStep';
import { updateOnboardingProgress } from '@/lib/server/actions/business/onboarding';
import { UserData } from './types';
import {
  IconCheck,
  IconCircleCheck,
  IconDeviceAnalytics,
  IconLockCheck,
  IconSettings,
} from '@tabler/icons-react';
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
    <main className={classes.page}>
      <BlockingTaskScreen
        opened={loading}
        title="Finishing onboarding"
        description="We are saving your salon profile and preparing your DeepVisor dashboard."
      />

      <Container size="xl" className={classes.onboardingShell}>
        <header className={classes.topBar}>
          <div className={classes.brandLockup}>
            <span className={classes.brandMark}>DV</span>
            <span>DEEPVISOR</span>
            <span className={classes.brandSection}>INTELLIGENCE SETUP</span>
          </div>
          <div className={classes.saveState} aria-live="polite">
            <span className={isAutosaving ? classes.savingDot : classes.savedDot} aria-hidden="true" />
            {autosaveLabel}
          </div>
        </header>

        <div className={classes.headerStack}>
          <span className={classes.pageKicker}>BUSINESS PROFILE / 03 STEPS</span>
          <Title order={1} className={classes.pageTitle}>Set your decision context.</Title>
          <Text className={classes.pageCopy}>
            Give DeepVisor the business signals it needs to judge ad performance against what actually matters.
          </Text>
        </div>

        <Grid gutter={{ base: 18, md: 28 }} align="flex-start">
          <Grid.Col span={{ base: 12, md: 4 }} className={classes.progressColumn}>
            <aside className={classes.progressCard}>
              <div className={classes.progressHeader}>
                <div>
                  <span>PROFILE COMPLETION</span>
                  <strong>{progressValue}%</strong>
                </div>
                <span>~3-5 MIN</span>
              </div>
              <Progress
                value={progressValue}
                size={6}
                radius={0}
                color="#c8ff56"
                className={classes.railProgress}
              />

              <div className={classes.stepList}>
                {stepLabels.map((label, idx) => {
                  const isDone = active > idx;
                  const isActive = active === idx;
                  const stepClassName = [
                    classes.progressStep,
                    isActive ? classes.progressStepActive : '',
                    isDone ? classes.progressStepDone : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <div key={label} className={stepClassName}>
                      <span className={classes.stepNumber}>
                        {isDone ? <IconCircleCheck size={17} /> : String(idx + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <strong>{label}</strong>
                        <span>{stepDescription[idx]}</span>
                      </div>
                      {isActive ? <span className={classes.activeLabel}>ACTIVE</span> : null}
                    </div>
                  );
                })}
              </div>

              <div className={classes.railNote}>
                <IconLockCheck size={18} />
                <span>Recommendations stay approval-first. Nothing changes without you.</span>
              </div>
            </aside>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            <section className={classes.formSurface}>
              <div className={classes.mobileProgress}>
                <span>STEP {Math.min(active + 1, totalSteps)} OF {totalSteps}</span>
                <strong>{stepLabels[active]}</strong>
                <Progress value={progressValue} size={5} radius={0} color="#0b7a4b" />
              </div>
              <Stepper active={active} onStepClick={() => { }} size="sm" className={classes.stepper}>
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
            </section>
          </Grid.Col>
        </Grid>
      </Container>
    </main>
  );
}
