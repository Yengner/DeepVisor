'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Select, Group, ThemeIcon, Text } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { getPlatformIcon } from '@/utils/utils';
import { setSelection } from './setSelection';

interface PlatformAdAccountDropdownClientProps {
  userInfo: any;
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

export default function PlatformAdAccountDropdownClient({
  userInfo,
  platforms,
  adAccounts,
  initialPlatformId,
  initialAccountId,
}: PlatformAdAccountDropdownClientProps) {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(initialPlatformId ?? null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(initialAccountId ?? null);
  const [isPending, startTransition] = useTransition();

  // Default a platform if none was selected (rare, but safe)
  useEffect(() => {
    if (!selectedPlatform && platforms.length > 0) {
      setSelectedPlatform(platforms[0].id);
    }
  }, [platforms, selectedPlatform]);

  const filteredAccounts = useMemo(
    () =>
      selectedPlatform
        ? adAccounts.filter((a) => a.platform_integration_id === selectedPlatform)
        : [],
    [selectedPlatform, adAccounts]
  );

  useEffect(() => {
    if (!selectedPlatform) {
      setSelectedAccount(null);
      return;
    }
    if (!filteredAccounts.length) {
      setSelectedAccount(null);
      return;
    }
    if (!selectedAccount || !filteredAccounts.some((a) => a.id === selectedAccount)) {
      setSelectedAccount(filteredAccounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, filteredAccounts]);

  // Persist selection to httpOnly cookies via server action, then refresh
  useEffect(() => {
    startTransition(async () => {
      await setSelection({
        platformId: selectedPlatform,
        accountRowId: selectedAccount,
      });
      router.refresh();
    });
  }, [selectedPlatform, selectedAccount, router]);

  const handlePlatformChange = (value: string | null) => {
    if (!value || value === selectedPlatform) return;
    setSelectedPlatform(value);
  };

  const handleAccountChange = (value: string | null) => {
    if (!value || value === selectedAccount) return;
    setSelectedAccount(value);
  };

  const platformItems = platforms.map((platform) => ({
    value: platform.id,
    label: platform.platform_name.charAt(0).toUpperCase() + platform.platform_name.slice(1),
    customIcon: getPlatformIcon(platform.platform_name, 20),
  }));

  const accountItems = filteredAccounts.map((account) => ({
    value: account.id, 
    label: account.name ?? 'Unnamed',
    description: account.external_account_id ? `ID: …${account.external_account_id.slice(-6)}` : undefined,
  }));

  return (
    <Group>
      <Select
        placeholder="Select Platform"
        data={platformItems}
        value={selectedPlatform}
        onChange={handlePlatformChange}
        w={160}
        disabled={isPending}
        rightSection={<IconChevronDown size={14} />}
        /* @ts-expect-error Mantine styles type */
        styles={() => ({ rightSection: { pointerEvents: 'none' } })}
        renderOption={({ option }) => (
          <Group gap="xs">
            {/* @ts-expect-error custom */}
            {option.customIcon && <ThemeIcon size="md" variant="light">{option.customIcon}</ThemeIcon>}
            <Text>{option.label}</Text>
          </Group>
        )}
      />

      <Select
        placeholder="Select Ad Account"
        data={accountItems}
        value={selectedAccount}
        onChange={handleAccountChange}
        w={200}
        disabled={!selectedPlatform || accountItems.length === 0 || isPending}
        rightSection={<IconChevronDown size={14} />}
        /* @ts-expect-error Mantine styles type */
        styles={() => ({ rightSection: { pointerEvents: 'none' } })}
        renderOption={({ option }) => (
          <div>
            <Text size="sm">{option.label}</Text>
            {/* @ts-expect-error custom */}
            {option.description && <Text size="xs" c="dimmed">{option.description}</Text>}
          </div>
        )}
      />
    </Group>
  );
}
