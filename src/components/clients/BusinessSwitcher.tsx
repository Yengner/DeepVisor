'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Group, Loader, Menu, Text, UnstyledButton } from '@mantine/core';
import { IconBuildingStore, IconCheck, IconChevronDown, IconLayoutGrid, IconPlus } from '@tabler/icons-react';
import { useSwitchBusiness } from './useSwitchBusiness';

export type SwitcherBusiness = { id: string; name: string };
export type SwitcherProps = { businesses: SwitcherBusiness[]; activeId: string; isOperator: boolean };

/** Which business DeepVisor is showing. Shown to operators and to anyone with more than one. */
export default function BusinessSwitcher({ businesses, activeId, isOperator, variant = 'bar' }: SwitcherProps & { variant?: 'bar' | 'drawer' }) {
  const t = useTranslations('clients');
  const router = useRouter();
  const { switching, go } = useSwitchBusiness();
  const active = businesses.find((business) => business.id === activeId);
  const dark = variant === 'bar';

  return (
    <Menu shadow="md" width={280} position="bottom-start">
      <Menu.Target>
        <UnstyledButton
          aria-label={t('switcher.label', { name: active?.name ?? '' })}
          className={dark
            ? 'rounded-md border border-[#284665] bg-[#102f50] px-2.5 py-1.5 transition-colors hover:border-[#4279ad]'
            : 'w-full rounded-md border border-[var(--mantine-color-default-border)] px-3 py-2.5'}
        >
          <Group gap={8} wrap="nowrap">
            {switching ? <Loader size={16} /> : <IconBuildingStore size={17} color={dark ? '#d4d8dd' : undefined} />}
            <Text size="sm" fw={800} c={dark ? 'white' : undefined} lineClamp={1} maw={dark ? 190 : undefined} style={dark ? undefined : { flex: 1 }}>
              {active?.name ?? t('switcher.choose')}
            </Text>
            <IconChevronDown size={15} color={dark ? '#b0c4da' : undefined} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown style={{ maxHeight: 'min(70vh, 460px)', overflowY: 'auto' }}>
        {isOperator && (
          <>
            <Menu.Item leftSection={<IconLayoutGrid size={16} />} onClick={() => router.push('/clients')}>{t('title')}</Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.Label>{t('switcher.heading')}</Menu.Label>
        {businesses.map((business) => (
          <Menu.Item
            key={business.id}
            disabled={Boolean(switching)}
            aria-current={business.id === activeId ? 'true' : undefined}
            rightSection={business.id === activeId ? <IconCheck size={16} /> : null}
            onClick={() => { if (business.id !== activeId) void go(business.id); }}
          >
            {business.name}
          </Menu.Item>
        ))}
        {isOperator && (
          <>
            <Menu.Divider />
            <Menu.Item leftSection={<IconPlus size={16} />} onClick={() => router.push('/clients/new')}>{t('add')}</Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
