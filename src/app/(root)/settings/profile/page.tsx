import { redirect } from 'next/navigation';

/** Profile now lives inside Settings. Old links and bookmarks land on that section. */
export default function ProfilePage() {
  redirect('/settings#profile');
}
