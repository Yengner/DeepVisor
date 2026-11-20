'use client';

import { useTranslations } from 'next-intl';
import { SegmentedControl, useMantineColorScheme } from '@mantine/core';
import { useColorScheme } from '@/components/design/DesignSurface';

/** Light or dark, using the same Mantine scheme the rest of the app reads. */
export default function AppearanceChoice() {
  const t = useTranslations('settingsPage.look');
  const theme = useColorScheme();
  const { setColorScheme } = useMantineColorScheme();
  return (
    <SegmentedControl
      aria-label={t('label')}
      value={theme}
      size="md"
      fullWidth
      data={[{ value: 'light', label: t('light') }, { value: 'dark', label: t('dark') }]}
      onChange={value => setColorScheme(value === 'dark' ? 'dark' : 'light')}
    />
  );
}
