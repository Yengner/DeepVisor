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

const DEMO_WORKSPACE_OPTIONS: WorkspaceOption[] = [
  {
    value: 'preview-meta',
    platformId: null,
    accountId: null,
    platformKey: 'meta',
    platformLabel: 'Meta',
    accountLabel: 'DeepVisor Main Account',
    accountIdentifier: 'act_98345122',
    preview: true,
  },
  {
    value: 'preview-google',
    platformId: null,
    accountId: null,
    platformKey: 'google',
    platformLabel: 'Google Ads',
    accountLabel: 'DeepVisor Search Main',
    accountIdentifier: '482-190-7721',
    preview: true,
  },
  {
    value: 'preview-tiktok',
    platformId: null,
    accountId: null,
    platformKey: 'tiktok',
    platformLabel: 'TikTok Ads',
    accountLabel: 'DeepVisor TikTok Core',
    accountIdentifier: '7183-4401-55',
    preview: true,
  },
];

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
}: PlatformAdAccountDropdownClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const liveOptions = useMemo(() => {
    return sortByPlatformOrder(
      platforms.map((platform) => {
        const primaryAccount =
          adAccounts.find((account) => account.platform_integration_id === platform.id) ?? null;

        return {
          value: `live:${platform.id}:${primaryAccount?.id ?? 'none'}`,
          platformId: platform.id,
          accountId: primaryAccount?.id ?? null,
          platformKey: platform.platform_name.toLowerCase(),
          platformLabel: formatPlatformLabel(platform.platform_name.toLowerCase()),
          accountLabel: primaryAccount?.name ?? 'No ad account connected',
          accountIdentifier: primaryAccount?.external_account_id ?? null,
          preview: false,
        } satisfies WorkspaceOption;
      })
    );
  }, [adAccounts, platforms]);

  const previewOptions = useMemo(() => {
    const livePlatformKeys = new Set(liveOptions.map((option) => option.platformKey));
    return DEMO_WORKSPACE_OPTIONS.filter((option) => !livePlatformKeys.has(option.platformKey));
  }, [liveOptions]);

  const workspaceOptions = useMemo(
    () => [...liveOptions, ...previewOptions],
    [liveOptions, previewOptions]
  );

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

  const hasPreviewOptions = previewOptions.length > 0;
  const selectedIcon = getPlatformIcon(selectedOption.platformKey, 18);
  const accentColor = 'var(--platform-accent)';
  const accentStrong = 'var(--platform-accent-strong)';
  const accentSoft = 'var(--platform-accent-soft)';
  const accentSoftStrong = 'var(--platform-accent-soft-strong)';
  const borderColor = 'var(--platform-border)';

  return (
    <Menu shadow="md" width={360} position="bottom-start">
      <Menu.Target>
        <UnstyledButton
          disabled={isPending}
          style={{
            minWidth: 290,
            padding: '10px 14px',
            borderRadius: 14,
            border: `1px solid ${borderColor}`,
            background: 'rgba(255, 255, 255, 0.78)',
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
          }}
        >
          <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
            <Group align="center" wrap="nowrap" gap="sm">
              <ThemeIcon
                size="lg"
                radius="xl"
                variant="filled"
                style={{
                  backgroundColor: selectedOption.preview ? 'rgba(148, 163, 184, 0.14)' : accentSoftStrong,
                  color: selectedOption.preview ? '#64748b' : accentStrong,
                  border: selectedOption.preview ? '1px solid rgba(148, 163, 184, 0.24)' : `1px solid ${borderColor}`,
                }}
              >
                {selectedIcon}
              </ThemeIcon>

              <div style={{ minWidth: 0 }}>
                <Group gap={6} wrap="wrap">
                  <Text size="sm" fw={700} lineClamp={1}>
                      {selectedOption.platformLabel}
                    </Text>
                  {selectedOption.preview ? (
                    <Badge size="xs" color="gray" variant="light">
                      Preview
                    </Badge>
                  ) : null}
                </Group>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {selectedOption.accountLabel}
                  {formatAccountIdentifier(selectedOption.accountIdentifier)
                    ? ` · ${formatAccountIdentifier(selectedOption.accountIdentifier)}`
                    : ''}
                </Text>
              </div>
            </Group>

            <IconChevronDown size={16} color="#6b7280" />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Platforms & ad accounts</Menu.Label>
        <Text size="xs" c="dimmed" px="sm" pb="xs">
          Switch the workspace view by platform. Each platform carries one primary ad account in
          this version of the selector.
        </Text>
        {hasPreviewOptions ? (
          <Text size="xs" c="dimmed" px="sm" pb="sm">
            Preview rows are static until those integrations are connected for real.
          </Text>
        ) : null}

        {workspaceOptions.map((option) => {
          const isActive = option.value === selectedOption.value;
          const optionIcon = getPlatformIcon(option.platformKey, 18);

          return (
            <Menu.Item key={option.value} onClick={() => handleWorkspaceSelect(option)}>
              <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                <Group align="center" wrap="nowrap" gap="sm">
                  <ThemeIcon
                    size="lg"
                    radius="xl"
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
