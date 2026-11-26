export type NotificationFeedItem = {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: string;
  link?: string | null;
  /** The business it belongs to; opening it switches there first. */
  business_id?: string;
  /**
   * Set on the daily advertising-update bell row. The saved `title`/`message` are English, so
   * screens word these rows from the bundle instead (see `dailyNotificationKeys`).
   */
  daily?: { count: number; urgent: boolean };
};

/** Catalog keys (under `notificationText`) for a daily advertising-update row, or null for any other row. */
export function dailyNotificationKeys(item: Pick<NotificationFeedItem, 'daily'>) {
  if (!item.daily) return null;
  const { count, urgent } = item.daily;
  const many = count > 1;
  return {
    count,
    title: many ? ('dailyTitleMany' as const) : ('dailyTitleOne' as const),
    message: urgent
      ? many ? ('urgentMany' as const) : ('urgentOne' as const)
      : many ? ('calmMany' as const) : ('calmOne' as const),
  };
}

export function formatNotificationPreviewMessage(message: string): string {
  const normalized = message.trim().replace(/\s+/g, ' ');
  const reviewMatch =
    normalized.match(/found\s+(\d+)\s+campaign review item/i) ??
    normalized.match(/campaign review.*found\s+(\d+)\s+item/i);

  if (reviewMatch) {
    const count = Number(reviewMatch[1]);
    return `DeepVisor finished the campaign review. ${count} item${count === 1 ? '' : 's'} need review.`;
  }

  if (/deepvisor finished the campaign review/i.test(normalized)) {
    if (/no critical|did not find/i.test(normalized)) {
      return 'DeepVisor finished the campaign review. No critical issues found.';
    }

    return 'DeepVisor finished the campaign review.';
  }

  return normalized.length > 112 ? `${normalized.slice(0, 109)}...` : normalized;
}
