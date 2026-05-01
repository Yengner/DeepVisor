'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { IconCheck, IconSettings } from '@tabler/icons-react';
import type {
  NotificationPreference,
  ReportSubscriptionSetting,
} from '@/lib/server/intelligence/types';

type IntelligencePreferencesCardProps = {
  initialNotificationPreference: NotificationPreference;
  initialReportSubscription: ReportSubscriptionSetting;
};

const severityOptions = [
  { value: 'info', label: 'Info+' },
  { value: 'warning', label: 'Warning+' },
  { value: 'critical', label: 'Critical only' },
];

const cadenceOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const quietHourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${hour.toString().padStart(2, '0')}:00`,
}));

export default function IntelligencePreferencesCard({
  initialNotificationPreference,
  initialReportSubscription,
}: IntelligencePreferencesCardProps) {
  const [notificationPreference, setNotificationPreference] = useState(initialNotificationPreference);
  const [reportSubscription, setReportSubscription] = useState(initialReportSubscription);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    setFeedback(null);

    try {
      const [notificationResponse, reportResponse] = await Promise.all([
        fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationPreference),
        }),
        fetch('/api/reports/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportSubscription),
        }),
      ]);

      const notificationBody = await notificationResponse.json().catch(() => ({}));
      const reportBody = await reportResponse.json().catch(() => ({}));

      if (!notificationResponse.ok || !notificationBody?.success) {
        throw new Error(notificationBody?.error || 'Failed to save notification preferences.');
      }

      if (!reportResponse.ok || !reportBody?.success) {
        throw new Error(reportBody?.error || 'Failed to save report subscription settings.');
      }

      setNotificationPreference(notificationBody.preference ?? notificationPreference);
      setReportSubscription(reportBody.subscription ?? reportSubscription);
      setFeedback({
        type: 'success',
        message: 'Intelligence preferences updated.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save these intelligence settings right now.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="sm" mb="md">
        <IconSettings size={18} />
        <div>
          <Text fw={700}>Intelligence delivery</Text>
          <Text size="sm" c="dimmed">
            Control how DeepVisor sends trend alerts and report-ready notices.
          </Text>
        </div>
      </Group>

      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Switch
            label="In-app notifications"
            checked={notificationPreference.inAppEnabled}
            onChange={(event) =>
              setNotificationPreference((current) => ({
                ...current,
                inAppEnabled: event.currentTarget.checked,
              }))
            }
          />
          <Switch
            label="Email notifications"
            checked={notificationPreference.emailEnabled}
            onChange={(event) =>
              setNotificationPreference((current) => ({
                ...current,
                emailEnabled: event.currentTarget.checked,
              }))
            }
          />
          <Switch
            label="Report-ready notices"
            checked={notificationPreference.reportReadyEnabled}
            onChange={(event) =>
              setNotificationPreference((current) => ({
                ...current,
                reportReadyEnabled: event.currentTarget.checked,
              }))
            }
          />
          <Switch
            label="Report subscription enabled"
            checked={reportSubscription.isEnabled}
            onChange={(event) =>
              setReportSubscription((current) => ({
                ...current,
                isEnabled: event.currentTarget.checked,
              }))
            }
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Select
            label="Minimum alert severity"
            data={severityOptions}
            value={notificationPreference.minSeverity}
            onChange={(value) =>
              setNotificationPreference((current) => ({
                ...current,
                minSeverity: (value as NotificationPreference['minSeverity']) ?? 'warning',
              }))
            }
          />
          <Select
            label="Report cadence"
            data={cadenceOptions}
            value={reportSubscription.cadence}
            onChange={(value) =>
              setReportSubscription((current) => ({
                ...current,
                cadence: (value as ReportSubscriptionSetting['cadence']) ?? 'weekly',
              }))
            }
          />
          <TextInput
            label="Time zone"
            placeholder="America/New_York"
            value={notificationPreference.timeZone ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value || null;
              setNotificationPreference((current) => ({
                ...current,
                timeZone: value,
              }));
              setReportSubscription((current) => ({
                ...current,
                timeZone: value,
              }));
            }}
          />
          <Group grow align="end">
            <Select
              label="Quiet hours start"
              clearable
              data={quietHourOptions}
              value={
                notificationPreference.quietHoursStart == null
                  ? null
                  : String(notificationPreference.quietHoursStart)
              }
              onChange={(value) =>
                setNotificationPreference((current) => ({
                  ...current,
                  quietHoursStart: value == null ? null : Number(value),
                }))
              }
            />
            <Select
              label="Quiet hours end"
              clearable
              data={quietHourOptions}
              value={
                notificationPreference.quietHoursEnd == null
                  ? null
                  : String(notificationPreference.quietHoursEnd)
              }
              onChange={(value) =>
                setNotificationPreference((current) => ({
                  ...current,
                  quietHoursEnd: value == null ? null : Number(value),
                }))
              }
            />
          </Group>
        </SimpleGrid>

        {feedback ? (
          <Alert
            color={feedback.type === 'success' ? 'green' : 'red'}
            icon={<IconCheck size={16} />}
            radius="md"
          >
            {feedback.message}
          </Alert>
        ) : null}

        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" c="dimmed">
            Native iPhone push can be layered on later without changing these business rules.
          </Text>
          <Button onClick={() => void handleSave()} loading={saving} radius="xl">
            Save intelligence settings
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
