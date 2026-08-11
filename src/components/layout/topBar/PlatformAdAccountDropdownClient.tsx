'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Badge, Group, Menu, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { getPlatformIcon } from '@/components/utils/utils';
import { setSelection } from './setSelection';

interface PlatformAdAccountDropdownClientProps {
  platforms: Array<{ id: string; platform_name: string }>;
  adAccounts: Array<{
    id: string;
    name: string | null;
    platform_integration_id: string;
    external_account_id: string | null;
  }>;
  initialPlatformId?: string | null;
  initialAccountId?: string | null;
  variant?: 'desktop' | 'compact' | 'drawer';
}

type WorkspaceOption = {
  value: string;
  platformId: string | null;
  accountId: string | null;
  platformKey: string;
  platformLabel: string;
  accountLabel: string;
  accountIdentifier: string | null;
  preview: boolean;
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
};

const PLATFORM_DISPLAY_ORDER = ['meta', 'google', 'tiktok'];

function formatPlatformLabel(platformKey: string): string {
  return PLATFORM_LABELS[platformKey] ?? platformKey.charAt(0).toUpperCase() + platformKey.slice(1);
}

function formatAccountIdentifier(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const compactValue = value.replace(/\s+/g, '');
  if (compactValue.length <= 6) {
    return value;
  }

  return `•••${compactValue.slice(-4)}`;
}

function sortByPlatformOrder(options: WorkspaceOption[]): WorkspaceOption[] {
  return [...options].sort((left, right) => {
    const leftIndex = PLATFORM_DISPLAY_ORDER.indexOf(left.platformKey);
    const rightIndex = PLATFORM_DISPLAY_ORDER.indexOf(right.platformKey);
    const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }

    return left.platformLabel.localeCompare(right.platformLabel);
  });
}

function resolvePlatformTheme(platformKey: string): 'default' | 'meta' | 'google' | 'tiktok' {
  switch (platformKey) {
    case 'meta':
    case 'facebook':
      return 'meta';
    case 'google':
      return 'google';
    case 'tiktok':
      return 'tiktok';
    default:
      return 'default';
  }
}

