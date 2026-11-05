'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Drawer } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSparkles, IconX } from '@tabler/icons-react';
import type { GlobalAiAssistantPayload } from '@/lib/server/intelligence/types';
import { assistantWidth } from './assistantSizing';
import classes from './Assistant.module.css';
type Message = { role: 'user' | 'assistant'; text: string };
export default function AiAssistantDrawer({ payload, children }: { payload: GlobalAiAssistantPayload | null; children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [width, setWidth] = useState(380);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [asking, setAsking] = useState(false);
  const mobile = useMediaQuery('(max-width: 900px)', true);
  const trigger = useRef<HTMLButtonElement>(null);
  const abort = useRef<AbortController | null>(null);
  const drag = useRef(false);
  useEffect(() => {
    const resize = () => setWidth(w => assistantWidth(w, window.innerWidth - 60));
    resize(); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); abort.current?.abort(); };
  }, []);
  function close() { setOpened(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }
  async function ask(question: string) {
    if (asking || !question.trim() || !payload?.selectedAdAccountId) return;
    const controller = new AbortController(); abort.current = controller;
    setDraft(''); setAsking(true); setMessages(m => [...m, { role: 'user', text: question }]);
    try {
      const response = await fetch('/api/intelligence/assistant', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, platformIntegrationId: payload.selectedPlatformIntegrationId, adAccountId: payload.selectedAdAccountId }) });
      const result = await response.json();
      if (!response.ok || !result.success || typeof result.answer !== 'string') throw new Error('Account analysis is unavailable. Please try again.');
      setMessages(m => [...m, { role: 'assistant', text: result.answer }]);
    } catch { if (!controller.signal.aborted) setMessages(m => [...m, { role: 'assistant', text: 'Account analysis is unavailable. Please try again.' }]); }
    finally { if (!controller.signal.aborted) setAsking(false); }
  }
  const content = <div className={classes.content}>
    <header><div><strong>DeepVisor AI</strong><p>{payload?.selectedAdAccountName ?? 'Select an account in Connections'}</p></div><button aria-label="Close assistant" onClick={close}><IconX size={19} /></button></header>
    <p className={classes.context}>Ask about saved account performance, creative history, or risks. Account changes are unavailable here.</p>
    <div className={classes.thread} role="log" aria-live="polite" aria-label="Account conversation">
      {!messages.length && <p>What would you like to understand?</p>}
      {messages.map((message, i) => <article key={i} data-role={message.role}><small>{message.role === 'user' ? 'You' : 'DeepVisor'}</small><p>{message.text}</p></article>)}
      {asking && <p role="status">Reading saved account context…</p>}
    </div>
    <div className={classes.prompts}>{['What matters right now?', 'What was my best ad creative?', 'What changed recently?'].map(p => <button key={p} disabled={asking || !payload?.selectedAdAccountId} onClick={() => void ask(p)}>{p}</button>)}</div>
    <form onSubmit={e => { e.preventDefault(); void ask(draft); }}><label htmlFor="assistant-question">Ask about this account</label><textarea id="assistant-question" value={draft} onChange={e => setDraft(e.target.value)} rows={3} /><button disabled={asking || !draft.trim() || !payload?.selectedAdAccountId}>Send</button></form>
  </div>;
  return <>
    <div className={classes.workspace}>
      <div className={classes.main}>{children}</div>
      {opened && !mobile && <aside className={classes.panel} style={{ width }} aria-label="DeepVisor assistant" onKeyDown={e => { if (e.key === 'Escape') close(); }}>
        <div role="separator" aria-label="Resize assistant" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={typeof window === 'undefined' ? 600 : Math.floor((window.innerWidth - 60) / 2)} aria-valuenow={Math.round(width)} tabIndex={0} className={classes.resize}
          onKeyDown={e => { if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); setWidth(w => assistantWidth(e.key === 'Home' ? 320 : e.key === 'End' ? window.innerWidth : w + (e.key === 'ArrowLeft' ? 24 : -24), window.innerWidth - 60)); } }}
          onPointerDown={e => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (drag.current) setWidth(assistantWidth(window.innerWidth - e.clientX, window.innerWidth - 60)); }} onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }} />{content}
      </aside>}
    </div>
    {!opened && <button ref={trigger} className={classes.launcher} aria-expanded={opened} aria-label="Open DeepVisor assistant" onClick={() => setOpened(v => !v)}><IconSparkles size={20} /> Ask DeepVisor</button>}
    <Drawer opened={opened && mobile} onClose={close} position="right" size="100%" title="DeepVisor AI" withCloseButton={false} styles={{ body: { height: 'calc(100dvh - 60px)', padding: 0 } }} trapFocus returnFocus>{content}</Drawer>
  </>;
}
