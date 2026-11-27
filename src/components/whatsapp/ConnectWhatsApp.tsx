'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Button } from '@mantine/core';
import { connectWhatsAppAction } from './actions';
import classes from './Leads.module.css';

type LoginResponse = { authResponse?: { code?: string } | null };
type FacebookSdk = {
  init(options: Record<string, unknown>): void;
  login(callback: (response: LoginResponse) => void, options: Record<string, unknown>): void;
};
declare global { interface Window { FB?: FacebookSdk; fbAsyncInit?: () => void } }

type Session = { phoneNumberId: string | null; wabaId: string };
const FINISH_EVENTS = new Set(['FINISH', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING']);
const isId = (value: unknown): value is string => typeof value === 'string' && /^\d{1,30}$/.test(value);

/**
 * Embedded Signup v4 with WhatsApp Business app onboarding: the owner keeps using the app on
 * their phone. Meta returns the ids through a window message and a 30-second code through the
 * login callback; both go straight to the server action, which checks them with Meta.
 */
export default function ConnectWhatsApp({ appId, configId }: { appId: string; configId: string }) {
  const t = useTranslations('leads.connect');
  const router = useRouter();
  const session = useRef<Session | null>(null);
  const code = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const finish = () => {
    const ids = session.current, value = code.current;
    if (!ids || !value) return;
    session.current = null; code.current = null;
    start(async () => {
      const result = await connectWhatsAppAction({ code: value, ...ids });
      if (!result.success) { setError(result.error?.userMessage ?? t('error.failed')); return; }
      setNotice(result.data?.synced ? t('done') : t('doneSyncPending'));
      router.refresh();
    });
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      let data: { type?: unknown; event?: unknown; data?: Record<string, unknown> };
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (typeof data.event === 'string' && FINISH_EVENTS.has(data.event) && isId(data.data?.waba_id)) {
        // The app-number finish event may carry only the account id; the server then finds the number.
        session.current = { phoneNumberId: isId(data.data.phone_number_id) ? data.data.phone_number_id : null, wabaId: data.data.waba_id };
        finish();
      } else if (data.event === 'CANCEL' || data.event === 'ERROR') {
        setOpen(false);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // finish only reads refs and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const launch = () => {
    if (!window.FB) return;
    setNotice(null);
    // Meta refuses FB.login on http pages (including localhost) and never calls back.
    if (window.location.protocol !== 'https:') { setError(t('error.https')); return; }
    setError(null); setOpen(true);
    window.FB.login(response => {
      setOpen(false);
      const value = response.authResponse?.code;
      if (!value) return;
      code.current = value;
      finish();
    }, {
      config_id: configId, response_type: 'code', override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
    });
  };

  return (
    <section className={classes.card} aria-labelledby="leads-connect">
      <Script id="facebook-sdk" src="https://connect.facebook.net/en_US/sdk.js" strategy="lazyOnload" crossOrigin="anonymous"
        onReady={() => {
          window.FB?.init({ appId, autoLogAppEvents: false, xfbml: false, version: 'v24.0' });
          setReady(Boolean(window.FB));
        }} />
      <h2 id="leads-connect">{t('title')}</h2>
      <p>{t('body')}</p>
      <ul className={classes.connectNotes}>
        <li>{t('noteKeepApp')}</li>
        <li>{t('noteQr')}</li>
        <li>{t('notePrivacy')}</li>
      </ul>
      <div className={classes.callRow}>
        <Button onClick={launch} loading={pending || open} disabled={!ready}>{t('button')}</Button>
      </div>
      {notice && <Alert color="green" variant="light" role="status">{notice}</Alert>}
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
    </section>
  );
}
