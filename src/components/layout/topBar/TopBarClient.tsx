'use client';

import {
    Group,
    TextInput,
    Avatar,
    Text,
    Menu,
    UnstyledButton,
    Image,
    rem,
    Box,
    Divider,
    ActionIcon,
    Button,
    Tooltip,
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
    IconSun,
    IconMoon,
    IconChartBar,
    IconTable
} from '@tabler/icons-react';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { handleSignOut } from '@/lib/actions/user.actions';
import PlatformAdAccountDropdownClient from './PlatformAdAccountDropdownClient';
// Import utility functions from the correct locations
import { formatRelativeTime, markNotificationReadClient, markAllNotificationsAsReadClient } from '@/lib/utils/notifications';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Notification {
    id: string;
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    type: string;
    link?: string;
}

interface TopBarClientProps {
    userInfo: any;
    platforms?: any[];
    adAccounts?: any[];
    notifications?: Notification[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function TopBarClient({
    userInfo,
    platforms = [],
    adAccounts = [],
    notifications = []
}: TopBarClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [userNotifications, setUserNotifications] = useState<Notification[]>(notifications);
    const [notificationCount, setNotificationCount] = useState(0);

    // Calculate unread notification count
    useEffect(() => {
        setNotificationCount(userNotifications.filter(n => !n.read).length);
    }, [userNotifications]);

    const fullName = userInfo?.full_name || 'User';
    const userInitials = fullName.split(' ').map((name: string) => name[0]).join('').toUpperCase();

    const handleLogout = async () => {
        await handleSignOut();
        router.push('/login');
    };

    // Toggle theme mode
    // Not important 
    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
        // Implement actual theme change logic here
    };

    // Mark all notifications as read
    const markAllRead = async () => {
        // Get IDs of unread notifications
        const unreadIds = userNotifications
            .filter(notification => !notification.read)
            .map(notification => notification.id);

        if (unreadIds.length === 0) return;

        // Use the utility function from notifications.ts
        const success = await markAllNotificationsAsReadClient(unreadIds);

        if (success) {
            // Update local state
            setUserNotifications(prevNotifications =>
                prevNotifications.map(notification => ({ ...notification, read: true }))
            );

            setNotificationCount(0);
        }
    };

    // Handle notification click
    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            const success = await markNotificationReadClient(notification.id);

            if (success) {
                // Update the notification in state
                setUserNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
                );

                // Update the count
                setNotificationCount(prev => Math.max(0, prev - 1));
            }
        }

        // Navigate if link is provided
        if (notification.link) {
            router.push(notification.link);
        }
    };

    return (
        <div className="w-full h-16 bg-white px-6 border-b border-gray-300 flex items-center justify-between z-50">
            {/* Left Section */}
            <div className="flex items-center space-x-4">
                {/* Logo */}
                <div className="flex items-center space-x-3">
                    <Image
                        src="/images/logo/deepvisor.ico"
                        alt="DeepVisor"
                        width={20}
                        height={20}
                    />
                    <Text fw={600} size="lg" className="text-gray-700">
                        DeepVisor
                    </Text>
                </div>

                {/* Platform dropdown */}
                <PlatformAdAccountDropdownClient
                    userInfo={userInfo}
                    platforms={platforms}
                    adAccounts={adAccounts}
                />
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
                {/* Quick Action Button */}
                <Menu position="bottom-end" shadow="md">
                    <Menu.Target>
                        <Button
                            leftSection={<IconPlus size={16} />}
                            variant="light"
                            size="xs"
                            radius="md"
                        >
                            Create New
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Campaigns</Menu.Label>
                        <Menu.Item
                            leftSection={<IconPresentationAnalytics size={16} />}
                            onClick={() => router.push('/campaigns/create?mode=smart')}
                        >
                            Smart Campaign
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconTable size={16} />}
                            onClick={() => router.push('/campaigns/create?mode=manual')}
                        >
                            Custom Campaign
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            leftSection={<IconChartBar size={16} />}
                            onClick={() => router.push('/reports/new')}
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
                    leftSection={<IconSearch size={16} color="gray" />}
                    styles={() => ({
                        root: {
                            width: rem(300),
                        },
                        input: {
                            height: rem(36),
                            fontSize: rem(14)
                        }
                    })}
                    className="text-sm hidden md:block"
                />

                {/* Notifications */}
                <Menu shadow="md" width={320} position="bottom-end">
                    <Menu.Target>
                        <Indicator disabled={notificationCount === 0} label={notificationCount} size={16}>
                            <ActionIcon size="lg" radius="xl" variant="subtle">
                                <IconBell size={20} />
                            </ActionIcon>
                        </Indicator>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <div className="flex justify-between items-center px-3 py-2">
                            <Text fw={500}>Notifications</Text>
                            {notificationCount > 0 && (
                                <Button variant="subtle" size="xs" onClick={markAllRead}>
                                    Mark all read
                                </Button>
                            )}
                        </div>
                        <Menu.Divider />

                        {userNotifications.length > 0 ? (
                            <>
                                {userNotifications.map((notification) => (
                                    <Menu.Item
                                        key={notification.id}
                                        className={notification.read ? 'opacity-70' : ''}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div>
                                            <Group justify="apart" mb={4}>
                                                <Text size="sm" fw={500}>{notification.title}</Text>
                                                <Text size="xs" c="dimmed">{formatRelativeTime(notification.created_at)}</Text>
                                            </Group>
                                            <Text size="xs" c="dimmed">{notification.message}</Text>
                                        </div>
                                    </Menu.Item>
                                ))}
                                <Menu.Divider />
                                <Menu.Item ta="center">
                                    <Text size="xs" component="a" href="/notifications" c="blue">
                                        View all notifications
                                    </Text>
                                </Menu.Item>
                            </>
                        ) : (
                            <Box p="md" ta="center">
                                <Text size="sm" c="dimmed">No new notifications</Text>
                            </Box>
                        )}
                    </Menu.Dropdown>
                </Menu>

                {/* Theme Toggle */}
                <Tooltip label={isDarkMode ? 'Light mode' : 'Dark mode'} position="bottom">
                    <ActionIcon
                        onClick={toggleTheme}
                        size="lg"
                        radius="xl"
                        variant="subtle"
                    >
                        {isDarkMode ? <IconSun size={20} /> : <IconMoon size={20} />}
                    </ActionIcon>
                </Tooltip>

                {/* Divider */}
                <Divider orientation="vertical" className="h-8" />

                {/* User menu */}
                <Menu shadow="md" width={200} position="bottom-end">
                    <Menu.Target>
                        <UnstyledButton className="flex items-center">
                            <Group gap="sm">
                                <Avatar
                                    color="blue"
                                    radius="xl"
                                    size="md"
                                >
                                    {userInitials}
                                </Avatar>
                                <div className="hidden md:block">
                                    <Text size="sm" fw={500} lineClamp={1}>
                                        {fullName}
                                    </Text>
                                    <Text c="dimmed" size="xs" lineClamp={1}>
                                        {userInfo?.email}
                                    </Text>
                                </div>
                                <IconChevronDown size={16} className="hidden md:block" />
                            </Group>
                        </UnstyledButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Label>Account</Menu.Label>
                        <Menu.Item
                            leftSection={<IconUser size={14} />}
                            onClick={() => router.push('/settings/profile')}
                        >
                            Profile
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconSettings size={14} />}
                            onClick={() => router.push('/settings')}
                        >
                            Settings
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconHelp size={14} />}
                            onClick={() => router.push('/help')}
                        >
                            Help Center
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            color="red"
                            leftSection={<IconLogout size={14} />}
                            onClick={handleLogout}
                        >
                            Logout
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </div>
        </div>
    );
}