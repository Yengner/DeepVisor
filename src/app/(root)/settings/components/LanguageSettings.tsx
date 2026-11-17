'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, SegmentedControl, Stack, Text } from '@mantine/core';
import { LOCALE_NAMES, LOCALES, type Locale } from '@/i18n/locales';
import { setPreferredLocaleAction } from '@/lib/server/actions/user/locale';

const AUTO = 'auto';

/** Per-person interface language: English, Spanish, or follow the browser. */
export default function LanguageSettings({ saved }: { saved: Locale | null }) {
  const t = useTranslations('language');
  const router = useRouter();
  const [value, setValue] = useState<string>(saved ?? AUTO);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const change = (next: string) => {
    const previous = value;
    setValue(next);
    setError(null);
    start(async () => {
      const result = await setPreferredLocaleAction(next === AUTO ? null : next);
      if (!result.success) { setValue(previous); setError(t('error')); return; }
      router.refresh();
    });
  };

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">{t('description')}</Text>
      <SegmentedControl
        aria-label={t('label')}
        value={value}
        onChange={change}
        disabled={pending}
        data={[{ value: AUTO, label: t('auto') }, ...LOCALES.map(l => ({ value: l, label: LOCALE_NAMES[l] }))]}
        fullWidth
      />
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
    </Stack>
  );
}
