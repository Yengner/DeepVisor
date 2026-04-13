export type NotificationFeedItem = {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: string;
  link?: string | null;
};

export const STATIC_NOTIFICATION_FEED: NotificationFeedItem[] = [
  {
    id: 'notification-performance-brief',
    title: 'Performance brief ready',
    message: 'Your latest report summary is ready with updated winners, weak points, and recommendations.',
    created_at: '2026-04-13T14:20:00.000Z',
    read: false,
    type: 'report',
    link: '/reports',
  },
  {
    id: 'notification-calendar-review',
    title: 'Queued work needs review',
    message: 'DeepVisor prepared new calendar work for approval based on the latest account activity.',
    created_at: '2026-04-13T10:05:00.000Z',
    read: false,
    type: 'calendar',
    link: '/calendar',
  },
  {
    id: 'notification-spend-guardrail',
    title: 'Spend guardrail triggered',
    message: 'One tracked account moved outside its normal spend range and should be reviewed before the next budget push.',
    created_at: '2026-04-12T16:35:00.000Z',
    read: false,
    type: 'guardrail',
    link: '/dashboard',
  },
  {
    id: 'notification-sync-complete',
    title: 'Meta sync completed',
    message: 'Your connected ad account finished syncing and is ready for dashboard and report analysis.',
    created_at: '2026-04-12T12:15:00.000Z',
    read: true,
    type: 'sync',
    link: '/integration',
  },
  {
    id: 'notification-creative-watchlist',
    title: 'Creative watchlist updated',
    message: 'DeepVisor flagged a few ads with stable delivery but weakening engagement so you can review them sooner.',
    created_at: '2026-04-11T17:10:00.000Z',
    read: true,
    type: 'insight',
    link: '/reports',
  },
  {
    id: 'notification-weekly-summary',
    title: 'Weekly summary scheduled',
    message: 'Your workspace is set to receive a weekly performance summary once live notifications are enabled.',
    created_at: '2026-04-10T13:00:00.000Z',
    read: true,
    type: 'system',
    link: '/settings',
  },
  {
    id: 'notification-integration-reminder',
    title: 'Integration reminder',
    message: 'Connect or refresh platform access from Integrations whenever you want the latest ad data and alerts.',
    created_at: '2026-04-09T15:45:00.000Z',
    read: true,
    type: 'workflow',
    link: '/integration',
  },
];

export const STATIC_NOTIFICATION_PREVIEW = STATIC_NOTIFICATION_FEED.slice(0, 3);
