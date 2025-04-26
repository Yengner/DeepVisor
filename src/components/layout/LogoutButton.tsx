// LogoutButton.tsx
'use client';

import React, { useState } from 'react';
import { handleSignOut } from '@/lib/actions/user.actions';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LogoutButton = ({ isExpanded }: any) => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    const { errorMessage } = await handleSignOut();

    if (errorMessage) {
      toast.error(errorMessage)

    } else {
      router.push('/login'); // Redirect after logout
      toast.success("Signed Out!")
    }

    setLoading(false);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center w-full px-4 py-3 rounded-lg text-gray-700 hover:bg-red-200 transition-colors"
    >
      <div className="w-6 h-6 flex-shrink-0">
        <ArrowRightStartOnRectangleIcon />
      </div>
      <span
        className={`ml-4 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'
          }`}
      >
        {loading ? 'Logging Out...' : 'Logout'}
      </span>
    </button>
  );
};

export default LogoutButton;
