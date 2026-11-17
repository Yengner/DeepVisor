'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Checkbox, Chip, Group, NumberInput, Stack, Text, Textarea } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { amountToMinor, minorToAmount, CLIENT_LANGUAGES, FACT_KEYS, WEEKDAYS, type FactKey, type ResolvedFacts } from '@/lib/shared/agent/facts';
import { DAY_LABELS, FACT_COPY, LANGUAGE_LABELS, factSource, formatFactValue } from '@/lib/shared/agent/factCopy';
import { clearAdFactAction, saveAdFactAction } from '../adFactsActions';

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
  const fact = facts[factKey];
  const copy = FACT_COPY[factKey];
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
    if (!result.success) { setError(result.error?.userMessage ?? 'Please try again.'); return; }
    setEditing(false);
    router.refresh();
  });

  return (
    <div style={{ borderTop: '1px solid var(--dv-card-border)', paddingTop: 10 }}>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <Text fw={700} size="sm">{copy.label}</Text>
          <Text size="sm">{fact.source ? formatFactValue(factKey, fact.value) : <Text span c="dimmed" size="sm">{copy.question}</Text>}</Text>
          {fact.source && <Text size="xs" c="dimmed">{factSource(fact)}</Text>}
        </div>
        <Group gap={6}>
          {needsAnswer && <Badge variant="light" color="gray">{fact.source === null ? 'Not answered' : 'Check this'}</Badge>}
          {canEdit && !editing && fact.source === 'history' && (
            <Button size="xs" variant="light" loading={pending} onClick={() => run(() => saveAdFactAction(factKey, fact.value))}>Keep this</Button>
          )}
          {canEdit && !editing && (
            <Button size="xs" variant="subtle" disabled={unavailable} onClick={() => setEditing(true)}>{fact.source ? 'Change' : 'Answer'}</Button>
          )}
        </Group>
      </Group>
      {unavailable && <Text size="xs" c="dimmed">Connect an ad account with a known currency to set this.</Text>}
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
  const fact = facts[factKey];
  const current = fact.source ? (fact.value as Record<string, unknown>) : null;
  const [amount, setAmount] = useState<number | string>(
    current && typeof current.amountMinor === 'number' && typeof current.currency === 'string' ? minorToAmount(current.amountMinor, current.currency) : '');
  const [days, setDays] = useState<number | string>(typeof current?.days === 'number' ? current.days : '');
  const [text, setText] = useState(typeof current?.text === 'string' ? current.text : '');
  const [languages, setLanguages] = useState<string[]>(Array.isArray(current?.languages) ? current.languages as string[] : []);
  const [weekdays, setWeekdays] = useState<string[]>(Array.isArray(current?.days) ? current.days as string[] : []);

  const submit = () => {
    if (factKey === 'daily_budget' || factKey === 'monthly_ceiling') {
      const minor = accountCurrency ? amountToMinor(Number(amount), accountCurrency) : null;
      if (minor === null) return onInvalid('Enter an amount like 20 or 20.50.');
      return onSave({ amountMinor: minor, currency: accountCurrency });
    }
    if (factKey === 'run_days') return onSave({ days: Number(days) });
    if (factKey === 'whatsapp_greeting') return onSave({ text });
    if (factKey === 'client_languages') return onSave({ languages });
    return onSave({ days: weekdays });
  };

  return (
    <Stack gap="xs" mt="xs">
      <Text size="xs" c="dimmed">{FACT_COPY[factKey].help}</Text>
      {(factKey === 'daily_budget' || factKey === 'monthly_ceiling') && (
        <NumberInput label={FACT_COPY[factKey].question} prefix={accountCurrency === 'USD' ? '$' : undefined}
          suffix={accountCurrency && accountCurrency !== 'USD' ? ` ${accountCurrency}` : undefined}
          min={0} decimalScale={2} value={amount} onChange={setAmount} inputMode="decimal" />
      )}
      {factKey === 'run_days' && <NumberInput label={FACT_COPY[factKey].question} min={1} max={90} allowDecimal={false} value={days} onChange={setDays} suffix=" days" />}
      {factKey === 'whatsapp_greeting' && (
        <Textarea label={FACT_COPY[factKey].question} placeholder="Hola, quiero hacer una cita" autosize minRows={2} maxLength={300}
          value={text} onChange={e => setText(e.currentTarget.value)} description={`${text.length}/300`} />
      )}
      {factKey === 'client_languages' && (
        <Checkbox.Group label={FACT_COPY[factKey].question} value={languages} onChange={setLanguages}>
          <Group mt={4}>{CLIENT_LANGUAGES.map(l => <Checkbox key={l} value={l} label={LANGUAGE_LABELS[l]} />)}</Group>
        </Checkbox.Group>
      )}
      {factKey === 'slow_days' && (
        <div>
          <Text size="sm" fw={500} mb={4}>{FACT_COPY[factKey].question}</Text>
          <Chip.Group multiple value={weekdays} onChange={setWeekdays}>
            <Group gap={6}>{WEEKDAYS.map(d => <Chip key={d} value={d} size="sm">{DAY_LABELS[d]}</Chip>)}</Group>
          </Chip.Group>
          <Text size="xs" c="dimmed" mt={4}>Leave all unselected if no day is slower than the others.</Text>
        </div>
      )}
      <Group gap="xs">
        <Button size="sm" leftSection={<IconCheck size={16} />} loading={pending} onClick={submit}>Save</Button>
        <Button size="sm" variant="default" onClick={onCancel} disabled={pending}>Cancel</Button>
        {onClear && <Button size="sm" variant="subtle" color="gray" onClick={onClear} disabled={pending}>Forget my answer</Button>}
      </Group>
    </Stack>
  );
}
