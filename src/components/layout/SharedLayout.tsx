'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const SharedLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen">
      {/* TopBar */}
      <header className="bg-emerald-700 text-white py-4 px-8 shadow-md">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">DeepVisor</h1>
          <nav className="flex gap-6">
            <button
              onClick={() => router.push('/')}
              className="text-white hover:underline"
            >
              Home
            </button>
            <button
              onClick={() => router.push('/help')}
              className="text-white hover:underline"
            >
              Help
            </button>
            <button
              onClick={() => router.push('/blog')}
              className="text-white hover:underline"
            >
              Blog
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto p-6 bg-gray-100">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6">
        <div className="max-w-7xl mx-auto text-center">
          <p>&copy; {new Date().getFullYear()} DeepVisor. All rights reserved.</p>
          <nav className="flex justify-center gap-4 mt-2">
            <a href="/privacy-policy" className="hover:underline">
              Privacy Policy
            </a>
            <a href="/terms-of-service" className="hover:underline">
              Terms of Service
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default SharedLayout;
