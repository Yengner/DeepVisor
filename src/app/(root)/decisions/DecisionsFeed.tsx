'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { IconCheck, IconX, IconShieldCheck, IconBulb } from '@tabler/icons-react';
import type { DecisionCard } from '@/lib/server/decisions/surface';
import { reviewDecisionAction } from './actions';
import classes from './Decisions.module.css';
import StatusBadge from '@/components/product/StatusBadge';
import { meaningfulConfidence, ownerMessages } from '@/components/product/presentation';
import product from '@/components/product/Product.module.css';

const timestamp = (value:string) => new Date(value).toLocaleString('en-US', {timeZone:'UTC',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' UTC';

function ReviewButtons({ id, fingerprint }: { id: string; fingerprint: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<'approve'|'reject'|null>(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const router = useRouter();
  const submit = (choice: 'approve' | 'reject') => {
    if(inFlight.current||saved) return;
    inFlight.current=true;
    setChoice(choice);
    startTransition(async () => {
    setError(null);
    try {
      const result = await reviewDecisionAction(id, choice, fingerprint);
      if (result.error) setError(ownerMessages.review); else {setSaved(true); router.refresh();}
    } catch { setError(ownerMessages.review); }
    finally {inFlight.current=false;}
  });};
  return <Stack gap="xs"><Group gap="xs">
    <Button size="sm" color="signal" leftSection={<IconCheck size={16} />} disabled={pending||saved} onClick={() => submit('approve')}>{pending&&choice==='approve'?'Approving…':'Approve'}</Button>
    <Button size="sm" variant="default" leftSection={<IconX size={16} />} disabled={pending||saved} onClick={() => submit('reject')}>{pending&&choice==='reject'?'Rejecting…':'Reject'}</Button>
  </Group><Text size="xs" c="dimmed">Approval saves your choice. It does not change your ads.</Text>
    {error && <Alert color="red" role="alert">{error}</Alert>}
    <Text size="sm" role="status" aria-live="polite">{pending?'Saving your review…':saved?choice==='approve'?'Approved. No advertising change was executed by this approval.':'Rejected. Your review was saved.':''}</Text>
  </Stack>;
}

export default function DecisionsFeed({ cards, canReview }: { cards: DecisionCard[]; canReview: boolean }) {
  if (!cards.length) return <div className={classes.empty}><IconShieldCheck size={28} aria-hidden />
    <Text fw={700} mt="sm">No decisions yet</Text><Text c="dimmed" size="sm" mt={4}>Saved evaluations will appear here when available. Check Overview for your connection and latest sync.</Text><a href="/dashboard" className={classes.link}>Open Overview</a></div>;
  return <Stack gap="md">{cards.map((card) => {
    const confidence=meaningfulConfidence(card.provider,card.probability,card.confidence);
    return <article className={classes.card} key={card.id}>
    <div className={classes.heading}><div><Text size="sm" fw={600} c="dimmed">{card.entity}</Text><h2>{card.title==='Keep things as they are'?'No change recommended':card.title}</h2></div>
      <Text size="xs" c="dimmed">{new Date(card.createdAt).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} UTC</Text></div>
    <Text size="xs" c="dimmed" mb="sm">{card.account}</Text>
    <Text size="sm">{card.explanation}</Text>
    <Group gap="xs" mt="sm">{confidence !== null && <Text size="xs" c="dimmed">{Math.round(confidence * 100)}% confidence</Text>}
      {!card.proposals.length && <StatusBadge status="No action queued"/>}</Group>
    <details className={classes.details}><summary>What was reviewed</summary>
      {card.evaluated.map((question, index) => <Text key={index} size="sm" mt="xs">{question}</Text>)}
      {card.period && <Text size="xs" c="dimmed" mt="sm">{card.period}</Text>}
      <dl className={classes.metrics}>{card.evidence.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
      {!card.evidence.length && <Text size="sm" c="dimmed">Performance details are unavailable for this evaluation.</Text>}
    </details>
    {card.proposals.map((proposal) => <section key={proposal.id} className={classes.proposal}>
      <div className={classes.heading}><Text fw={700} size="sm">{proposal.title}</Text><StatusBadge status={proposal.status}/></div>
      {proposal.currentValue||proposal.proposedValue?<dl className={product.values}><div><dt>Current at evaluation</dt><dd>{proposal.currentValue??'Unavailable'}</dd></div><div><dt>Proposed</dt><dd>{proposal.proposedValue??'Unavailable'}</dd></div></dl>:<Text size="sm" mt="xs">{proposal.detail}</Text>}
      {proposal.reason && <Text size="sm" c="dimmed" mt={4}>Policy at evaluation: {proposal.reason}</Text>}
      {proposal.status==='Observation only'&&<Text size="sm" mt="xs">Shadow observation only. This observation did not execute a change.</Text>}
      {['Needs reconciliation','Execution failed'].includes(proposal.status)&&<Text size="sm" mt="xs">The result needs verification. Check the recorded state before making another change.</Text>}
      {!!proposal.executionHistory?.length&&<details className={classes.details}><summary>Recorded changes</summary>{proposal.executionHistory.map((execution,i)=><div key={i} className={product.audit}><StatusBadge status={execution.status}/><Text size="xs" c="dimmed" mt={8}>{execution.completedAt?`Completed ${timestamp(execution.completedAt)}`:execution.startedAt?`Started ${timestamp(execution.startedAt)}`:'Execution time unavailable'}</Text><dl className={product.values}><div><dt>Observed before</dt><dd>{execution.before??'Unavailable'}</dd></div><div><dt>Observed after</dt><dd>{execution.after??'Unavailable'}</dd></div></dl></div>)}</details>}
      {proposal.canReview && proposal.reviewFingerprint && <div className={classes.review}>{canReview ? <ReviewButtons id={proposal.id} fingerprint={proposal.reviewFingerprint} /> : <Text size="xs" c="dimmed">An owner or admin can review this action.</Text>}</div>}
    </section>)}
  </article>;})}</Stack>;
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
