'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  HomeIcon,
  ChartBarIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
  PresentationChartLineIcon,
  Cog6ToothIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import LogoutButton from '../LogoutButton';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { name: 'Home', icon: <HomeIcon className="w-6 h-6" />, route: '/dashboard/platforms' },
    { name: 'Reports', icon: <ChartBarIcon className="w-6 h-6" />, route: '/reports' },
    { name: 'Upload', icon: <ArrowUpTrayIcon className="w-6 h-6" />, route: '/upload' },
    { name: 'Integration', icon: <PuzzlePieceIcon className="w-6 h-6" />, route: '/integration' },
    { name: 'Explore', icon: <RocketLaunchIcon className="w-6 h-6" />, route: '/explore' },
    { name: 'Campaigns', icon: <PresentationChartLineIcon className="w-6 h-6" />, route: '/campaigns' },
  ];

  const handleNavigation = (route: string) => {
    router.push(route);
  };

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className="fixed top-16 left-0 h-[calc(100vh-4rem)] z-40 bg-gray-100 border-r border-gray-300 transition-all duration-300"
    >
      <div
        className={`h-full transform transition-transform duration-1000 ease-in-out ${isExpanded ? 'scale-x-100 w-64' : 'scale-x-100 w-16'
          } overflow-hidden origin-left`}
      >
        {/* Menu Items */}
        <div className="flex flex-col justify-between h-full">
          {/* Top Section: Menu Items */}
          <div className="mt-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.route)}
                className={`flex items-center w-full px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors ${pathname === item.route ? 'bg-blue-100 text-blue-700' : ''
                  }`}
              >
                <div className="w-6 h-6 flex-shrink-0">{item.icon}</div>
                <span
                  className={`ml-4 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'
                    }`}
                >
                  {item.name}
                </span>
              </button>
            ))}
          </div>

          {/* Bottom Section: Settings */}

          <div className="mb-4">

            <button
              onClick={() => handleNavigation('/settings')}
              className="flex items-center w-full px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <div className="w-6 h-6 flex-shrink-0">
                <Cog6ToothIcon />
              </div>
              <span
                className={`ml-4 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'
                  }`}
              >
                Settings
              </span>
            </button>
            <div className='mt-5'>

              <LogoutButton isExpanded={isExpanded} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
