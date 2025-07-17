'use client';

import { useState, useEffect } from 'react';
import { Select, Group, ThemeIcon, Text } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle, IconBrandTiktok, IconChevronDown } from '@tabler/icons-react';
import { setCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import { getPlatformIcon } from '@/utils/utils';

interface PlatformAdAccountDropdownClientProps {
  userInfo: any;
  platforms: any[];
  adAccounts: any[];
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

  useEffect(() => {
    if (selectedPlatform) {
      localStorage.setItem('selectedPlatformId', selectedPlatform);
      setCookie('platform_integration_id', selectedPlatform, { maxAge: 60 * 60 * 24 * 30 });
    }
    if (selectedAccount) {
      localStorage.setItem('selectedAccountId', selectedAccount);
      setCookie('ad_account_id', selectedAccount, { maxAge: 60 * 60 * 24 * 30 });
    }
    if (!selectedAccount) {
      localStorage.removeItem('selectedAccountId');
      setCookie('ad_account_id', '', { maxAge: 0 });
    }
  }, [selectedPlatform, selectedAccount]);

  useEffect(() => {
    if (!selectedPlatform) return;
    const accountsForPlatform = adAccounts.filter(a => a.platform_integration_id === selectedPlatform);
    if (accountsForPlatform.length === 0) {
      setSelectedAccount(null);
      return;
    }
    if (!selectedAccount || !accountsForPlatform.some(a => a.id === selectedAccount)) {
      setSelectedAccount(accountsForPlatform[0].id);
    }
  }, [selectedPlatform, adAccounts]);

  useEffect(() => {
    router.refresh();
  }, [selectedPlatform, selectedAccount, router]);

  const filteredAccounts = selectedPlatform
    ? adAccounts.filter(account => account.platform_integration_id === selectedPlatform)
    : [];

  const handlePlatformChange = (value: string | null) => {
    if (!value || value === selectedPlatform) return;
    setSelectedPlatform(value);
  };

  const handleAccountChange = (value: string | null) => {
    if (!value || value === selectedAccount) return;
    setSelectedAccount(value);
  };

  const platformItems = platforms.map(platform => ({
    value: platform.id,
    label: platform.platform_name.charAt(0).toUpperCase() + platform.platform_name.slice(1),
    customIcon: getPlatformIcon(platform.platform_name, 20)
  }));

  const accountItems = filteredAccounts.map(account => ({
    value: account.id,
    label: account.name,
    description: account.ad_account_id
  }));

  return (
    <Group>
      <Select
        placeholder="Select Platform"
        data={platformItems}
        value={selectedPlatform}
        onChange={handlePlatformChange}
        w={160}
        rightSection={<IconChevronDown size={14} />}
        /* @ts-expect-error - Mantine types don't match how we're using the styles prop */
        styles={() => ({
          rightSection: { pointerEvents: 'none' }
        })}
        renderOption={({ option }) => (
          <Group gap="xs">
            {/* @ts-expect-error - customIcon is a custom property we added to the option */}
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
        disabled={!selectedPlatform || accountItems.length === 0}
        rightSection={<IconChevronDown size={14} />}
        /* @ts-expect-error - Mantine types don't match how we're using the styles prop */
        styles={() => ({
          rightSection: { pointerEvents: 'none' }
        })}
        renderOption={({ option }) => (
          <div>
            <Text size="sm">{option.label}</Text>
            {/* @ts-expect-error - description is a custom property we added to the option */}
            {option.description && (<Text size="xs" c="dimmed">ID: {option.description}</Text>)}
          </div>
        )}
      />
    </Group>
  );
}
