'use client';

import { Box, Group, Text } from '@mantine/core';

interface StatusBadgeProps {
  status?: string | null;
}

function normalizeStatus(status?: string | null): string {
  return (status ?? '').trim().toLowerCase();
}

function getStatusTone(status?: string | null): string {
  const normalized = normalizeStatus(status);

  if (normalized === 'active') {
    return 'green';
  }

  if (
    ['completed', 'complete', 'ended', 'finished', 'archived'].includes(normalized)
  ) {
    return 'blue';
  }

  if (
    ['paused', 'disabled', 'inactive', 'deleted', 'disapproved', 'rejected', 'failed', 'error'].includes(
      normalized
    )
  ) {
    return 'red';
  }

  if (['pending', 'pending_review', 'in_review', 'learning', 'limited'].includes(normalized)) {
    return 'yellow';
  }

  return 'gray';
}

function formatStatusLabel(status?: string | null): string {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return '—';
  }

  return normalized.replace(/[_-]+/g, ' ').toUpperCase();
}

function getToneStyles(tone: string): { dot: string; text: string } {
  switch (tone) {
    case 'green':
      return {
        dot: 'var(--mantine-color-green-6)',
        text: 'var(--mantine-color-green-8)',
      };
    case 'blue':
      return {
        dot: 'var(--mantine-color-blue-6)',
        text: 'var(--mantine-color-blue-8)',
      };
    case 'red':
      return {
        dot: 'var(--mantine-color-red-6)',
        text: 'var(--mantine-color-red-8)',
      };
    case 'yellow':
      return {
        dot: 'var(--mantine-color-yellow-6)',
        text: 'var(--mantine-color-yellow-8)',
      };
    default:
      return {
        dot: 'var(--mantine-color-gray-5)',
        text: 'var(--mantine-color-gray-7)',
      };
  }
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const tone = getStatusTone(status);
  const styles = getToneStyles(tone);

  return (
    <Group gap={8} wrap="nowrap">
      <Box
        style={{
          width: 10,
          height: 10,
          minWidth: 10,
          borderRadius: '50%',
          background: styles.dot,
          boxShadow: `0 0 0 2px color-mix(in srgb, ${styles.dot} 16%, white)`,
        }}
      />
      <Text
        size="xs"
        fw={700}
        style={{
          color: styles.text,
          letterSpacing: '0.04em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {formatStatusLabel(status)}
      </Text>
    </Group>
  );
}
