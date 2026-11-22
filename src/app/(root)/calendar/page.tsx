import { redirect } from 'next/navigation';

// Legacy route: the old calendar/queue screen was replaced by Campaigns and the
// Insights popup. Kept as a redirect because stored notification links and
// bookmarks may still point here.
export default function Page() {
  redirect('/campaigns');
}
