'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button, SegmentedControl, Select, Switch, TextInput } from '@mantine/core';
import { ChevronDown, Mail } from 'lucide-react';
import type { NotificationPreference, ReportSubscriptionSetting } from '@/lib/server/intelligence/types';
import classes from '../SettingsSurface.module.css';

type Props = {
  initialNotificationPreference: NotificationPreference;
  initialReportSubscription: ReportSubscriptionSetting;
};

/**
 * Three plain switches first; severity, time zone and quiet hours wait under "More options".
 * One Save writes both preference records, exactly as before (email delivery stays off).
 */
export default function AlertSettings({ initialNotificationPreference, initialReportSubscription }: Props) {
  const t = useTranslations('settingsPage');
  const locale = useLocale();
  const [notify, setNotify] = useState({ ...initialNotificationPreference, emailEnabled: false });
  const [report, setReport] = useState(initialReportSubscription);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const hourLabel = (hour: number) => new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { hour: 'numeric' }).format(new Date(2000, 0, 1, hour));
  const hours = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: hourLabel(hour) }));
  const touch = () => setFeedback(null);

  async function save() {
    setSaving(true); setFeedback(null);
    try {
      const [notifyResponse, reportResponse] = await Promise.all([
        fetch('/api/notifications/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notify) }),
        fetch('/api/reports/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) }),
      ]);
      const notifyBody = await notifyResponse.json().catch(() => ({}));
      const reportBody = await reportResponse.json().catch(() => ({}));
      if (!notifyResponse.ok || !notifyBody?.success || !reportResponse.ok || !reportBody?.success) throw new Error('save failed');
      if (notifyBody.preference) setNotify({ ...notifyBody.preference, emailEnabled: false });
      if (reportBody.subscription) setReport(reportBody.subscription);
      setFeedback({ success: true, message: t('saved') });
    } catch (error) {
      console.error('Could not save alert settings', error);
      setFeedback({ success: false, message: t('alerts.error') });
    } finally { setSaving(false); }
  }

  return (
    <div className={classes.formStack}>
      <div className={classes.switches}>
        <Switch size="md" label={t('alerts.inApp')} description={t('alerts.inAppHint')} checked={notify.inAppEnabled}
          onChange={event => { const on = event.currentTarget.checked; setNotify(current => ({ ...current, inAppEnabled: on })); touch(); }} />
        <Switch size="md" label={t('alerts.reportReady')} checked={notify.reportReadyEnabled}
          onChange={event => { const on = event.currentTarget.checked; setNotify(current => ({ ...current, reportReadyEnabled: on })); touch(); }} />
        <Switch size="md" label={t('alerts.report')} description={t('alerts.reportHint')} checked={report.isEnabled}
          onChange={event => { const on = event.currentTarget.checked; setReport(current => ({ ...current, isEnabled: on })); touch(); }} />
      </div>

      {report.isEnabled && (
        <div className={classes.choice}>
          <span className={classes.choiceLabel} id="report-cadence">{t('alerts.cadence')}</span>
          <SegmentedControl aria-labelledby="report-cadence" fullWidth value={report.cadence}
            data={(['daily', 'weekly', 'monthly'] as const).map(value => ({ value, label: t(`alerts.${value}`) }))}
            onChange={value => { setReport(current => ({ ...current, cadence: value as ReportSubscriptionSetting['cadence'] })); touch(); }} />
        </div>
      )}

      <details className={classes.more}>
        <summary>{t('alerts.more')}<ChevronDown size={18} aria-hidden="true" /></summary>
        <div className={classes.moreBody}>
          <div className={classes.choice}>
            <span className={classes.choiceLabel} id="alert-severity">{t('alerts.severity')}</span>
            <SegmentedControl aria-labelledby="alert-severity" fullWidth value={notify.minSeverity}
              data={[
                { value: 'info', label: t('alerts.severityAll') },
                { value: 'warning', label: t('alerts.severityImportant') },
                { value: 'critical', label: t('alerts.severityUrgent') },
              ]}
              onChange={value => { setNotify(current => ({ ...current, minSeverity: value as NotificationPreference['minSeverity'] })); touch(); }} />
          </div>
          <TextInput label={t('alerts.timeZone')} description={t('alerts.timeZoneHint')} inputWrapperOrder={['label', 'input', 'description', 'error']}
            placeholder="America/New_York" value={notify.timeZone ?? ''}
            onChange={event => { const zone = event.currentTarget.value || null; setNotify(current => ({ ...current, timeZone: zone })); setReport(current => ({ ...current, timeZone: zone })); touch(); }} />
          <div>
            <div className={classes.fieldGrid}>
              <Select label={t('alerts.quietStart')} placeholder={t('alerts.none')} clearable data={hours}
                value={notify.quietHoursStart == null ? null : String(notify.quietHoursStart)}
                onChange={value => { setNotify(current => ({ ...current, quietHoursStart: value == null ? null : Number(value) })); touch(); }} />
              <Select label={t('alerts.quietEnd')} placeholder={t('alerts.none')} clearable data={hours}
                value={notify.quietHoursEnd == null ? null : String(notify.quietHoursEnd)}
                onChange={value => { setNotify(current => ({ ...current, quietHoursEnd: value == null ? null : Number(value) })); touch(); }} />
            </div>
            <p className={classes.hint}>{t('alerts.quietHint')}</p>
          </div>
        </div>
      </details>

      {feedback && <Alert color={feedback.success ? 'green' : 'red'} variant="light" role="status">{feedback.message}</Alert>}
      <div className={classes.actions}>
        <Button onClick={() => void save()} loading={saving}>{t('save')}</Button>
      </div>
      <p className={classes.reassure}><Mail size={16} aria-hidden="true" />{t('alerts.email')}</p>
    </div>
  );
}
