import { redirect } from 'next/navigation';

// Legacy route: calendar campaign reviews were removed. Kept as a redirect because saved links may still point here.
export default function Page() {
  redirect('/campaigns');
}
