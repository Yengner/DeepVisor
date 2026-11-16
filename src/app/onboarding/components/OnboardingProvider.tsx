'use client';

import { BrandLockup } from '@/components/brand/Brand';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Progress, Text, Title } from '@mantine/core';
import { IconCircleCheck, IconLockCheck } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import BlockingTaskScreen from '@/components/ui/states/BlockingTaskScreen';
import {
  updateOnboardingProgress,
  type OnboardingInitial,
} from '@/lib/server/actions/business/onboarding';
import BusinessProfileStep from './steps/BusinessProfileStep';
import ConnectAccountsStep from './steps/ConnectAccountsStep';
import type { UserData } from './types';
import type { CountryOption } from '@/lib/shared/onboarding/countries';
import classes from './OnboardingProvider.module.css';

type OnboardingProviderProps = {
  initial: OnboardingInitial;
  countries: CountryOption[];
};

const STEP_LABELS = ['Your business', 'Connect Meta'];
const STEP_DESCRIPTIONS = ['Name, category, location, contact', 'Connect live ad data, or skip'];
const TOTAL_STEPS = STEP_LABELS.length;

function clampStep(step: number): number {
  return Math.min(Math.max(step, 0), TOTAL_STEPS - 1);
}

export default function OnboardingProvider({ initial, countries }: OnboardingProviderProps) {
  const [active, setActive] = useState(() => clampStep(initial.step));
  const [finishing, setFinishing] = useState(false);
  const [userData, setUserData] = useState<UserData>(() => {
    const data = initial.businessData;
    // Only what the owner has saved; no goal or signal defaults are seeded here.
    return {
      businessName: data.businessName ?? '',
      industry: data.industry ?? '',
      monthlyBudget: data.monthlyBudget ?? '',
      website: data.website ?? '',
      bookingLink: data.bookingLink ?? '',
      businessLocation: data.businessLocation ?? '',
      locationMode: data.locationMode ?? '',
      locationStreet: data.locationStreet ?? '',
      locationCity: data.locationCity ?? '',
      locationRegion: data.locationRegion ?? '',
      locationPostalCode: data.locationPostalCode ?? '',
      locationCountry: data.locationCountry ?? '',
      customerRadius: data.customerRadius ?? '',
      description: data.description ?? '',
      promotedServices: Array.isArray(data.promotedServices) ? data.promotedServices : [],
      mostValuableService: data.mostValuableService ?? '',
      metaAdsStatus: data.metaAdsStatus ?? '',
      primaryGoal: data.primaryGoal ?? '',
      leadType: data.leadType ?? '',
      preferredContactMethod: data.preferredContactMethod ?? '',
      contactMethods: Array.isArray(data.contactMethods) ? data.contactMethods : [],
      leadQualitySignal: data.leadQualitySignal ?? '',
      averageCustomerValue: data.averageCustomerValue ?? '',
      targetCostPerLead: data.targetCostPerLead ?? '',
      watchSignals: Array.isArray(data.watchSignals) ? data.watchSignals : [],
      recommendationStyle: data.recommendationStyle ?? '',
      safetyPreference: data.safetyPreference ?? '',
      adGoals: Array.isArray(data.adGoals) ? data.adGoals : [],
      preferredPlatforms: Array.isArray(data.preferredPlatforms) ? data.preferredPlatforms : [],
      emailNotifications: true,
      weeklyReports: true,
      performanceAlerts: true,
      connectedPlatforms: Array.isArray(initial.connectedPlatformKeys) ? initial.connectedPlatformKeys : [],
    };
  });
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

  // Progress counts finished steps, so nothing reads as done before it is.
  const progressValue = finishing ? 100 : Math.round((active / TOTAL_STEPS) * 100);

  return (
    <div className={classes.page}>
      <BlockingTaskScreen
        opened={finishing}
        title="Opening your workspace"
        description="Saving your setup and preparing your DeepVisor dashboard."
        mascotState="working"
      />

      <Container size="xl" className={classes.onboardingShell}>
        <header className={classes.topBar}>
          <div className={classes.brandLockup}>
            <BrandLockup />
            <span className={classes.brandSection}>WORKSPACE SETUP</span>
          </div>
          <span className={classes.stepStatus}>Step {active + 1} of {TOTAL_STEPS}</span>
        </header>

        <div className={classes.headerStack}>
          <Title order={1} className={classes.pageTitle}>Let’s set up your workspace.</Title>
          <Text className={classes.pageCopy}>
            A few details about your business, then connect Meta or continue without it.
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
              color="#bdceff"
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
              <Progress value={progressValue} size={5} radius={0} color="#004fc7" />
            </div>

            {active === 0 ? (
              <BusinessProfileStep
                countries={countries}
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
