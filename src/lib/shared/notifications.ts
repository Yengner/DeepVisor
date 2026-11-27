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
  /** Set on connection and refresh alerts; worded from these values, like `daily`. */
  health?: HealthNotice;
};

/**
 * Connection and refresh alerts (`server/notifications/health.ts`).
 * - `signInNeeded`: Meta rejected the saved login; `clients` = client businesses using it.
 * - `signInExpiring`: the login expires in `days` days.
 * - `refreshFailed`: an automatic refresh of `account` failed.
 */
export type HealthNotice =
  | { kind: 'signInNeeded'; clients: number }
  | { kind: 'signInExpiring'; days: number }
  | { kind: 'refreshFailed'; account: string };

type DailyKeys = NonNullable<ReturnType<typeof dailyNotificationKeys>>;
type HealthTextKeys = {
  title: 'signInNeededTitle' | 'signInExpiringTitle' | 'refreshFailedTitle';
  message: 'signInNeededShared' | 'signInNeededOwn' | 'signInExpiringMessage' | 'refreshFailedMessage';
  values: Record<string, string | number>;
};
type NotificationTextKeys = {
  title: DailyKeys['title'] | HealthTextKeys['title'];
  message: DailyKeys['message'] | HealthTextKeys['message'];
  values: Record<string, string | number>;
};

/** Reads a `health` payload saved on a notification row, or undefined when it isn't one. */
export function readHealthNotice(payload: unknown): HealthNotice | undefined {
  const health = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).health : null;
  if (!health || typeof health !== 'object') return undefined;
  const value = health as Record<string, unknown>;
  const count = (key: string) => (typeof value[key] === 'number' && Number.isFinite(value[key]) ? Math.max(0, Math.floor(value[key] as number)) : 0);
  if (value.kind === 'signInNeeded') return { kind: 'signInNeeded', clients: count('clients') };
  if (value.kind === 'signInExpiring') return { kind: 'signInExpiring', days: count('days') };
  if (value.kind === 'refreshFailed') return { kind: 'refreshFailed', account: typeof value.account === 'string' ? value.account : '' };
  return undefined;
}

/**
 * Catalog keys (under `notificationText`) and values for rows that are worded on screen in the
 * reader's language, or null for rows that show their saved English text.
 */
export function notificationTextKeys(item: Pick<NotificationFeedItem, 'daily' | 'health'>): NotificationTextKeys | null {
  const daily = dailyNotificationKeys(item);
  if (daily) return { title: daily.title, message: daily.message, values: { count: daily.count } };
  return item.health ? healthNotificationKeys(item.health) : null;
}

/** Catalog keys (under `notificationText`) and values for a connection or refresh alert. */
export function healthNotificationKeys(health: HealthNotice): HealthTextKeys {
  if (health.kind === 'signInNeeded') {
    return {
      title: 'signInNeededTitle' as const,
      message: health.clients > 0 ? ('signInNeededShared' as const) : ('signInNeededOwn' as const),
      values: { count: health.clients },
    };
  }
  if (health.kind === 'signInExpiring') {
    return { title: 'signInExpiringTitle' as const, message: 'signInExpiringMessage' as const, values: { count: health.days } };
  }
  return { title: 'refreshFailedTitle' as const, message: 'refreshFailedMessage' as const, values: { account: health.account || '—' } };
}

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
