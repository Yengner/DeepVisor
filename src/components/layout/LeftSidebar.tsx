'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  NavLink,
  Stack,
  ThemeIcon,
  Tooltip,
  Divider,
} from '@mantine/core';
import {
  IconHome2,
  IconChartBar,
  IconPuzzle,
  IconPresentation,
  IconSettings,
  IconLogout,
  IconRobot
} from '@tabler/icons-react';
import { handleSignOut } from '@/lib/server/actions/user/auth';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { name: 'Home', icon: IconHome2, route: '/dashboard' },
    { name: 'Agency', icon: IconRobot, route: '/agency' },
    { name: 'Campaigns', icon: IconPresentation, route: '/campaigns' },
    { name: 'Reports', icon: IconChartBar, route: '/reports' },
    { name: 'Integration', icon: IconPuzzle, route: '/integration' },
  ];

  const handleNavigation = (route: string) => {
    router.push(route);
  };

  const handleLogout = async () => {
    await handleSignOut();
    router.push('/login');
  };

  const sidebarBg = 'var(--platform-sidebar-bg)';
  const activeColor = 'var(--platform-accent)';
  const hoverColor = 'var(--platform-accent-soft)';
  const iconInactiveColor = 'var(--platform-nav-icon)';
  const textColor = 'var(--platform-text-strong)';
  const dividerColor = 'var(--platform-border)';

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed top-16 left-0 h-[calc(100vh-4rem)] z-40 border-r border-gray-200 transition-all duration-500 ${isExpanded ? 'w-52' : 'w-16'}`}
      style={{
        backgroundColor: sidebarBg,
        borderRightColor: 'var(--platform-border)',
        boxShadow: 'var(--platform-sidebar-shadow)'
      }}
    >
      <div className="h-full flex flex-col justify-between py-8">
        {/* Top Section: Menu Items */}
        <Stack gap={12} >
          {menuItems.map((item) => (
            isExpanded ? (
              <NavLink
                key={item.name}
                label={<span style={{ fontSize: 17, fontWeight: 600 }}>{item.name}</span>}
                leftSection={
                  <ThemeIcon
                    size={32}
                    variant="filled"
                    style={{
                      backgroundColor: pathname === item.route ? activeColor : hoverColor,
                      color: pathname === item.route ? '#ffffff' : iconInactiveColor,
                      minWidth: 32,
                      minHeight: 32,
                    }}
                  >
                    <item.icon size={21} stroke={1.5} color={pathname === item.route ? "#ffffff" : undefined} />
                  </ThemeIcon>
                }
                active={pathname === item.route}
                onClick={() => handleNavigation(item.route)}
                variant={pathname === item.route ? "filled" : "light"}
                styles={() => ({
                  root: {
                    '&[dataActive]': {
                      backgroundColor: activeColor
                    },
                    '&:hover': {
                      backgroundColor: hoverColor
                    },
                    borderRadius: 12,
                    padding: '12px 12px',
                  },
                  label: {
                    color: pathname === item.route ? "#ffffff" : textColor,
                    fontWeight: pathname === item.route ? 700 : 600,
                    fontSize: 17
                  }
                })}
              />
            ) : (
              <Tooltip
                key={item.name}
                label={<span style={{ fontSize: 14 }}>{item.name}</span>}
                position="right"
                withArrow
                transitionProps={{ transition: "pop", duration: 200 }}
              >
                <NavLink
                  leftSection={
                  <ThemeIcon
                    size={32}
                    variant="filled"
                    style={{
                      backgroundColor: pathname === item.route ? activeColor : hoverColor,
                      color: pathname === item.route ? '#ffffff' : iconInactiveColor,
                      minWidth: 32,
                      minHeight: 32,
                    }}
                  >
                      <item.icon size={21} stroke={1.5} color={pathname === item.route ? "#ffffff" : undefined} />
                    </ThemeIcon>
                  }
                  active={pathname === item.route}
                  onClick={() => handleNavigation(item.route)}
                  variant="subtle"
                  styles={(theme) => ({
                    root: {
                      borderRadius: theme.radius.md,
                      '&[dataActive]': {
                        backgroundColor: activeColor
                      },
                      '&:hover': {
                        backgroundColor: hoverColor
                      },
                      padding: '12px 12px',
                    }
                  })}
                />
              </Tooltip>
            )
          ))}
        </Stack>

        {/* Bottom Section: Settings & Logout */}
        <Stack gap={10} mb={10}>
          <Divider my="sm" color={dividerColor} />

          {isExpanded ? (
            <>
              <NavLink
                label={<span style={{ fontSize: 18, fontWeight: 600 }}>Settings</span>}
                leftSection={
                  <ThemeIcon size={34} variant="light" color={iconInactiveColor}>
                    <IconSettings size={22} stroke={1.7} />
                  </ThemeIcon>
                }
                onClick={() => handleNavigation('/settings')}
                styles={{
                  label: {
                    color: textColor,
                    fontWeight: 600,
                    fontSize: 18
                  },
                  root: {
                    '&:hover': {
                      backgroundColor: hoverColor
                    },
                    borderRadius: 10,
                    padding: '12px 12px',
                  }
                }}
              />

              <NavLink
                label={<span style={{ fontSize: 18, fontWeight: 600 }}>Logout</span>}
                leftSection={
                  <ThemeIcon size={34} variant="light" color="red">
                    <IconLogout size={22} stroke={1.7} />
                  </ThemeIcon>
                }
                color="red"
                onClick={handleLogout}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: '#ffe5e5'
                    },
                    borderRadius: 10,
                    padding: '12px 12px',
                  },
                  label: {
                    fontWeight: 600,
                    fontSize: 18
                  }
                }}
              />
            </>
          ) : (
            <>
              <Tooltip
                label={<span style={{ fontSize: 15 }}>Settings</span>}
                position="right"
                withArrow
                transitionProps={{ transition: "pop", duration: 200 }}
              >
                <NavLink
                  leftSection={
                    <ThemeIcon size={34} variant="light" color={iconInactiveColor}>
                      <IconSettings size={22} stroke={1.7} />
                    </ThemeIcon>
                  }
                  onClick={() => handleNavigation('/settings')}
                  variant="subtle"
                  styles={{
                    root: {
                      '&:hover': {
                        backgroundColor: hoverColor
                      },
                      borderRadius: 10,
                      padding: '12px 12px',
                    }
                  }}
                />
              </Tooltip>

              <Tooltip
                label={<span style={{ fontSize: 15 }}>Logout</span>}
                position="right"
                withArrow
                transitionProps={{ transition: "pop", duration: 200 }}
              >
                <NavLink
                  leftSection={
                    <ThemeIcon size={34} variant="light" color="red">
                      <IconLogout size={22} stroke={1.7} />
                    </ThemeIcon>
                  }
                  onClick={handleLogout}
                  variant="subtle"
                  color="red"
                  styles={{
                    root: {
                      '&:hover': {
                        backgroundColor: '#ffe5e5'
                      },
                      borderRadius: 10,
                      padding: '12px 12px',
                    }
                  }}
                />
              </Tooltip>
            </>
          )}
        </Stack>
      </div>
    </div>
  );
};

export default Sidebar;
