'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import {
  IconArrowRight,
  IconBrandMeta,
  IconCheck,
  IconChevronLeft,
  IconLock,
} from '@tabler/icons-react';
import MetaIntegrationFlow from '@/components/integrations/MetaIntegrationFlow';
import type { UserData } from '../types';
import styles from './OnboardingSteps.module.css';

type ConnectAccountsStepProps = {
  onNext: () => void | Promise<void>;
  onPrev: () => void | Promise<void>;
  userData: UserData;
  updateUserData: (data: Partial<UserData>) => void;
};

export default function ConnectAccountsStep({
  onNext,
  onPrev,
  userData,
  updateUserData,
}: ConnectAccountsStepProps) {
  const [finishing, setFinishing] = useState(false);
  const connectedPlatforms = Array.isArray(userData.connectedPlatforms)
    ? userData.connectedPlatforms
    : [];
  const metaConnected = connectedPlatforms.includes('meta');

  const finishSetup = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await onNext();
    } finally {
      setFinishing(false);
    }
  };

  return (
    <MetaIntegrationFlow
      returnTo="/onboarding"
      refreshAfterSuccess={false}
      onConnected={() => {
        if (!metaConnected) {
          updateUserData({ connectedPlatforms: [...connectedPlatforms, 'meta'] });
        }
      }}
    >
      {({ connectMeta, connecting }) => (
        <Stack gap="lg" className={styles.stepRoot}>
          <div className={styles.stepIntro}>
            <span className={styles.stepKicker}>02 / Live data</span>
            <Title order={2} className={styles.stepTitle}>
              Connect Meta, or start without it.
            </Title>
            <Text className={styles.stepCopy}>
              Meta powers live performance signals. Skipping does not block your dashboard.
            </Text>
          </div>

          <section className={styles.metaSection} aria-labelledby="meta-connection-heading">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <span className={styles.metaIcon}><IconBrandMeta size={24} /></span>
                <div>
                  <Title id="meta-connection-heading" order={3} className={styles.metaTitle}>
                    Meta Business
                  </Title>
                  <Text size="sm" c="dimmed">Facebook and Instagram ads</Text>
                </div>
              </Group>
              <Badge
                variant="light"
                color={metaConnected ? 'green' : 'gray'}
                leftSection={metaConnected ? <IconCheck size={12} /> : undefined}
                className={styles.connectionBadge}
              >
                {metaConnected ? 'Connected' : 'Optional'}
              </Badge>
            </Group>

            <div className={styles.metaBenefits}>
              <span><IconCheck size={15} />Live spend, leads, and campaign history</span>
              <span><IconCheck size={15} />Secure account selection through Meta</span>
              <span><IconLock size={15} />No changes are published without approval</span>
            </div>
          </section>

          <Group justify="space-between" className={styles.actionBar} wrap="nowrap">
            <ActionIcon
              variant="default"
              size={44}
              onClick={() => void onPrev()}
              disabled={connecting || finishing}
              className={styles.backAction}
              aria-label="Back to business essentials"
              title="Back to business essentials"
            >
              <IconChevronLeft size={18} />
            </ActionIcon>

            <div className={styles.connectActionGroup}>
              {!metaConnected ? (
                <Button
                  variant="subtle"
                  onClick={() => void finishSetup()}
                  disabled={connecting}
                  loading={finishing}
                  className={styles.skipButton}
                >
                  Skip for now
                </Button>
              ) : null}
              <Button
                onClick={metaConnected ? () => void finishSetup() : connectMeta}
                loading={metaConnected ? finishing : connecting}
                disabled={finishing}
                leftSection={metaConnected ? <IconCheck size={16} /> : <IconBrandMeta size={17} />}
                rightSection={metaConnected ? <IconArrowRight size={16} /> : undefined}
                className={styles.primaryButton}
              >
                {metaConnected ? 'Finish setup' : 'Connect Meta'}
              </Button>
            </div>
          </Group>
        </Stack>
      )}
    </MetaIntegrationFlow>
  );
}
