'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBolt,
  IconClockHour4,
  IconPlayerPlay,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import type {
  ReviveCampaignOpportunity,
  ReviveDraftSource,
} from '@/lib/shared/types/campaignDrafts';

type ReviveCampaignPromptProps = {
  opportunity: ReviveCampaignOpportunity;
  variant: 'modal' | 'card';
  opened?: boolean;
  onDismiss?: () => void;
};

function severityColor(value: ReviveCampaignOpportunity['staleSeverity']): string {
  switch (value) {
    case 'critical':
      return 'red';
    case 'stale':
      return 'orange';
    default:
      return 'yellow';
  }
}

export default function ReviveCampaignPrompt({
  opportunity,
  variant,
  opened = false,
  onDismiss,
}: ReviveCampaignPromptProps) {
  const router = useRouter();
  const [submittingSource, setSubmittingSource] = useState<ReviveDraftSource | null>(null);
  const dormantLabel =
    opportunity.daysSinceLastActivity != null
      ? `${opportunity.daysSinceLastActivity} days since the last active delivery`
      : 'Recent delivery has faded enough to justify a relaunch decision';
  const severity = severityColor(opportunity.staleSeverity);
  const animatedBars = useMemo(
    () =>
      opportunity.recommendations.map((recommendation, index) => ({
        key: recommendation.source,
        width: 58 + index * 14,
      })),
    [opportunity.recommendations]
  );

  async function handleRecommendation(source: ReviveDraftSource) {
    setSubmittingSource(source);
    try {
      const response = await fetch('/api/campaigns/revive-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adAccountId: opportunity.adAccountId,
          platformIntegrationId: opportunity.platformIntegrationId,
          source,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body?.success || !body?.data?.href) {
        throw new Error(body?.error || 'Failed to create revive draft');
      }

      toast.success('Draft created. Opening the editor.');
      onDismiss?.();
      router.push(body.data.href);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create revive draft');
    } finally {
      setSubmittingSource(null);
    }
  }

  const content = (
    <Paper
      radius="xl"
      p={variant === 'modal' ? 'xl' : 'lg'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(160deg, rgba(15,23,42,0.86), rgba(30,41,59,0.74) 52%, rgba(15,118,110,0.24))',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 24px 80px rgba(2, 6, 23, 0.35)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top right, rgba(56,189,248,0.18), transparent 42%), radial-gradient(circle at bottom left, rgba(45,212,191,0.12), transparent 36%)',
          pointerEvents: 'none',
        }}
      />

      <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={8}>
            <Group gap="xs">
              <Badge color={severity} variant="light" size="lg">
                {opportunity.staleSeverity === 'critical' ? 'Deep stale' : 'Needs revival'}
              </Badge>
              <Badge color="blue" variant="light" size="lg">
                Backfill complete
              </Badge>
            </Group>
            <Title order={variant === 'modal' ? 2 : 3} c="white">
              {opportunity.adAccountName ?? 'Selected ad account'} is ready for a relaunch decision
            </Title>
            <Text c="gray.3" maw={variant === 'modal' ? 680 : 520}>
              {opportunity.summary}
            </Text>
          </Stack>

          <ThemeIcon size={44} radius="xl" color="yellow" variant="light">
            <IconSparkles size={22} />
          </ThemeIcon>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card radius="xl" p="md" bg="rgba(15,23,42,0.36)" c="white">
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" tt="uppercase" fw={700} c="gray.4">
                  Dormancy
                </Text>
                <Text fw={700}>{dormantLabel}</Text>
              </div>
              <ThemeIcon radius="xl" color={severity} variant="light">
                <IconClockHour4 size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card radius="xl" p="md" bg="rgba(15,23,42,0.36)" c="white">
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" tt="uppercase" fw={700} c="gray.4">
                  Recommended flow
                </Text>
                <Text fw={700}>Revive and review before launch</Text>
              </div>
              <ThemeIcon radius="xl" color="teal" variant="light">
                <IconTargetArrow size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card radius="xl" p="md" bg="rgba(15,23,42,0.36)" c="white">
            <Text size="xs" tt="uppercase" fw={700} c="gray.4" mb={8}>
              Opportunity pulse
            </Text>
            <Group gap={6} align="flex-end" wrap="nowrap" style={{ height: 52 }}>
              {animatedBars.map((bar, index) => (
                <motion.div
                  key={bar.key}
                  initial={{ height: 12, opacity: 0.5 }}
                  animate={{
                    height: [16 + index * 4, bar.width, 20 + index * 6],
                    opacity: [0.55, 0.95, 0.7],
                  }}
                  transition={{
                    duration: 2.4 + index * 0.2,
                    repeat: Infinity,
                    repeatType: 'mirror',
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 999,
                    background:
                      index === 0
                        ? 'linear-gradient(180deg, rgba(56,189,248,0.95), rgba(59,130,246,0.35))'
                        : index === 1
                          ? 'linear-gradient(180deg, rgba(45,212,191,0.95), rgba(13,148,136,0.3))'
                          : 'linear-gradient(180deg, rgba(250,204,21,0.95), rgba(202,138,4,0.25))',
                  }}
                />
              ))}
            </Group>
          </Card>
        </SimpleGrid>

        <Stack gap="sm">
          {opportunity.recommendations.map((recommendation) => (
            <Paper
              key={recommendation.source}
              radius="xl"
              p="md"
              bg="rgba(15,23,42,0.34)"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Group justify="space-between" align="center" gap="md">
                <div style={{ flex: 1 }}>
                  <Group gap="xs" mb={6}>
                    <ThemeIcon radius="xl" size={30} color="blue" variant="light">
                      {recommendation.destination === 'smart' ? (
                        <IconBolt size={16} />
                      ) : (
                        <IconPlayerPlay size={16} />
                      )}
                    </ThemeIcon>
                    <Text fw={800} c="white">
                      {recommendation.title}
                    </Text>
                  </Group>
                  <Text size="sm" c="gray.3">
                    {recommendation.reason}
                  </Text>
                </div>

                <Button
                  radius="xl"
                  variant={recommendation.source === 'historic_clone' ? 'filled' : 'light'}
                  color={recommendation.source === 'historic_clone' ? 'blue' : 'gray'}
                  rightSection={<IconArrowRight size={16} />}
                  loading={submittingSource === recommendation.source}
                  onClick={() => {
                    void handleRecommendation(recommendation.source);
                  }}
                >
                  Open draft
                </Button>
              </Group>
            </Paper>
          ))}
        </Stack>

        {variant === 'modal' ? (
          <Group justify="space-between" align="center">
            <Text size="sm" c="gray.4">
              You can dismiss this for now. The revive card will stay on Dashboard and Reports.
            </Text>
            <Button variant="subtle" color="gray" radius="xl" onClick={onDismiss}>
              Not now
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );

  if (variant === 'modal') {
    return (
      <Modal
        opened={opened}
        onClose={() => {}}
        centered
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        padding={0}
        radius="xl"
        size="64rem"
        overlayProps={{ backgroundOpacity: 0.08, blur: 16 }}
        styles={{
          content: {
            background: 'transparent',
            boxShadow: 'none',
          },
          body: {
            padding: 0,
          },
        }}
      >
        {content}
      </Modal>
    );
  }

  return content;
}
