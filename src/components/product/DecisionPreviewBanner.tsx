import Link from 'next/link';
import { Alert } from '@mantine/core';

export default function DecisionPreviewBanner({ page }: { page: 'dashboard' | 'decisions' }) {
  return <Alert color="blue" title="Sample decisions · Preview only" mb="md">
    <p>These decisions, checks and recorded changes are fictional. Nothing is saved or executed. {page === 'dashboard' ? 'Account performance, advertising and configured mode still show your connected account.' : 'Review controls are disabled.'}</p>
    <p><Link href="/dashboard?preview=decisions">Preview Dashboard</Link>{' · '}<Link href="/decisions?preview=decisions">Preview Decisions</Link>{' · '}<Link href={`/${page}`}>Exit preview</Link></p>
  </Alert>;
}
