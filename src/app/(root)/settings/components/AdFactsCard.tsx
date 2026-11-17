'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Badge, Button, Checkbox, Chip, Group, NumberInput, Stack, Text, Textarea } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { amountToMinor, minorToAmount, CLIENT_LANGUAGES, FACT_KEYS, WEEKDAYS, type FactKey, type ResolvedFacts } from '@/lib/shared/agent/facts';
import { clearAdFactAction, saveAdFactAction } from '../adFactsActions';
import { useFactText } from './useFactText';

type Props = { facts: ResolvedFacts; accountCurrency: string | null; canEdit: boolean; keys?: readonly FactKey[] };

/** What DeepVisor knows about how this business advertises, and where each answer came from. */
export default function AdFactsCard({ facts, accountCurrency, canEdit, keys = FACT_KEYS }: Props) {
  return (
    <Stack gap="xs">
      {keys.map(key => <FactRow key={key} factKey={key} facts={facts} accountCurrency={accountCurrency} canEdit={canEdit} />)}
    </Stack>
  );
}

function FactRow({ factKey, facts, accountCurrency, canEdit }: { factKey: FactKey } & Props) {
  const t = useTranslations('facts');
  const text = useFactText();
  const fact = facts[factKey];
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const needsAnswer = fact.source === null || (fact.source === 'owner' && fact.stale);
  const moneyKey = factKey === 'daily_budget' || factKey === 'monthly_ceiling';
  const unavailable = moneyKey && !accountCurrency;

  const run = (action: () => Promise<{ success: boolean; error?: { userMessage?: string } }>) => start(async () => {
    setError(null);
    const result = await action();
    if (!result.success) { setError(result.error?.userMessage ?? t('error.retry')); return; }
    setEditing(false);
    router.refresh();
  });

  return (
    <div style={{ borderTop: '1px solid var(--dv-card-border)', paddingTop: 10 }}>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <Text fw={700} size="sm">{t(`keys.${factKey}.label`)}</Text>
          <Text size="sm">{fact.source ? text.value(factKey, fact.value) : <Text span c="dimmed" size="sm">{t(`keys.${factKey}.question`)}</Text>}</Text>
          {fact.source && <Text size="xs" c="dimmed">{text.source(fact)}</Text>}
        </div>
        <Group gap={6}>
          {needsAnswer && <Badge variant="light" color="gray">{fact.source === null ? t('badge.notAnswered') : t('badge.checkThis')}</Badge>}
          {canEdit && !editing && fact.source === 'history' && (
            <Button size="xs" variant="light" loading={pending} onClick={() => run(() => saveAdFactAction(factKey, fact.value))}>{t('action.keep')}</Button>
          )}
          {canEdit && !editing && (
            <Button size="xs" variant="subtle" disabled={unavailable} onClick={() => setEditing(true)}>{fact.source ? t('action.change') : t('action.answer')}</Button>
          )}
        </Group>
      </Group>
      {unavailable && <Text size="xs" c="dimmed">{t('noCurrency')}</Text>}
      {editing && (
        <FactEditor factKey={factKey} facts={facts} accountCurrency={accountCurrency} pending={pending}
          onCancel={() => { setEditing(false); setError(null); }}
          onSave={value => run(() => saveAdFactAction(factKey, value))}
          onClear={fact.source === 'owner' || (fact.source === 'history' && fact.owner) ? () => run(() => clearAdFactAction(factKey)) : null}
          onInvalid={setError} />
      )}
      {error && <Alert color="red" variant="light" mt={6} role="alert">{error}</Alert>}
    </div>
  );
}

