'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function AutonomyChrome({ children }: { children: ReactNode }) {
  return usePathname() === '/dashboard' ? null : children;
}
