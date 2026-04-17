'use client';

import { clientHandleSignOut } from '@/lib/client';
import { STATIC_NOTIFICATION_PREVIEW, type NotificationFeedItem } from '@/lib/shared';
import {
    Group,
    TextInput,
    Avatar,
    Text,
    Menu,
    UnstyledButton,
    rem,
    Box,
    Divider,
    ActionIcon,
    Button,
    Indicator
} from '@mantine/core';
import {
    IconSearch,
    IconChevronDown,
    IconLogout,
    IconSettings,
    IconUser,
    IconHelp,
    IconBell,
    IconPlus,
    IconPresentationAnalytics,
    IconChartBar,
    IconTable
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import DeepVisorNotices from '@/components/intelligence/DeepVisorNotices';
import PlatformAdAccountDropdownClient from './PlatformAdAccountDropdownClient';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TopBarClientProps {
    userInfo: any;
    platforms?: any[];
    adAccounts?: any[];
    notifications?: NotificationFeedItem[];
    initialPlatformId?: string | null;
    initialAccountId?: string | null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function TopBarClient({
    userInfo,
    platforms = [],
    adAccounts = [],
    notifications = [],
    initialPlatformId,
    initialAccountId
}: TopBarClientProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [userNotifications, setUserNotifications] = useState<NotificationFeedItem[]>(
        notifications.length > 0 ? notifications : STATIC_NOTIFICATION_PREVIEW
    );
    const [notificationCount, setNotificationCount] = useState(0);

    // Calculate unread notification count
    useEffect(() => {
        setNotificationCount(userNotifications.filter(n => !n.read).length);
    }, [userNotifications]);

    const fullName = userInfo?.full_name || 'User';
    const userInitials = fullName.split(' ').map((name: string) => name[0]).join('').toUpperCase();
    const accentColor = 'var(--platform-accent)';
    const accentStrong = 'var(--platform-accent-strong)';
    const accentSoft = 'var(--platform-accent-soft)';
    const accentSoftStrong = 'var(--platform-accent-soft-strong)';
    const borderColor = 'var(--platform-border)';
    const textStrong = 'var(--platform-text-strong)';
    const notificationDropdownWidth = 380;

    const formatNotificationTime = (value: string) => {
        const date = new Date(value);
        const deltaMs = Date.now() - date.getTime();

        if (!Number.isFinite(deltaMs)) {
            return value;
        }

        const hours = Math.round(deltaMs / (60 * 60 * 1000));
        if (hours < 1) {
            return 'Within the last hour';
        }

        if (hours < 24) {
            return `${hours}h ago`;
        }

        const days = Math.round(hours / 24);
        return `${days}d ago`;
    };

    // Mark all notifications as read
    const markAllRead = () => {
        setUserNotifications(prevNotifications =>
            prevNotifications.map(notification => ({ ...notification, read: true }))
        );
    };

    const handleNotificationClick = (notification: NotificationFeedItem) => {
        if (!notification.read) {
            setUserNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
            );
        }

        if (notification.link) {
            router.push(notification.link);
        }
    };

    return (
        <div
            className="w-full h-16 px-10 flex items-center justify-between z-50"
            style={{
                minHeight: 30,
                background: 'transparent'
            }}
        >
            {/* Left Section */}
            <div className="flex items-center space-x-6">
                {/* Logo */}
                <div className="flex items-center space-x-4">
                    <Box
                        w={36}
                        h={36}
                        style={{
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background:
                                'linear-gradient(135deg, var(--platform-accent-strong) 0%, var(--platform-accent) 58%, rgba(255,255,255,0.96) 160%)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 10px 24px rgba(15, 23, 42, 0.12)',
                            color: '#ffffff',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <Text
                            fw={800}
                            size="sm"
                            lh={1}
                            style={{
                                letterSpacing: '-0.04em',
                                position: 'relative',
                                top: '-0.5px',
                            }}
                        >
                            DV
                        </Text>
                    </Box>
                    <Text fw={700} size="xl" style={{ color: textStrong }}>
                        DeepVisor
                    </Text>
                </div>

                {/* Platform dropdown */}
                <PlatformAdAccountDropdownClient
                    platforms={platforms}
                    adAccounts={adAccounts}
                    initialPlatformId={initialPlatformId}
                    initialAccountId={initialAccountId}
                />
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-6">
                {/* Quick Action Button */}
                <Menu position="bottom-end" shadow="md">
                    <Menu.Target>
                        <Button
                            leftSection={<IconPlus size={18} />}
                            variant="light"
                            size="sm"
                            radius="md"
                            fw={600}
                            style={{
                                backgroundColor: accentSoft,
                                color: accentStrong,
                                border: `1px solid ${borderColor}`,
                            }}
                        >
                            Create New
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Campaigns</Menu.Label>
                        <Menu.Item
                            leftSection={<IconPresentationAnalytics size={18} />}
                            onClick={() => router.push('/campaigns/create?mode=smart')}
                        >
                            Smart Campaign
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconTable size={18} />}
                            onClick={() => router.push('/campaigns/create?mode=manual')}
                        >
                            Custom Campaign
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            leftSection={<IconChartBar size={18} />}
                            onClick={() => router.push('/reports')}
                        >
                            Report
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>

                {/* Search bar */}
                <TextInput
                    placeholder="Try searching 'link with Ads'"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftSection={<IconSearch size={15} color="gray" />}
                    styles={() => ({
                        root: {
                            width: rem(240),
                        },
                        input: {
                            height: rem(24),
                            fontSize: rem(15),
                            borderColor,
                            backgroundColor: 'rgba(255,255,255,0.72)',
                        }
                    })}
                    className="text-base hidden md:block"
                />

                <DeepVisorNotices variant="popover" showCalendarLink />

                {/* Notifications */}
                <Menu shadow="md" width={notificationDropdownWidth} position="bottom-end">
                    <Menu.Target>
                        <Indicator disabled={notificationCount === 0} label={notificationCount} size={18}>
                            <ActionIcon
                                size="xl"
                                radius="xl"
                                variant="subtle"
                                style={{ color: accentStrong, backgroundColor: accentSoft }}
                            >
                                <IconBell size={24} />
                            </ActionIcon>
                        </Indicator>
                    </Menu.Target>

                    <Menu.Dropdown
                        style={{
                            width: `min(92vw, ${notificationDropdownWidth}px)`,
                            maxHeight: 'min(72vh, 440px)',
                            overflow: 'hidden',
                        }}
                    >
                        <div className="flex justify-between items-center px-3 py-2">
                            <Text fw={600}>Notifications</Text>
                            {notificationCount > 0 && (
                                <Button variant="subtle" size="xs" onClick={markAllRead}>
                                    Mark all read
                                </Button>
                            )}
                        </div>
                        <Menu.Divider />

                        {userNotifications.length > 0 ? (
                            <>
                                <Box
                                    px="xs"
                                    pb="xs"
                                    style={{
                                        maxHeight: 'min(54vh, 320px)',
                                        overflowY: 'auto',
                                    }}
                                >
                                    {userNotifications.map((notification) => (
                                        <Menu.Item
                                            key={notification.id}
                                            className={notification.read ? 'opacity-70' : ''}
                                            onClick={() => handleNotificationClick(notification)}
                                        >
                                            <div style={{ width: '100%' }}>
                                                <Group justify="apart" align="flex-start" mb={4} gap="sm" wrap="nowrap">
                                                    <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                                                        {notification.title}
                                                    </Text>
                                                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                                                        {formatNotificationTime(notification.created_at)}
                                                    </Text>
                                                </Group>
                                                <Text size="sm" c="dimmed" lineClamp={2}>
                                                    {notification.message}
                                                </Text>
                                            </div>
                                        </Menu.Item>
                                    ))}
                                </Box>
                                <Menu.Divider />
                                <Menu.Item ta="center">
                                    <Text size="sm" component="a" href="/notifications" c="blue">
                                        View all notifications
                                    </Text>
                                </Menu.Item>
                            </>
                        ) : (
                            <Box p="md" ta="center">
                                <Text size="md" c="dimmed">No new notifications</Text>
                            </Box>
                        )}
                    </Menu.Dropdown>
                </Menu>

                {/* Divider */}
                <Divider orientation="vertical" className="h-16" color={borderColor} />

                {/* User menu */}
                <Menu shadow="md" width={220} position="bottom-end">
                    <Menu.Target>
                        <UnstyledButton className="flex items-center">
                            <Group gap="md">
                                <Avatar
                                    color="blue"
                                    radius="xl"
                                    size={45}
                                    style={{
                                        backgroundColor: accentSoftStrong,
                                        color: accentStrong,
                                        border: `1px solid ${borderColor}`,
                                    }}
                                >
                                    {userInitials}
                                </Avatar>
                                <div className="hidden md:block">
                                    <Text size="sm" fw={600} lineClamp={1} style={{ color: textStrong }}>
                                        {fullName}
                                    </Text>
                                    <Text c="dimmed" size="sm" lineClamp={1}>
                                        {userInfo?.business_name}
                                    </Text>
                                </div>
                                <IconChevronDown size={20} className="hidden md:block" />
                            </Group>
                        </UnstyledButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Label>Account</Menu.Label>
                        <Menu.Item
                            leftSection={<IconUser size={16} />}
                            onClick={() => router.push('/settings/profile')}
                        >
                            Profile
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconSettings size={16} />}
                            onClick={() => router.push('/settings')}
                        >
                            Settings
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconHelp size={16} />}
                            onClick={() => router.push('/help')}
                        >
                            Help Center
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            color="red"
                            leftSection={<IconLogout size={16} />}
                            onClick={clientHandleSignOut}
                        >
                            Logout
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </div>
        </div>
    );
}
