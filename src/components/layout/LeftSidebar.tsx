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
  IconUpload,
  IconLogout
} from '@tabler/icons-react';
import { handleSignOut } from '@/lib/actions/user.actions';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { name: 'Home', icon: IconHome2, route: '/dashboard' },
    { name: 'Campaigns', icon: IconPresentation, route: '/campaigns' },
    { name: 'Reports', icon: IconChartBar, route: '/reports' },
    { name: 'Upload', icon: IconUpload, route: '/upload' },
    { name: 'Integration', icon: IconPuzzle, route: '/integration' },
  ];

  const handleNavigation = (route: string) => {
    router.push(route);
  };

  const handleLogout = async () => {
    await handleSignOut();
    router.push('/login');
  };

  const sidebarBg = "#ffffff"; // Light blue background
  const activeColor = "#1c7ed6"; // Deeper blue for active items
  const hoverColor = "#e7f5ff"; // Slightly darker blue for hover
  const iconInactiveColor = "#5c7cfa"; // Light blue for inactive icons
  const textColor = "#495057"; // Darker text for better readability

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed top-16 left-0 h-[calc(100vh-4rem)] z-40 border-r border-gray-200 
        transition-all duration-300 ${isExpanded ? 'w-48' : 'w-16'}`}
      style={{
        backgroundColor: sidebarBg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <div className="h-full flex flex-col justify-between py-4">
        {/* Top Section: Menu Items */}
        <Stack gap={4} px={isExpanded ? 'xs' : 4}>
          {menuItems.map((item) => (
            isExpanded ? (
              <NavLink
                key={item.name}
                label={item.name}
                leftSection={
                  <ThemeIcon
                    size="md"
                    variant={pathname === item.route ? "filled" : "light"}
                    color={pathname === item.route ? activeColor : iconInactiveColor}
                    style={{
                      backgroundColor: pathname === item.route ? activeColor : 'transparent'
                    }}
                  >
                    <item.icon size={18} stroke={1.5} color={pathname === item.route ? "#ffffff" : undefined} />
                  </ThemeIcon>
                }
                active={pathname === item.route}
                onClick={() => handleNavigation(item.route)}
                variant={pathname === item.route ? "filled" : "light"}
                color={activeColor}
                styles={(theme) => ({
                  root: {
                    '&[data-active]': {
                      backgroundColor: activeColor
                    },
                    '&:hover': {
                      backgroundColor: hoverColor
                    }
                  },
                  label: {
                    color: pathname === item.route ? "#ffffff" : textColor,
                    fontWeight: pathname === item.route ? 600 : 400
                  }
                })}
              />
            ) : (
              <Tooltip
                key={item.name}
                label={item.name}
                position="right"
                withArrow
                transitionProps={{ transition: "pop", duration: 200 }}
              >
                <NavLink
                  leftSection={
                    <ThemeIcon
                      size="md"
                      variant={pathname === item.route ? "filled" : "light"}
                      color={pathname === item.route ? activeColor : iconInactiveColor}
                      style={{
                        backgroundColor: pathname === item.route ? activeColor : 'transparent'
                      }}
                    >
                      <item.icon size={18} stroke={1.5} color={pathname === item.route ? "#ffffff" : undefined} />
                    </ThemeIcon>
                  }
                  active={pathname === item.route}
                  onClick={() => handleNavigation(item.route)}
                  variant="subtle"
                  styles={(theme) => ({
                    root: {
                      borderRadius: theme.radius.sm,
                      '&[data-active]': {
                        backgroundColor: activeColor
                      },
                      '&:hover': {
                        backgroundColor: hoverColor
                      }
                    }
                  })}
                />
              </Tooltip>
            )
          ))}
        </Stack>

        {/* Bottom Section: Settings & Logout */}
        <Stack gap={4} px={isExpanded ? 'xs' : 4} mb={6}>
          <Divider my="sm" color="#d0ebff" />

          {isExpanded ? (
            <>
              <NavLink
                label="Settings"
                leftSection={
                  <ThemeIcon size="md" variant="light" color={iconInactiveColor}>
                    <IconSettings size={18} stroke={1.5} />
                  </ThemeIcon>
                }
                onClick={() => handleNavigation('/settings')}
                styles={{
                  label: {
                    color: textColor
                  },
                  root: {
                    '&:hover': {
                      backgroundColor: hoverColor
                    }
                  }
                }}
              />

              <NavLink
                label="Logout"
                leftSection={
                  <ThemeIcon size="md" variant="light" color="red">
                    <IconLogout size={18} stroke={1.5} />
                  </ThemeIcon>
                }
                color="red"
                onClick={handleLogout}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: '#ffe5e5'
                    }
                  }
                }}
              />
            </>
          ) : (
            <>
              <Tooltip
                label="Settings"
                position="right"
                withArrow
                transitionProps={{ transition: "pop", duration: 200 }}
              >
                <NavLink
                  leftSection={
                    <ThemeIcon size="md" variant="light" color={iconInactiveColor}>
                      <IconSettings size={18} stroke={1.5} />
                    </ThemeIcon>
                  }
                  onClick={() => handleNavigation('/settings')}
                  variant="subtle"
                  styles={{
                    root: {
                      '&:hover': {
                        backgroundColor: hoverColor
                      }
                    }
                  }}
                />
              </Tooltip>

              <Tooltip
                label="Logout"
                position="right"
                withArrow
                transitionProps={{ transition: "pop", duration: 200 }}
              >
                <NavLink
                  leftSection={
                    <ThemeIcon size="md" variant="light" color="red">
                      <IconLogout size={18} stroke={1.5} />
                    </ThemeIcon>
                  }
                  onClick={handleLogout}
                  variant="subtle"
                  color="red"
                  styles={{
                    root: {
                      '&:hover': {
                        backgroundColor: '#ffe5e5'
                      }
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
