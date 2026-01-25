import Advertisement from '@/components/public/blog/Advertisement';
import React from 'react';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Blog Header */}
      <header className="bg-white shadow-sm rounded-lg p-6 mb-6">
        <h1 className="text-4xl font-bold text-gray-800">Blog</h1>
        <p className="text-sm text-gray-600">Insights, tips, and strategies for business growth.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Blog Content */}
        <main className="col-span-3 bg-white shadow-sm rounded-lg p-6">
          {children}
        </main>

        {/* Sidebar for Ads or Additional Content */}
        <aside className="col-span-1 space-y-6">
          <Advertisement />
          <Advertisement />
        </aside>
      </div>
    </div>
  );
}
