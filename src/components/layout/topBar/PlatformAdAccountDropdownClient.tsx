'use client';
import { useState, useEffect } from 'react';
import { Select, Group, ThemeIcon, Text } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle, IconBrandTiktok, IconChevronDown } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PlatformAdAccountDropdownClientProps {
  userInfo: any;
  platforms: any[];
  adAccounts: any[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function PlatformAdAccountDropdownClient({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userInfo,
  platforms,
  adAccounts
}: PlatformAdAccountDropdownClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize with null and update after component mounts
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(
    searchParams.get('platform') || null
  );

  const [selectedAccount, setSelectedAccount] = useState<string | null>(
    searchParams.get('account') || null
  );

  useEffect(() => {
    const savedPlatform = localStorage.getItem('selectedPlatform');
    const savedAccount = localStorage.getItem('selectedAccount');

    if (savedPlatform && !selectedPlatform) {
      setSelectedPlatform(savedPlatform);
    }

    if (savedAccount && !selectedAccount) {
      setSelectedAccount(savedAccount);
    }
  }, []);

  // Filter accounts based on selected platform
  const filteredAccounts = selectedPlatform
    ? adAccounts.filter(account => account.platform_integration_id === selectedPlatform)
    : [];

  const handlePlatformChange = (value: string | null) => {
    setSelectedPlatform(value);
    setSelectedAccount(null);

    if (value) {
      localStorage.setItem('selectedPlatform', value);

      const params = new URLSearchParams(searchParams.toString());
      params.set('platform', value);
      params.delete('account');

      if (pathname.includes('/dashboard')) {
        router.push(`${pathname}?${params.toString()}`);
      }
    } else {
      localStorage.removeItem('selectedPlatform');
    }
  };

  const handleAccountChange = (value: string | null) => {
    setSelectedAccount(value);

    if (value) {
      localStorage.setItem('selectedAccount', value);

      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      params.set('account', value);

      // Only navigate if we're already on a dashboard page
      if (pathname.includes('/dashboard')) {
        router.push(`${pathname}?${params.toString()}`);
      }
    } else {
      localStorage.removeItem('selectedAccount');
    }
  };

  const getPlatformIcon = (platformName: string) => {
    switch (platformName?.toLowerCase()) {
      case 'facebook':
      case 'meta':
        return <IconBrandFacebook size={16} />;
      case 'google':
        return <IconBrandGoogle size={16} />;
      case 'tiktok':
        return <IconBrandTiktok size={16} />;
      default:
        return null;
    }
  };

  const platformItems = platforms.map(platform => ({
    value: platform.id,
    label: platform.platform_name.charAt(0).toUpperCase() + platform.platform_name.slice(1),
    customIcon: getPlatformIcon(platform.platform_name) // Renamed to avoid conflict with ComboboxItem type
  }));

  const accountItems = filteredAccounts.map(account => ({
    value: account.id,
    label: account.name,
    description: account.ad_account_id
  }));

  return (
    <Group>
      {/* @ts-ignore */}
      <Select
        placeholder="Select Platform"
        data={platformItems}
        value={selectedPlatform}
        onChange={handlePlatformChange}
        w={160}
        clearable
        rightSection={<IconChevronDown size={14} />}
        /* @ts-ignore */
        styles={(theme) => ({
          rightSection: { pointerEvents: 'none' }
        })}
        /* @ts-ignore */
        renderOption={({ option }) => (
          <Group gap="xs">
            {/* @ts-ignore */}
            {option.customIcon && <ThemeIcon size="sm" variant="light">{option.customIcon}</ThemeIcon>}
            <Text>{option.label}</Text>
          </Group>
        )}
      />

      {/* @ts-ignore */}
      <Select
        placeholder="Select Ad Account"
        data={accountItems}
        value={selectedAccount}
        onChange={handleAccountChange}
        w={200}
        disabled={!selectedPlatform || accountItems.length === 0}
        clearable
        rightSection={<IconChevronDown size={14} />}
        /* @ts-ignore */
        styles={(theme) => ({
          rightSection: { pointerEvents: 'none' }
        })}
        /* @ts-ignore */
        renderOption={({ option }) => (
          <div>
            <Text size="sm">{option.label}</Text>
            {/* @ts-ignore */}
            {option.description && (<Text size="xs" c="dimmed">ID: {option.description}</Text>)}
          </div>
        )}
      />
    </Group>
  );
}
