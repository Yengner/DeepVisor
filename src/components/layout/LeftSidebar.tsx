'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tooltip } from '@mantine/core';
import { IconLogout, IconSettings } from '@tabler/icons-react';
import { clientHandleSignOut } from '@/lib/client';
import { isAppNavItemActive, primaryNavItems } from './navigation';

type RailItemProps = {
  active: boolean;
  expanded: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
};

function RailItem({
  active,
  expanded,
  icon,
  label,
  onClick,
  tone = 'default',
}: RailItemProps) {
  const control = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className={`group relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-md border px-3 text-sm font-bold transition-colors ${
        active
          ? 'border-[#d7ff8a] bg-[#c8ff56] text-[#151714]'
          : tone === 'danger'
            ? 'border-transparent text-[#e98b83] hover:border-[#49302e] hover:bg-[#251b1a]'
            : 'border-transparent text-[#aab2a7] hover:border-[#30352f] hover:bg-[#242823] hover:text-white'
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span
        className={`whitespace-nowrap transition-opacity duration-150 ${
          expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {label}
      </span>
    </button>
  );

  if (expanded) {
    return control;
  }

  return (
    <Tooltip label={label} position="right" withArrow openDelay={220}>
      {control}
    </Tooltip>
  );
}

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed bottom-0 left-0 top-16 z-40 hidden overflow-hidden border-r border-[#292d28] bg-[#0d0f0d] transition-[width] duration-200 md:block ${
        isExpanded ? 'w-[13.5rem]' : 'w-[3.75rem]'
      }`}
      aria-label="Workspace navigation"
    >
      <div className="flex h-full flex-col justify-between px-2 py-4">
        <nav className="space-y-1.5">
          {primaryNavItems.map((item) => {
            const active = isAppNavItemActive(pathname, item.route);
            return (
              <RailItem
                key={item.route}
                active={active}
                expanded={isExpanded}
                icon={<item.icon size={19} stroke={active ? 2.25 : 1.8} />}
                label={item.name}
                onClick={() => router.push(item.route)}
              />
            );
          })}
        </nav>

        <div className="space-y-1.5 border-t border-[#292d28] pt-3">
          <RailItem
            active={isAppNavItemActive(pathname, '/settings')}
            expanded={isExpanded}
            icon={<IconSettings size={19} stroke={1.8} />}
            label="Settings"
            onClick={() => router.push('/settings')}
          />
          <RailItem
            active={false}
            expanded={isExpanded}
            icon={<IconLogout size={19} stroke={1.8} />}
            label="Log out"
            tone="danger"
            onClick={() => void clientHandleSignOut()}
          />
        </div>
      </div>
    </aside>
  );
}
