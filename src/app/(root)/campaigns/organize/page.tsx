import { redirect } from 'next/navigation';

// Legacy route: the account organizer is no longer part of the product UI.
export default function Page() {
  redirect('/campaigns');
}
