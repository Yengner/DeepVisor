'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Progress,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBolt,
  IconChartBar,
  IconClockHour4,
  IconSparkles,
  IconTargetArrow,
  IconTrendingUp,
} from '@tabler/icons-react';
import type {
  InitialMetaHistoryAnalysis,
  InitialMetaHistoryAnalysisState,
  InitialMetaHistoryAnalysisTrackingConfidence,
  InitialMetaHistoryAnalysisWindowSnapshot,
} from '@/lib/shared/types/integrations';
import classes from './InitialHistoryAnalysisOverlay.module.css';

type InitialHistoryAnalysisOverlayProps = {
  opened: boolean;
  analysis: InitialMetaHistoryAnalysis | null;
  onContinue: () => void;
};

const ANALYSIS_PHASES = [
  {
    label: 'Reading history',
    description: 'Scanning delivery and conversion windows across the account timeline.',
  },
  {
    label: 'Ranking campaigns',
    description: 'Pulling out the campaigns creating the strongest signal first.',
  },
  {
    label: 'Comparing periods',
    description: 'Testing which time window carried the healthiest momentum.',
  },
  {
    label: 'Writing guidance',
    description: 'Composing the first operational read for the workspace.',
  },
] as const;

function formatCompactNumber(value: number): string {
  if (value >= 1000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateRange(firstDay: string | null, lastDay: string | null): string {
  const first = formatDate(firstDay);
  const last = formatDate(lastDay);

  if (first && last) {
    return `${first} to ${last}`;
  }

  return first ?? last ?? 'History window ready';
}

function formatStateLabel(value: InitialMetaHistoryAnalysisState): string {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getConfidenceTone(value: InitialMetaHistoryAnalysisTrackingConfidence): {
  label: string;
  color: string;
} {
  switch (value) {
    case 'high':
      return { label: 'High tracking confidence', color: 'teal' };
    case 'medium':
      return { label: 'Medium tracking confidence', color: 'blue' };
    default:
      return { label: 'Low tracking confidence', color: 'orange' };
  }
}

function pickRotatingItem(items: string[], index: number, fallback: string): string {
  if (items.length === 0) {
    return fallback;
  }

  return items[index % items.length] ?? fallback;
}

function shortWindowLabel(window: InitialMetaHistoryAnalysisWindowSnapshot): string {
  switch (window.key) {
    case 'last7d':
      return '7D';
    case 'last30d':
      return '30D';
    case 'last90d':
      return '90D';
    default:
      return 'Life';
  }
}

export default function InitialHistoryAnalysisOverlay({
  opened,
  analysis,
  onContinue,
}: InitialHistoryAnalysisOverlayProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [windowFocusIndex, setWindowFocusIndex] = useState(0);
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    if (!opened || !analysis) {
      setPhaseIndex(0);
      setWindowFocusIndex(0);
      setInsightIndex(0);
      return;
    }

    setPhaseIndex(0);
    setWindowFocusIndex(0);
    setInsightIndex(0);

    const phaseTimeouts = ANALYSIS_PHASES.map((_, index) =>
      window.setTimeout(() => {
        setPhaseIndex(index);
      }, index * 850)
    );

    const windowInterval = window.setInterval(() => {
      setWindowFocusIndex((current) => current + 1);
    }, 1400);

    const insightInterval = window.setInterval(() => {
      setInsightIndex((current) => current + 1);
    }, 2200);

    return () => {
      for (const timeout of phaseTimeouts) {
        window.clearTimeout(timeout);
      }
      window.clearInterval(windowInterval);
      window.clearInterval(insightInterval);
    };
  }, [opened, analysis?.generatedAt]);

  const windows = useMemo(() => {
    if (!analysis || analysis.windowSnapshots.length === 0) {
      return [];
    }

    return analysis.windowSnapshots;
  }, [analysis]);

  if (!analysis || windows.length === 0) {
    return null;
  }

  const progressValue = ((phaseIndex + 1) / ANALYSIS_PHASES.length) * 100;
  const currentPhase = ANALYSIS_PHASES[phaseIndex] ?? ANALYSIS_PHASES[0];
  const confidence = getConfidenceTone(analysis.trackingConfidence);
  const canContinue = phaseIndex >= ANALYSIS_PHASES.length - 1;
  const activeWindow = windows[windowFocusIndex % windows.length] ?? analysis.bestWindow;
  const maxWindowConversion = Math.max(...windows.map((item) => item.conversion), 1);
  const maxObjectiveShare = Math.max(...analysis.objectiveMix.map((item) => item.shareOfSpend), 1);
  const maxCampaignConversion = Math.max(...analysis.topCampaigns.map((item) => item.conversion), 1);

  const liveStrength = pickRotatingItem(
    analysis.strengths,
    insightIndex,
    'Historical delivery signal is available and ready for analysis.'
  );
  const liveRisk = pickRotatingItem(
    analysis.risks,
    insightIndex + 1,
    'There are still areas to tighten as more operating data arrives.'
  );
  const liveNextStep = pickRotatingItem(
    analysis.nextSteps,
    insightIndex + 2,
    'Use this first read as the baseline for the next round of optimization.'
  );

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
      size="78rem"
      overlayProps={{ backgroundOpacity: 0.1, blur: 18 }}
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
      <div className={classes.frame}>
        <div className={classes.ambientGlow} aria-hidden="true" />
        <Paper radius={28} className={classes.panel}>
          <div className={classes.header}>
            <div className={classes.headerCopy}>
              <Group gap="xs" mb={10}>
                <Badge color="blue" variant="light" size="lg">
                  Initial History Read
                </Badge>
                <Badge color={confidence.color} variant="light" size="lg">
                  {confidence.label}
                </Badge>
                <Badge color="dark" variant="light" size="lg">
                  {formatStateLabel(analysis.accountState)}
                </Badge>
              </Group>

              <Title order={2} className={classes.title}>
                Meta history mapped for {analysis.adAccountName ?? 'your primary ad account'}
              </Title>

              <Text className={classes.summary}>
                {analysis.summary}
              </Text>
            </div>

            <div className={classes.headerActions}>
              <div className={classes.liveBadge}>
                <ThemeIcon size={32} radius="xl" variant="light" color="blue">
                  <IconSparkles size={16} />
                </ThemeIcon>
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    Live pass
                  </Text>
                  <Text fw={700}>{currentPhase.label}</Text>
                </div>
              </div>

              <Button
                size="md"
                radius="xl"
                onClick={onContinue}
                disabled={!canContinue}
              >
                {canContinue ? 'Open workspace' : `Analyzing ${Math.round(progressValue)}%`}
              </Button>
            </div>
          </div>

          <div className={classes.dashboard}>
            <Paper radius="xl" p="lg" className={classes.railCard}>
              <div className={classes.railTop}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  Scan progress
                </Text>
                <Progress value={progressValue} radius="xl" size="md" color="blue" />
              </div>

              <div className={classes.phaseList}>
                {ANALYSIS_PHASES.map((phase, index) => {
                  const isActive = phaseIndex === index;
                  const isDone = index < phaseIndex;

                  return (
                    <div
                      key={phase.label}
                      className={`${classes.phaseItem} ${isActive ? classes.phaseItemActive : ''}`}
                    >
                      <span
                        className={`${classes.phaseIndicator} ${
                          isDone
                            ? classes.phaseIndicatorDone
                            : isActive
                              ? classes.phaseIndicatorActive
                              : classes.phaseIndicatorIdle
                        }`}
                        aria-hidden="true"
                      />
                      <div>
                        <Text fw={700} size="sm">
                          {phase.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {phase.description}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={classes.historyBlock}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  History window
                </Text>
                <Text fw={700}>{formatDateRange(analysis.historyWindow.firstDay, analysis.historyWindow.lastDay)}</Text>
                <Text size="sm" c="dimmed">
                  {analysis.historyWindow.historyDays} active days analyzed
                </Text>
              </div>
            </Paper>

            <Paper radius="xl" p="lg" className={classes.heroCard}>
              <div className={classes.heroGrid}>
                <div className={classes.heroStats}>
                  <div className={classes.liveWindowCard}>
                    <div>
                      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                        Active window
                      </Text>
                      <Text fw={700}>{activeWindow.label}</Text>
                    </div>
                    <ThemeIcon size={38} radius="xl" variant="light" color="blue">
                      <IconTrendingUp size={20} />
                    </ThemeIcon>
                  </div>

                  <motion.div
                    key={activeWindow.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={classes.metricGrid}
                  >
                    <div className={classes.metricTile}>
                      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                        Results
                      </Text>
                      <Text className={classes.metricValue}>
                        {formatCompactNumber(activeWindow.conversion)}
                      </Text>
                    </div>
                    <div className={classes.metricTile}>
                      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                        CTR
                      </Text>
                      <Text className={classes.metricValue}>{formatPercent(activeWindow.ctr)}</Text>
                    </div>
                    <div className={classes.metricTile}>
                      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                        Cost / result
                      </Text>
                      <Text className={classes.metricValue}>
                        {formatCompactNumber(activeWindow.costPerResult)}
                      </Text>
                    </div>
                    <div className={classes.metricTile}>
                      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                        Active days
                      </Text>
                      <Text className={classes.metricValue}>{activeWindow.activeDays}</Text>
                    </div>
                  </motion.div>

                  <div className={classes.bestPeriodCard}>
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                          Best period found
                        </Text>
                        <Text fw={700}>{analysis.bestWindow.label}</Text>
                      </div>
                      <ThemeIcon size={34} radius="xl" variant="light" color="teal">
                        <IconClockHour4 size={18} />
                      </ThemeIcon>
                    </Group>
                    <Text size="sm" c="dimmed" mt={6}>
                      {analysis.bestWindow.reason}
                    </Text>
                  </div>
                </div>

                <div className={classes.signalBoard}>
                  <div className={classes.signalHeader}>
                    <div>
                      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                        Signal board
                      </Text>
                      <Text fw={700}>Window comparison</Text>
                    </div>
                    <ThemeIcon size={34} radius="xl" variant="light" color="dark">
                      <IconChartBar size={18} />
                    </ThemeIcon>
                  </div>

                  <div className={classes.signalChart}>
                    <div className={classes.chartGridLines} aria-hidden="true" />
                    <div className={classes.scanBeam} aria-hidden="true" />

                    {windows.map((window) => {
                      const barHeight = Math.max((window.conversion / maxWindowConversion) * 100, 18);
                      const isActive = window.key === activeWindow.key;
                      const isBest = window.key === analysis.bestWindow.key;

                      return (
                        <div key={window.key} className={classes.signalColumn}>
                          <div className={classes.signalTrack}>
                            <motion.div
                              className={`${classes.signalBar} ${
                                isActive ? classes.signalBarActive : ''
                              } ${isBest ? classes.signalBarBest : ''}`}
                              animate={{
                                height: `${barHeight}%`,
                                scale: isActive ? 1.06 : 0.96,
                                opacity: isActive ? 1 : 0.72,
                                y: isActive ? -4 : 0,
                              }}
                              transition={{ duration: 0.45, ease: 'easeOut' }}
                            />
                          </div>
                          <Text size="xs" fw={700} c={isActive ? 'blue.7' : 'dimmed'}>
                            {shortWindowLabel(window)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatCompactNumber(window.conversion)}
                          </Text>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Paper>

            <Paper radius="xl" p="lg" className={classes.compareCard}>
              <Group justify="space-between" align="center" mb="md">
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    Objectives
                  </Text>
                  <Text fw={700}>What the account has been chasing</Text>
                </div>
                <ThemeIcon size={34} radius="xl" variant="light" color="blue">
                  <IconTargetArrow size={18} />
                </ThemeIcon>
              </Group>

              <div className={classes.compareList}>
                {analysis.objectiveMix.slice(0, 3).map((item) => (
                  <div key={item.objective} className={classes.compareRow}>
                    <Group justify="space-between" mb={6}>
                      <Text size="sm" fw={700} lineClamp={1}>
                        {item.objective}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {item.shareOfSpend.toFixed(1)}%
                      </Text>
                    </Group>
                    <div className={classes.compareTrack}>
                      <motion.div
                        className={classes.compareFill}
                        animate={{
                          width: `${Math.max((item.shareOfSpend / maxObjectiveShare) * 100, 16)}%`,
                        }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Paper>

            <Paper radius="xl" p="lg" className={classes.campaignCard}>
              <Group justify="space-between" align="center" mb="md">
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    Top campaigns
                  </Text>
                  <Text fw={700}>What produced the strongest outcomes</Text>
                </div>
                <ThemeIcon size={34} radius="xl" variant="light" color="teal">
                  <IconBolt size={18} />
                </ThemeIcon>
              </Group>

              <div className={classes.campaignList}>
                {analysis.topCampaigns.slice(0, 3).map((campaign) => (
                  <div key={campaign.id} className={classes.campaignRow}>
                    <Group justify="space-between" mb={6}>
                      <Text size="sm" fw={700} lineClamp={1}>
                        {campaign.name}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {formatCompactNumber(campaign.conversion)}
                      </Text>
                    </Group>
                    <div className={classes.campaignTrack}>
                      <motion.div
                        className={classes.campaignFill}
                        animate={{
                          width: `${Math.max((campaign.conversion / maxCampaignConversion) * 100, 18)}%`,
                        }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                      />
                    </div>
                    <Group gap="md" mt={6}>
                      <Text size="xs" c="dimmed">
                        {formatPercent(campaign.ctr)} CTR
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatCompactNumber(campaign.costPerResult)} CPR
                      </Text>
                    </Group>
                  </div>
                ))}
              </div>
            </Paper>

            <Paper radius="xl" p="lg" className={classes.insightCard}>
              <div className={classes.insightHeader}>
                <div>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    Live read
                  </Text>
                  <Text fw={700}>Guidance rotating as the pass completes</Text>
                </div>
                <Text size="sm" c="dimmed">
                  {analysis.businessPriority ?? 'Focus signal ready'}
                </Text>
              </div>

              <div className={classes.insightGrid}>
                <motion.div
                  key={`strength-${insightIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`${classes.insightTile} ${classes.insightTilePositive}`}
                >
                  <Text size="xs" tt="uppercase" fw={700}>
                    Strength
                  </Text>
                  <Text size="sm">{liveStrength}</Text>
                </motion.div>

                <motion.div
                  key={`risk-${insightIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`${classes.insightTile} ${classes.insightTileWarning}`}
                >
                  <Text size="xs" tt="uppercase" fw={700}>
                    Risk
                  </Text>
                  <Text size="sm">{liveRisk}</Text>
                </motion.div>

                <motion.div
                  key={`next-${insightIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`${classes.insightTile} ${classes.insightTileNeutral}`}
                >
                  <Text size="xs" tt="uppercase" fw={700}>
                    Next step
                  </Text>
                  <Text size="sm">{liveNextStep}</Text>
                </motion.div>
              </div>
            </Paper>
          </div>
        </Paper>
      </div>
    </Modal>
  );
}
