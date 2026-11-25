import { redirect } from 'next/navigation';

// Legacy route: archived calendar reports were removed. Kept as a redirect because saved links may still point here.
export default function Page() {
  redirect('/reports');
}
