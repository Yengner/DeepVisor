import { describe, expect, it } from 'vitest';
import { notificationTextKeys, readHealthNotice } from './notifications';

describe('readHealthNotice', () => {
  it('reads saved alerts', () => {
    expect(readHealthNotice({ surface: 'bell', health: { kind: 'signInNeeded', clients: 2 } })).toEqual({ kind: 'signInNeeded', clients: 2 });
    expect(readHealthNotice({ health: { kind: 'signInExpiring', days: 3.7 } })).toEqual({ kind: 'signInExpiring', days: 3 });
    expect(readHealthNotice({ health: { kind: 'refreshFailed', account: 'Salon' } })).toEqual({ kind: 'refreshFailed', account: 'Salon' });
  });
  it('ignores other rows and bad values', () => {
    expect(readHealthNotice({ surface: 'bell' })).toBeUndefined();
    expect(readHealthNotice({ health: { kind: 'other' } })).toBeUndefined();
    expect(readHealthNotice(null)).toBeUndefined();
    expect(readHealthNotice({ health: { kind: 'signInNeeded', clients: -4 } })).toEqual({ kind: 'signInNeeded', clients: 0 });
  });
});

describe('notificationTextKeys', () => {
  it('words a broken shared login with the client count', () => {
    expect(notificationTextKeys({ health: { kind: 'signInNeeded', clients: 3 } }))
      .toEqual({ title: 'signInNeededTitle', message: 'signInNeededShared', values: { count: 3 } });
    expect(notificationTextKeys({ health: { kind: 'signInNeeded', clients: 0 } })?.message).toBe('signInNeededOwn');
  });
  it('keeps the daily update wording', () => {
    expect(notificationTextKeys({ daily: { count: 2, urgent: true } }))
      .toEqual({ title: 'dailyTitleMany', message: 'urgentMany', values: { count: 2 } });
  });
  it('leaves other rows to their saved text', () => expect(notificationTextKeys({})).toBeNull());
});
