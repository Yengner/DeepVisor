'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconCheck,
  IconChevronLeft,
  IconShieldCheck,
} from '@tabler/icons-react';
import type { UserData } from '../types';
import {
  AVERAGE_CUSTOMER_VALUE_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  CUSTOMER_RADIUS_OPTIONS,
  LEAD_QUALITY_SIGNAL_OPTIONS,
  LEAD_TYPE_OPTIONS,
  INTELLIGENCE_GOAL_OPTIONS,
  META_ADS_STATUS_OPTIONS,
  MONTHLY_AD_BUDGET_OPTIONS,
  RECOMMENDATION_STYLE_OPTIONS,
  SAFETY_PREFERENCE_OPTIONS,
  SALON_INDUSTRY_OPTIONS,
  SALON_MOST_VALUABLE_SERVICE_OPTIONS,
  SALON_SERVICE_OPTIONS,
  WATCH_SIGNAL_OPTIONS,
  labelForOption,
} from '@/lib/shared/onboarding/businessProfileOptions';
import styles from './OnboardingSteps.module.css';

type ReviewStartStepProps = {
  onComplete: () => void;
  onPrev: () => void;
  userData: UserData;
  loading?: boolean;
};

function labelsForValues(values: string[], options: { value: string; label: string }[]): string[] {
  return values
    .map((value) => labelForOption(value, options, ''))
    .filter(Boolean);
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryItem}>
      <Text size="xs" tt="uppercase" fw={800} c="dimmed">
        {label}
      </Text>
      <Text fw={800}>{value}</Text>
    </div>
  );
}

export default function ReviewStartStep({
  onComplete,
  onPrev,
  userData,
  loading = false,
}: ReviewStartStepProps) {
  const promotedServiceLabels = labelsForValues(userData.promotedServices, SALON_SERVICE_OPTIONS);
  const watchSignalLabels = labelsForValues(userData.watchSignals, WATCH_SIGNAL_OPTIONS);

  return (
    <Stack gap="lg" className={styles.stepRoot}>
      <div className={styles.stepIntro}>
        <Badge variant="light" color="green" radius="sm" mb="sm" className={styles.readyBadge}>
          Ready to start
        </Badge>
        <Title order={2} className={styles.stepTitle}>
          Confirm your decision profile.
        </Title>
        <Text className={styles.stepCopy}>
          These answers guide reports, campaign reviews, active findings, and future decision support.
        </Text>
      </div>

      <Card withBorder radius="sm" p="lg" className={`${styles.sectionCard} ${styles.summaryHero}`}>
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <div className={styles.summaryBusiness}>
              <Title order={3}>{userData.businessName || 'Your salon'}</Title>
              <Text c="dimmed">
                {labelForOption(userData.industry, SALON_INDUSTRY_OPTIONS)} in{' '}
                {userData.businessLocation || 'your market'}
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" radius="sm" size="lg" className={styles.summaryIcon}>
              <IconShieldCheck size={22} />
            </ThemeIcon>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <SummaryItem
              label="Business address"
              value={`${userData.businessLocation || 'Not set'}${
                userData.customerRadius
                  ? ` - ${labelForOption(userData.customerRadius, CUSTOMER_RADIUS_OPTIONS)}`
                  : ''
              }`}
            />
            <SummaryItem
              label="Monthly budget"
              value={labelForOption(userData.monthlyBudget, MONTHLY_AD_BUDGET_OPTIONS)}
            />
            <SummaryItem
              label="Most valuable service"
              value={labelForOption(userData.mostValuableService, [
                ...SALON_SERVICE_OPTIONS,
                ...SALON_MOST_VALUABLE_SERVICE_OPTIONS,
              ])}
            />
            <SummaryItem
              label="Meta ads status"
              value={labelForOption(userData.metaAdsStatus, META_ADS_STATUS_OPTIONS)}
            />
            <SummaryItem
              label="Primary goal"
              value={labelForOption(userData.primaryGoal, INTELLIGENCE_GOAL_OPTIONS)}
            />
            <SummaryItem
              label="Lead type"
              value={labelForOption(userData.leadType, LEAD_TYPE_OPTIONS)}
            />
            <SummaryItem
              label="Lead quality signal"
              value={labelForOption(userData.leadQualitySignal, LEAD_QUALITY_SIGNAL_OPTIONS)}
            />
            <SummaryItem
              label="Contact method"
              value={labelForOption(userData.preferredContactMethod, CONTACT_METHOD_OPTIONS)}
            />
            <SummaryItem
              label="Customer value"
              value={labelForOption(userData.averageCustomerValue, AVERAGE_CUSTOMER_VALUE_OPTIONS, 'Not set yet')}
            />
            <SummaryItem
              label="Safety"
              value={labelForOption(userData.safetyPreference, SAFETY_PREFERENCE_OPTIONS)}
            />
          </SimpleGrid>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Card withBorder radius="sm" p="lg" className={styles.sectionCard}>
          <Title order={4} mb="sm">
            Services DeepVisor should understand
          </Title>
          <Group gap="xs" className={styles.tagGroup}>
            {(promotedServiceLabels.length > 0 ? promotedServiceLabels : ['No services selected']).map((service) => (
              <Badge key={service} variant="light" color="green">
                {service}
              </Badge>
            ))}
          </Group>
        </Card>

        <Card withBorder radius="sm" p="lg" className={styles.sectionCard}>
          <Title order={4} mb="sm">
            DeepVisor will watch for
          </Title>
          <List
            spacing="xs"
            className={styles.watchList}
            icon={
              <ThemeIcon color="green" size={20} radius="sm" variant="light" className={styles.watchIcon}>
                <IconCheck size={12} />
              </ThemeIcon>
            }
          >
            {(watchSignalLabels.length > 0 ? watchSignalLabels : ['Wasted spend', 'Cost spikes']).map((signal) => (
              <List.Item key={signal}>{signal}</List.Item>
            ))}
          </List>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="sm" p="lg" className={styles.controlPanel}>
        <Text fw={800}>You stay in control.</Text>
        <Text c="dimmed" mt={4}>
          DeepVisor can recommend actions and prepare drafts, but it will not publish, pause,
          extend, or change ads without approval.
        </Text>
        <Text size="sm" c="dimmed" mt="sm">
          Recommendation style: {labelForOption(userData.recommendationStyle, RECOMMENDATION_STYLE_OPTIONS)}
        </Text>
      </Card>

      <Group justify="space-between" className={styles.actionBar}>
        <Button
          variant="default"
          onClick={onPrev}
          type="button"
          leftSection={<IconChevronLeft size={16} />}
          className={styles.secondaryButton}
        >
          Back
        </Button>
        <Button
          size="md"
          rightSection={<IconArrowRight size={18} />}
          onClick={onComplete}
          loading={loading}
          className={styles.primaryButton}
        >
          Start DeepVisor
        </Button>
      </Group>
    </Stack>
  );
}