export default function PlatformAdAccountDropdownClient({
  platforms,
  adAccounts,
  initialPlatformId,
  initialAccountId,
  variant = 'desktop',
}: PlatformAdAccountDropdownClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const liveOptions = useMemo(() => {
    return sortByPlatformOrder(
      platforms.flatMap<WorkspaceOption>((platform): WorkspaceOption[] => {
        const platformAccounts = adAccounts.filter(
          (account) => account.platform_integration_id === platform.id
        );
        const platformKey = platform.platform_name.toLowerCase();
        const platformLabel = formatPlatformLabel(platformKey);

        if (platformAccounts.length === 0) {
          return [
            {
              value: `live:${platform.id}:none`,
              platformId: platform.id,
              accountId: null,
              platformKey,
              platformLabel,
              accountLabel: 'No ad account connected',
              accountIdentifier: null,
              preview: false,
            } satisfies WorkspaceOption,
          ];
        }

        return platformAccounts.map(
          (account) =>
            ({
              value: `live:${platform.id}:${account.id}`,
              platformId: platform.id,
              accountId: account.id,
              platformKey,
              platformLabel,
              accountLabel: account.name ?? 'Unnamed ad account',
              accountIdentifier: account.external_account_id,
              preview: false,
            }) satisfies WorkspaceOption
        );
      })
    );
  }, [adAccounts, platforms]);

  const workspaceOptions = liveOptions;

  const resolvedInitialValue = useMemo(() => {
    const exactMatch = liveOptions.find(
      (option) => option.platformId === initialPlatformId && option.accountId === initialAccountId
    );

    if (exactMatch) {
      return exactMatch.value;
    }

    const platformMatch = liveOptions.find((option) => option.platformId === initialPlatformId);
    if (platformMatch) {
      return platformMatch.value;
    }

    return workspaceOptions[0]?.value ?? null;
  }, [initialAccountId, initialPlatformId, liveOptions, workspaceOptions]);

  const [selectedValue, setSelectedValue] = useState<string | null>(resolvedInitialValue);

  useEffect(() => {
    if (resolvedInitialValue && !workspaceOptions.some((option) => option.value === selectedValue)) {
      setSelectedValue(resolvedInitialValue);
    }

    if (!selectedValue && resolvedInitialValue) {
      setSelectedValue(resolvedInitialValue);
    }
  }, [resolvedInitialValue, selectedValue, workspaceOptions]);

  const selectedOption =
    workspaceOptions.find((option) => option.value === selectedValue) ??
    workspaceOptions[0] ??
    null;

  useEffect(() => {
    if (!selectedOption) {
      return;
    }

    const shell = document.querySelector<HTMLElement>('.app-platform-shell');
    if (!shell) {
      return;
    }

    shell.setAttribute('data-platform-theme', resolvePlatformTheme(selectedOption.platformKey));
  }, [selectedOption]);

  const handleWorkspaceSelect = (option: WorkspaceOption) => {
    if (option.value === selectedValue) {
      return;
    }

    setSelectedValue(option.value);

    if (option.preview || !option.platformId) {
      return;
    }

    startTransition(async () => {
      await setSelection({
        platformId: option.platformId,
        accountRowId: option.accountId,
      });
      router.refresh();
    });
  };

  if (!selectedOption) {
    return null;
  }

  const selectedIcon = getPlatformIcon(selectedOption.platformKey, 18);
  const accentColor = 'var(--platform-accent)';
  const accentStrong = 'var(--platform-accent-strong)';
  const accentSoft = 'var(--platform-accent-soft)';
  const accentSoftStrong = 'var(--platform-accent-soft-strong)';
  const borderColor = 'var(--platform-border)';
  const compact = variant === 'compact';
  const drawer = variant === 'drawer';
  const inChrome = !drawer;
  const menuWidth = compact || drawer ? 'min(calc(100vw - 24px), 360px)' : 360;

  return (
    <Menu shadow="md" width={menuWidth} position={compact ? 'bottom' : 'bottom-start'}>
      <Menu.Target>
        <UnstyledButton
          disabled={isPending}
          style={{
            width: compact || drawer ? '100%' : undefined,
            minWidth: compact ? 0 : drawer ? '100%' : 270,
            padding: compact ? '6px 8px' : '6px 10px',
            borderRadius: 6,
            border: inChrome ? '1px solid #343a33' : `1px solid ${borderColor}`,
            background: inChrome ? '#20241f' : '#ffffff',
            boxShadow: 'none',
          }}
        >
          <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
            <Group align="center" wrap="nowrap" gap="sm">
              <ThemeIcon
                size={compact ? 'md' : 'lg'}
                radius="sm"
                variant="filled"
                style={{
                  backgroundColor: selectedOption.preview
                    ? inChrome ? '#2a2f29' : 'rgba(148, 163, 184, 0.14)'
                    : inChrome ? 'var(--platform-source-soft)' : accentSoftStrong,
                  color: selectedOption.preview ? (inChrome ? '#a6ada3' : '#64748b') : (inChrome ? '#f7f8f3' : accentStrong),
                  border: inChrome ? '1px solid #3b4139' : selectedOption.preview ? '1px solid rgba(148, 163, 184, 0.24)' : `1px solid ${borderColor}`,
                }}
              >
                {selectedIcon}
              </ThemeIcon>

              <div style={{ minWidth: 0, flex: 1 }}>
                <Group gap={6} wrap={compact ? 'nowrap' : 'wrap'}>
                  <Text size={compact ? 'xs' : 'sm'} fw={750} lineClamp={1} c={inChrome ? 'white' : undefined}>
                      {selectedOption.platformLabel}
                    </Text>
                  {selectedOption.preview && !compact ? (
                    <Badge size="xs" color="gray" variant="light">
                      Preview
                    </Badge>
                  ) : null}
                </Group>
                <Text size="xs" c={inChrome ? '#a6ada3' : 'dimmed'} lineClamp={1}>
                  {selectedOption.accountLabel}
                  {formatAccountIdentifier(selectedOption.accountIdentifier)
                    ? ` · ${formatAccountIdentifier(selectedOption.accountIdentifier)}`
                    : ''}
                </Text>
              </div>
            </Group>

            <IconChevronDown size={16} color={inChrome ? '#a6ada3' : '#6b7280'} />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Platforms & ad accounts</Menu.Label>

        {workspaceOptions.map((option) => {
          const isActive = option.value === selectedOption.value;
          const optionIcon = getPlatformIcon(option.platformKey, 18);

          return (
            <Menu.Item key={option.value} onClick={() => handleWorkspaceSelect(option)}>
              <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                <Group align="center" wrap="nowrap" gap="sm">
                  <ThemeIcon
                    size="lg"
                    radius="sm"
                    variant="filled"
                    style={{
                      backgroundColor: option.preview ? 'rgba(148, 163, 184, 0.14)' : accentSoft,
                      color: option.preview ? '#64748b' : accentColor,
                      border: option.preview ? '1px solid rgba(148, 163, 184, 0.24)' : `1px solid ${borderColor}`,
                    }}
                  >
                    {optionIcon}
                  </ThemeIcon>

                  <div style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="wrap">
                      <Text size="sm" fw={700} lineClamp={1}>
                        {option.platformLabel}
                      </Text>
                      {option.preview ? (
                        <Badge size="xs" color="gray" variant="light">
                          Preview
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {option.accountLabel}
                      {formatAccountIdentifier(option.accountIdentifier)
                        ? ` · ${formatAccountIdentifier(option.accountIdentifier)}`
                        : ''}
                    </Text>
                  </div>
                </Group>

                {isActive ? <IconCheck size={16} color={accentColor} /> : null}
              </Group>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
