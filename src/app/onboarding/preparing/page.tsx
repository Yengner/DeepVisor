import { redirect } from 'next/navigation';

// Legacy route: first-sync progress now shows on the Overview. Kept as a redirect because
// saved links may still point here.
export default function Page() {
  redirect('/dashboard');
}
