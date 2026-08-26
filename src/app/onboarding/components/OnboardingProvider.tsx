'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Progress, Text, Title } from '@mantine/core';
import { IconCheck, IconCircleCheck, IconLockCheck } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import BlockingTaskScreen from '@/components/ui/states/BlockingTaskScreen';
import {
  updateOnboardingProgress,
  type OnboardingInitial,
} from '@/lib/server/actions/business/onboarding';
import {
  DEFAULT_INTELLIGENCE_GOALS,
  DEFAULT_WATCH_SIGNALS,
} from '@/lib/shared/onboarding/businessProfileOptions';
import BusinessProfileStep from './steps/BusinessProfileStep';
import ConnectAccountsStep from './steps/ConnectAccountsStep';
import type { UserData } from './types';
import classes from './OnboardingProvider.module.css';

type OnboardingProviderProps = {
  initial: OnboardingInitial;
};

const STEP_LABELS = ['Business essentials', 'Connect Meta'];
const STEP_DESCRIPTIONS = ['Name, service, location, contact', 'Connect live data or skip'];
const TOTAL_STEPS = STEP_LABELS.length;

function clampStep(step: number): number {
  return Math.min(Math.max(step, 0), TOTAL_STEPS - 1);
}

export default function OnboardingProvider({ initial }: OnboardingProviderProps) {
  const [active, setActive] = useState(() => clampStep(initial.step));
  const [finishing, setFinishing] = useState(false);
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
    leadType: initial.businessData.leadType ?? '',
    preferredContactMethod: initial.businessData.preferredContactMethod ?? '',
    leadQualitySignal:
      initial.businessData.leadQualitySignal ?? DEFAULT_INTELLIGENCE_GOALS.leadQualitySignal,
    averageCustomerValue: initial.businessData.averageCustomerValue ?? '',
    targetCostPerLead: initial.businessData.targetCostPerLead ?? '',
    watchSignals:
      Array.isArray(initial.businessData.watchSignals) && initial.businessData.watchSignals.length > 0
        ? initial.businessData.watchSignals
        : [...DEFAULT_WATCH_SIGNALS],
    recommendationStyle:
      initial.businessData.recommendationStyle ?? DEFAULT_INTELLIGENCE_GOALS.recommendationStyle,
    safetyPreference:
      initial.businessData.safetyPreference ?? DEFAULT_INTELLIGENCE_GOALS.safetyPreference,
    adGoals: Array.isArray(initial.businessData.adGoals) ? initial.businessData.adGoals : [],
    preferredPlatforms: Array.isArray(initial.businessData.preferredPlatforms)
      ? initial.businessData.preferredPlatforms
      : [],
    emailNotifications: true,
    weeklyReports: true,
    performanceAlerts: true,
    connectedPlatforms: Array.isArray(initial.connectedPlatformKeys)
      ? initial.connectedPlatformKeys
      : [],
  }));
  const router = useRouter();

  const persistProgress = async (step: number, completed: boolean) => {
    try {
      const progressRes = await updateOnboardingProgress({ step, completed });
      if (!progressRes.success) {
        toast.error(progressRes.error.userMessage);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      toast.error('Your progress could not be saved. Please try again.');
      return false;
    }
  };

  const nextStep = async () => {
    if (finishing) return;

    if (active === 0) {
      const saved = await persistProgress(1, false);
      if (saved) setActive(1);
      return;
    }

    setFinishing(true);
    const saved = await persistProgress(TOTAL_STEPS, true);
    if (saved) {
      router.replace('/dashboard');
      return;
    }
    setFinishing(false);
  };

  const prevStep = async () => {
    if (finishing || active === 0) return;
    const saved = await persistProgress(0, false);
    if (saved) setActive(0);
  };

  const progressValue = active === 0 ? 50 : 100;

  return (
    <div className={classes.page}>
      <BlockingTaskScreen
        opened={finishing}
        title="Opening your workspace"
        description="We are saving setup and preparing your DeepVisor dashboard."
      />

      <Container size="xl" className={classes.onboardingShell}>
        <header className={classes.topBar}>
          <div className={classes.brandLockup}>
            <span className={classes.brandMark}>DV</span>
            <span>DEEPVISOR</span>
            <span className={classes.brandSection}>WORKSPACE SETUP</span>
          </div>
          <span className={classes.stepStatus}>Step {active + 1} of {TOTAL_STEPS}</span>
        </header>

        <div className={classes.headerStack}>
          <span className={classes.pageKicker}>TWO-STAGE SETUP</span>
          <Title order={1} className={classes.pageTitle}>Get to a useful dashboard quickly.</Title>
          <Text className={classes.pageCopy}>
            Add the business signals DeepVisor cannot safely infer, then connect Meta or continue without it.
          </Text>
        </div>

        <div className={classes.contentGrid}>
          <aside className={classes.progressColumn} aria-label="Onboarding progress">
            <div className={classes.progressHeader}>
              <div>
                <span>SETUP PROGRESS</span>
                <strong>{progressValue}%</strong>
              </div>
              <span>ABOUT 2 MIN</span>
            </div>
            <Progress
              value={progressValue}
              size={6}
              radius={0}
              color="#c8ff56"
              className={classes.railProgress}
            />

            <div className={classes.stepList}>
              {STEP_LABELS.map((label, index) => {
                const isDone = active > index;
                const isActive = active === index;
                const stepClassName = [
                  classes.progressStep,
                  isActive ? classes.progressStepActive : '',
                  isDone ? classes.progressStepDone : '',
                ].filter(Boolean).join(' ');

                return (
                  <div key={label} className={stepClassName}>
                    <span className={classes.stepNumber}>
                      {isDone ? <IconCircleCheck size={17} /> : String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <strong>{label}</strong>
                      <span>{STEP_DESCRIPTIONS[index]}</span>
                    </div>
                    {isActive ? <IconCheck size={16} className={classes.activeIcon} /> : null}
                  </div>
                );
              })}
            </div>

            <div className={classes.railNote}>
              <IconLockCheck size={18} />
              <span>Nothing is published or changed without your approval.</span>
            </div>
          </aside>

          <section className={classes.formSurface}>
            <div className={classes.mobileProgress}>
              <div>
                <span>STEP {active + 1} OF {TOTAL_STEPS}</span>
                <strong>{STEP_LABELS[active]}</strong>
              </div>
              <Progress value={progressValue} size={5} radius={0} color="#0b7a4b" />
            </div>

            {active === 0 ? (
              <BusinessProfileStep
                onNext={nextStep}
                onPrev={prevStep}
                userData={userData}
                updateUserData={(data) => setUserData((current) => ({ ...current, ...data }))}
                showBack={false}
              />
            ) : (
              <ConnectAccountsStep
                onNext={nextStep}
                onPrev={prevStep}
                userData={userData}
                updateUserData={(data) => setUserData((current) => ({ ...current, ...data }))}
              />
            )}
          </section>
        </div>
      </Container>
    </div>
  );
}
