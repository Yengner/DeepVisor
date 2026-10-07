'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { IconCheck, IconX, IconShieldCheck, IconBulb } from '@tabler/icons-react';
import type { DecisionCard } from '@/lib/server/decisions/surface';
import { reviewDecisionAction } from './actions';
import classes from './Decisions.module.css';

function ReviewButtons({ id, fingerprint }: { id: string; fingerprint: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = (choice: 'approve' | 'reject') => startTransition(async () => {
    setError(null);
    try {
      const result = await reviewDecisionAction(id, choice, fingerprint);
      if (result.error) setError(result.error); else router.refresh();
    } catch { setError('Unable to save your review. Please try again.'); }
  });
  return <Stack gap="xs"><Group gap="xs">
    <Button size="xs" leftSection={<IconCheck size={16} />} disabled={pending} onClick={() => submit('approve')}>Approve</Button>
    <Button size="xs" variant="default" leftSection={<IconX size={16} />} disabled={pending} onClick={() => submit('reject')}>Reject</Button>
  </Group><Text size="xs" c="dimmed">Approval saves your choice. It does not change your ads.</Text>
    {error && <Alert color="red" role="alert">{error}</Alert>}
  </Stack>;
}

const statusColor = (status: string) => status === 'Needs approval' ? 'yellow'
  : ['Blocked', 'Rejected', 'Execution failed'].includes(status) ? 'red'
    : status === 'Executed' || status.startsWith('Approved') ? 'green' : 'gray';

export default function DecisionsFeed({ cards, canReview }: { cards: DecisionCard[]; canReview: boolean }) {
  if (!cards.length) return <div className={classes.empty}><IconShieldCheck size={28} aria-hidden />
    <Text fw={700} mt="sm">No decisions yet</Text><Text c="dimmed" size="sm" mt={4}>Your saved ad reviews and recommended next steps will appear here.</Text></div>;
  return <Stack gap="md">{cards.map((card) => <article className={classes.card} key={card.id}>
    <div className={classes.heading}><div><Text size="sm" fw={600} c="dimmed">{card.entity}</Text><h2>{card.title}</h2></div>
      <Text size="xs" c="dimmed">{new Date(card.createdAt).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} UTC</Text></div>
    <Text size="xs" c="dimmed" mb="sm">{card.account} · {card.provider}</Text>
    <Text size="sm">{card.explanation}</Text>
    <Group gap="xs" mt="sm">{card.confidence !== null && <Badge variant="light" color="blue">{Math.round(card.confidence * 100)}% confidence</Badge>}
      {card.probability !== null && <Text size="xs" c="dimmed">Decision probability: {Math.round(card.probability * 100)}%</Text>}
      {!card.proposals.length && <Badge variant="light" color="gray">No action queued</Badge>}</Group>
    <details className={classes.details}><summary>What was reviewed</summary>
      {card.evaluated.map((question, index) => <Text key={index} size="sm" mt="xs">{question}</Text>)}
      {card.period && <Text size="xs" c="dimmed" mt="sm">{card.period}</Text>}
      <dl className={classes.metrics}>{card.evidence.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
      {!card.evidence.length && <Text size="sm" c="dimmed">Performance details are unavailable for this evaluation.</Text>}
    </details>
    {card.proposals.map((proposal) => <section key={proposal.id} className={classes.proposal}>
      <div className={classes.heading}><Text fw={700} size="sm">{proposal.title}</Text><Badge color={statusColor(proposal.status)} variant="light">{proposal.status}</Badge></div>
      <Text size="sm" mt="xs">{proposal.detail}</Text>{proposal.reason && <Text size="sm" c="dimmed" mt={4}>{proposal.reason}</Text>}
      {proposal.canReview && proposal.reviewFingerprint && <div className={classes.review}>{canReview ? <ReviewButtons id={proposal.id} fingerprint={proposal.reviewFingerprint} /> : <Text size="xs" c="dimmed">An owner or admin can review this action.</Text>}</div>}
    </section>)}
  </article>)}</Stack>;
}

export function FindingsFeed({ findings, unavailable }: { findings: Array<{ id: string; title: string; summary: string; reason: string | null; status: string; confidence: string; detectedAt: string }>; unavailable: boolean }) {
  if (!findings.length && !unavailable) return null;
  return <section className={classes.findings}><Group gap="xs" mb="md"><IconBulb size={20} /><h2>Account signals</h2></Group>
    {unavailable ? <Text size="sm" c="dimmed">Account signals could not be loaded. Your decisions are shown above.</Text> : findings.map((finding) => <article key={finding.id} className={classes.finding}>
      <div className={classes.heading}><Text fw={700} size="sm">{finding.title}</Text><Badge color="gray" variant="light">{finding.status.replaceAll('_', ' ')}</Badge></div>
      <Text size="sm" mt="xs">{finding.summary}</Text>{finding.reason && <Text size="sm" c="dimmed" mt={4}>{finding.reason}</Text>}
      <Text size="xs" c="dimmed" mt="xs">{finding.detectedAt.slice(0, 10)} · {finding.confidence} confidence</Text>
    </article>)}</section>;
}