function FactEditor({ factKey, facts, accountCurrency, pending, onCancel, onSave, onClear, onInvalid }: {
  factKey: FactKey; facts: ResolvedFacts; accountCurrency: string | null; pending: boolean;
  onCancel: () => void; onSave: (value: unknown) => void; onClear: (() => void) | null; onInvalid: (message: string) => void;
}) {
  const t = useTranslations();
  const fact = facts[factKey];
  const current = fact.source ? (fact.value as Record<string, unknown>) : null;
  const [amount, setAmount] = useState<number | string>(
    current && typeof current.amountMinor === 'number' && typeof current.currency === 'string' ? minorToAmount(current.amountMinor, current.currency) : '');
  const [days, setDays] = useState<number | string>(typeof current?.days === 'number' ? current.days : '');
  const [greeting, setGreeting] = useState(typeof current?.text === 'string' ? current.text : '');
  const [languages, setLanguages] = useState<string[]>(Array.isArray(current?.languages) ? current.languages as string[] : []);
  const [weekdays, setWeekdays] = useState<string[]>(Array.isArray(current?.days) ? current.days as string[] : []);
  const question = t(`facts.keys.${factKey}.question`);

  const submit = () => {
    if (factKey === 'daily_budget' || factKey === 'monthly_ceiling') {
      const minor = accountCurrency ? amountToMinor(Number(amount), accountCurrency) : null;
      if (minor === null) return onInvalid(t('facts.invalidAmount'));
      return onSave({ amountMinor: minor, currency: accountCurrency });
    }
    if (factKey === 'run_days') return onSave({ days: Number(days) });
    if (factKey === 'whatsapp_greeting') return onSave({ text: greeting });
    if (factKey === 'client_languages') return onSave({ languages });
    return onSave({ days: weekdays });
  };

  return (
    <Stack gap="xs" mt="xs">
      <Text size="xs" c="dimmed">{t(`facts.keys.${factKey}.help`)}</Text>
      {(factKey === 'daily_budget' || factKey === 'monthly_ceiling') && (
        <NumberInput label={question} prefix={accountCurrency === 'USD' ? '$' : undefined}
          suffix={accountCurrency && accountCurrency !== 'USD' ? ` ${accountCurrency}` : undefined}
          min={0} decimalScale={2} value={amount} onChange={setAmount} inputMode="decimal" />
      )}
      {factKey === 'run_days' && <NumberInput label={question} min={1} max={90} allowDecimal={false} value={days} onChange={setDays} suffix={t('facts.daysSuffix')} />}
      {factKey === 'whatsapp_greeting' && (
        <Textarea label={question} placeholder={t('facts.greetingPlaceholder')} autosize minRows={2} maxLength={300}
          value={greeting} onChange={e => setGreeting(e.currentTarget.value)} description={`${greeting.length}/300`} />
      )}
      {factKey === 'client_languages' && (
        <Checkbox.Group label={question} value={languages} onChange={setLanguages}>
          <Group mt={4}>{CLIENT_LANGUAGES.map(l => <Checkbox key={l} value={l} label={t(`languages.${l}`)} />)}</Group>
        </Checkbox.Group>
      )}
      {factKey === 'slow_days' && (
        <div>
          <Text size="sm" fw={500} mb={4}>{question}</Text>
          <Chip.Group multiple value={weekdays} onChange={setWeekdays}>
            <Group gap={6}>{WEEKDAYS.map(d => <Chip key={d} value={d} size="sm">{t(`days.${d}`)}</Chip>)}</Group>
          </Chip.Group>
          <Text size="xs" c="dimmed" mt={4}>{t('facts.slowDaysHint')}</Text>
        </div>
      )}
      <Group gap="xs">
        <Button size="sm" leftSection={<IconCheck size={16} />} loading={pending} onClick={submit}>{t('facts.action.save')}</Button>
        <Button size="sm" variant="default" onClick={onCancel} disabled={pending}>{t('facts.action.cancel')}</Button>
        {onClear && <Button size="sm" variant="subtle" color="gray" onClick={onClear} disabled={pending}>{t('facts.action.forget')}</Button>}
      </Group>
    </Stack>
  );
}
