'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@mantine/core';
import type { LeadView } from '@/lib/server/leads/service';
import type { LeadOutcome } from '@/lib/shared/leads/summary';
import { setLeadOutcomeAction } from './actions';
import classes from './Leads.module.css';

const OUTCOMES: LeadOutcome[] = ['booked', 'not_booked', 'spam'];

/** Recent leads with one-tap outcome marking. Tapping the current outcome clears it. */
export default function LeadList({ leads, timezone, canEdit }: { leads: LeadView[]; timezone: string; canEdit: boolean }) {
  const t = useTranslations('leads');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  if (!leads.length) return <p className={classes.muted}>{t('empty')}</p>;

  const when = new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone });
  const duration = (minutes: number) => minutes < 60 ? t('minutes', { minutes }) : t('hours', { hours: Math.round(minutes / 60) });
  const mark = (lead: LeadView, outcome: LeadOutcome) => {
    setError(null);
    setPendingId(lead.id);
    start(async () => {
      const result = await setLeadOutcomeAction(lead.id, lead.outcome === outcome ? null : outcome);
      setPendingId(null);
      if (!result.success) { setError(result.error?.userMessage ?? t('error.failed')); return; }
      router.refresh();
    });
  };

  return (
    <>
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
      <ul className={classes.list}>
        {leads.map(lead => {
          const who = lead.channel === 'call' ? t('call') : `${lead.name ?? t('customer')}${lead.last4 ? ` ••${lead.last4}` : ''}`;
          const from = lead.source === 'ad' ? lead.adName ?? t('adUnknown', { id: lead.adExternalId ?? '' }) : lead.channel === 'whatsapp' ? t('notFromAd') : null;
          return (
            <li key={lead.id} className={classes.lead} data-outcome={lead.outcome ?? undefined}>
              <div className={classes.leadMain}>
                <strong>{who}</strong>
                <span className={classes.muted}>
                  {[from, when.format(new Date(lead.firstMessageAt)),
                    lead.channel === 'whatsapp' ? (lead.replyMinutes === null ? t('notReplied') : t('repliedIn', { time: duration(lead.replyMinutes) })) : null,
                    lead.channel === 'whatsapp' ? t('messages', { count: lead.messagesIn }) : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
              {canEdit ? (
                <div className={classes.outcomes} role="group" aria-label={`${t('outcome.label')}: ${who}`}>
                  {OUTCOMES.map(outcome => (
                    <button key={outcome} type="button" data-kind={outcome} aria-pressed={lead.outcome === outcome}
                      disabled={pendingId === lead.id} onClick={() => mark(lead, outcome)}>
                      {t(`outcome.${outcome}`)}
                    </button>
                  ))}
                </div>
              ) : lead.outcome && <span className={classes.badge}>{t(`outcome.${lead.outcome}`)}</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
