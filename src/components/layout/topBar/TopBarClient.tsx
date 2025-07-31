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
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import PlatformAdAccountDropdownClient from './PlatformAdAccountDropdownClient';
// import { handleSignOut } from '@/lib/actions/user';
import { markAllNotificationsAsReadClient } from '@/lib/actions/notifications/client/markAllNotificationsAsReadClient';
import { markNotificationReadClient } from '@/lib/actions/notifications/client/markNotificationReadClient';


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
        // await handleSignOut();
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
        const unreadIds = userNotifications
            .filter(notification => !notification.read)
            .map(notification => notification.id);

        if (unreadIds.length === 0) return;

        const success = await markAllNotificationsAsReadClient(unreadIds);

        if (success) {
            setUserNotifications(prevNotifications =>
                prevNotifications.map(notification => ({ ...notification, read: true }))
            );

            setNotificationCount(0);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            const success = await markNotificationReadClient(notification.id);

            if (success) {
                setUserNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
                );

                setNotificationCount(prev => Math.max(0, prev - 1));
            }
        }

        if (notification.link) {
            router.push(notification.link);
        }
    };

    return (
        <div
            className="w-full h-20 bg-white px-10 border-b border-gray-300 flex items-center justify-between z-50 shadow-sm"
            style={{ minHeight: 80 }}
        >
            {/* Left Section */}
            <div className="flex items-center space-x-6">
                {/* Logo */}
                <div className="flex items-center space-x-4">
                    <Image
                        src="/images/logo/deepvisor.ico"
                        alt="DeepVisor"
                        width={32}
                        height={32}
                    />
                    <Text fw={700} size="xl" className="text-gray-700">
                        DeepVisor
                    </Text>
                </div>

                {/* Platform dropdown */}
                <PlatformAdAccountDropdownClient
                    userInfo={userInfo}
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
                            leftSection={<IconPlus size={20} />}
                            variant="light"
                            size="md"
                            radius="md"
                            fw={600}
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
                    leftSection={<IconSearch size={18} color="gray" />}
                    styles={() => ({
                        root: {
                            width: rem(340),
                        },
                        input: {
                            height: rem(44),
                            fontSize: rem(16)
                        }
                    })}
                    className="text-base hidden md:block"
                />

                {/* Notifications */}
                <Menu shadow="md" width={340} position="bottom-end">
                    <Menu.Target>
                        <Indicator disabled={notificationCount === 0} label={notificationCount} size={18}>
                            <ActionIcon size="xl" radius="xl" variant="subtle">
                                <IconBell size={24} />
                            </ActionIcon>
                        </Indicator>
                    </Menu.Target>

                    <Menu.Dropdown>
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
                                {userNotifications.map((notification) => (
                                    <Menu.Item
                                        key={notification.id}
                                        className={notification.read ? 'opacity-70' : ''}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div>
                                            <Group justify="apart" mb={4}>
                                                <Text size="md" fw={600}>{notification.title}</Text>
                                                <Text size="sm" c="dimmed">{notification.created_at}</Text>
                                            </Group>
                                            <Text size="sm" c="dimmed">{notification.message}</Text>
                                        </div>
                                    </Menu.Item>
                                ))}
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

                {/* Theme Toggle */}
                <Tooltip label={isDarkMode ? 'Light mode' : 'Dark mode'} position="bottom">
                    <ActionIcon
                        onClick={toggleTheme}
                        size="xl"
                        radius="xl"
                        variant="subtle"
                    >
                        {isDarkMode ? <IconSun size={24} /> : <IconMoon size={24} />}
                    </ActionIcon>
                </Tooltip>

                {/* Divider */}
                <Divider orientation="vertical" className="h-10" />

                {/* User menu */}
                <Menu shadow="md" width={220} position="bottom-end">
                    <Menu.Target>
                        <UnstyledButton className="flex items-center">
                            <Group gap="md">
                                <Avatar
                                    color="blue"
                                    radius="xl"
                                    size="lg"
                                >
                                    {userInitials}
                                </Avatar>
                                <div className="hidden md:block">
                                    <Text size="md" fw={600} lineClamp={1}>
                                        {fullName}
                                    </Text>
                                    <Text c="dimmed" size="sm" lineClamp={1}>
                                        {userInfo?.email}
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