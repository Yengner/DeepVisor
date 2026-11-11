'use client';
import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { deepVisorTheme } from '@/theme';

/**
 * Client boundary for the Mantine theme. The theme contains functions (component `vars`
 * resolvers), which cannot be passed from a Server Component as props.
 */
export default function AppMantineProvider({ children }: { children: ReactNode }) {
  return <MantineProvider theme={deepVisorTheme} defaultColorScheme="light">{children}</MantineProvider>;
}
