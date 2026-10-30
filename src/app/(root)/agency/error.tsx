'use client';
import Link from 'next/link';
import { Alert, Button, Stack } from '@mantine/core';
export default function AgencyError({ reset }: { reset: () => void }) {
  return <Stack p="xl"><Alert color="red" title="Agency intelligence is unavailable">Your account or saved data could not be loaded. No advertising change was requested.</Alert><Button onClick={reset}>Try again</Button><Link href="/integration">Manage connections</Link></Stack>;
}
