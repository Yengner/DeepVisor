import { getTranslations } from 'next-intl/server';
import { Button } from '@mantine/core';
import type { LoginHealth } from '@/lib/server/clients/load';
import styles from './Clients.module.css';

const LOGIN_TONE = { ok: 'good', expiring: 'warn', signInNeeded: 'bad', unchecked: 'quiet' } as const;

/** The operator's Facebook login, which every synced client borrows. Checked once a day. */
export default async function LoginStatus({ login, locale }: { login: LoginHealth; locale: string }) {
  const t = await getTranslations('clients.login');
  const checked = login.checkedAt
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(login.checkedAt))
    : '';
  const text = login.state === 'ok' ? t('ok', { when: checked })
    : login.state === 'expiring' ? t('expiring', { count: login.daysLeft ?? 0 })
    : login.state === 'signInNeeded' ? t('signInNeeded', { count: login.clients })
    : t('unchecked');
  return (
    <section className={styles.login} data-tone={LOGIN_TONE[login.state]} aria-label={t('label')} {...(login.state === 'signInNeeded' ? { role: 'alert' } : {})}>
      <p><strong>{t('label')}</strong> · {text}</p>
      {(login.state === 'signInNeeded' || login.state === 'expiring') && (
        <Button component="a" href="/integration" size="sm" variant={login.state === 'signInNeeded' ? 'filled' : 'light'}>{t('action')}</Button>
      )}
    </section>
  );
}

export async function generateMetadata() {
  return { title: (await getTranslations('clients'))('title') };
}

