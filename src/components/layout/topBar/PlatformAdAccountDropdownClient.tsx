'use client';

import { useState, useEffect } from 'react';
import { Select, Group, ThemeIcon, Text } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle, IconBrandTiktok, IconChevronDown } from '@tabler/icons-react';
import { setCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PlatformAdAccountDropdownClientProps {
  userInfo: any;
  platforms: any[];
  adAccounts: any[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function PlatformAdAccountDropdownClient({
  userInfo,
  platforms,
  adAccounts
}: PlatformAdAccountDropdownClientProps) {
  // Add router for refresh
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Get filtered accounts based on selected platform
  const filteredAccounts = selectedPlatform
    ? adAccounts.filter(account => account.platform_integration_id === selectedPlatform)
    : [];

  // Initialize selections on component mount
  useEffect(() => {
    if (platforms.length === 0) return;

    // Function to initialize selections with defaults
    const initializeSelections = () => {
      // Try to get from localStorage first
      let platformId = localStorage.getItem('selectedPlatformId');
      let accountId = localStorage.getItem('selectedAccountId');

      // If no platform is selected yet, default to first platform
      if (!platformId && platforms.length > 0) {
        platformId = platforms[0].id;
      }

      // Ensure we have a valid platform (should always be true in your flow)
      if (platformId) {
        // Save it to both localStorage and cookie
        localStorage.setItem('selectedPlatformId', platformId);
        setCookie('platform_integration_id', platformId, { maxAge: 60 * 60 * 24 * 30 });
        setSelectedPlatform(platformId);

        // Filter accounts for this platform
        const accountsForPlatform = adAccounts.filter(
          account => account.platform_integration_id === platformId
        );

        // Handle account selection
        if (accountsForPlatform.length > 0) {
          // If no account selected or current selection isn't valid, use first one
          const accountValid = accountId && accountsForPlatform.some(acc => acc.id === accountId);

          if (!accountValid) {
            accountId = accountsForPlatform[0].id;
          }

          localStorage.setItem('selectedAccountId', accountId);
          setCookie('ad_account_id', accountId, { maxAge: 60 * 60 * 24 * 30 });
        } else {
          // No accounts for this platform
          accountId = null;
          localStorage.removeItem('selectedAccountId');
          setCookie('ad_account_id', '', { maxAge: 0 });
        }

        setSelectedAccount(accountId);
      }
    };

    initializeSelections();
    setIsInitialLoad(false);
  }, [platforms, adAccounts]);

  // Handle platform change with refresh
  const handlePlatformChange = (value: string | null) => {
    // Never allow null selection
    if (!value) return;

    // Don't refresh if selection hasn't changed
    if (value === selectedPlatform) return;

    setSelectedPlatform(value);
    localStorage.setItem('selectedPlatformId', value);
    setCookie('platform_integration_id', value, { maxAge: 60 * 60 * 24 * 30 });

    // Find accounts for this platform
    const accountsForNewPlatform = adAccounts.filter(
      account => account.platform_integration_id === value
    );

    // If current account isn't for this platform, update to first available
    const currentAccountIsValid = selectedAccount &&
      accountsForNewPlatform.some(acc => acc.id === selectedAccount);

    if (!currentAccountIsValid && accountsForNewPlatform.length > 0) {
      const newAccountId = accountsForNewPlatform[0].id;
      setSelectedAccount(newAccountId);
      localStorage.setItem('selectedAccountId', newAccountId);
      setCookie('ad_account_id', newAccountId, { maxAge: 60 * 60 * 24 * 30 });
    } else if (accountsForNewPlatform.length === 0) {
      // No accounts for this platform
      setSelectedAccount(null);
      localStorage.removeItem('selectedAccountId');
      setCookie('ad_account_id', '', { maxAge: 0 }); // Delete the cookie
    }

    // Refresh the page to update server components
    // Short delay to ensure cookies are set
    setTimeout(() => {
      router.refresh();
    }, 100);
  };

  // Handle account change with refresh
  const handleAccountChange = (value: string | null) => {
    if (!value || value === selectedAccount) return;

    setSelectedAccount(value);
    localStorage.setItem('selectedAccountId', value);
    setCookie('ad_account_id', value, { maxAge: 60 * 60 * 24 * 30 });

    // Refresh the page to update server components
    setTimeout(() => {
      router.refresh();
    }, 100);
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
    customIcon: getPlatformIcon(platform.platform_name)
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
            {option.customIcon && <ThemeIcon size="sm" variant="light">{option.customIcon}</ThemeIcon>}
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
