import { redirect } from 'next/navigation';

// Legacy route: the campaign status screen was removed. Kept as a redirect because saved links may still point here.
export default function Page() {
  redirect('/campaigns');
}
