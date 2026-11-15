'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Drawer, Menu, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ASK_EVENT, type AskDetail } from '@/lib/shared/assistant/askEvent';
import { IconSparkles, IconX, IconPlus, IconArrowUp, IconArrowDown, IconDots, IconPaperclip, IconTrash, IconInfoCircle } from '@tabler/icons-react';
import AssistantAnswer from './AssistantAnswer';
import AssistantDraftCard from './AssistantDraftCard';
import { useAssistantConversation } from './useAssistantConversation';
import type { GlobalAiAssistantPayload } from '@/lib/server/intelligence/types';
import { assistantWidth } from './assistantSizing';
import classes from './Assistant.module.css';
export default function AiAssistantDrawer({ payload, children }: { payload: GlobalAiAssistantPayload | null; children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [width, setWidth] = useState(380);
  const [draft, setDraft] = useState('');
  // Other surfaces (e.g. dashboard ad cards) open the assistant with a pre-filled draft.
  useEffect(() => {
    const onAsk = (event: Event) => {
      const question = (event as CustomEvent<AskDetail>).detail?.question;
      if (typeof question !== 'string' || !question.trim()) return;
      setDraft(question.slice(0, 2000));
      setOpened(true);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);
  const [newData, setNewData] = useState(false);
  useEffect(() => {
    const updated = (event: Event) => { if ((event as CustomEvent<{accountId:string}>).detail?.accountId === payload?.selectedAdAccountId) setNewData(true); };
    window.addEventListener('deepvisor:data-updated', updated);
    return () => window.removeEventListener('deepvisor:data-updated', updated);
  }, [payload?.selectedAdAccountId]);
  const chat = useAssistantConversation(payload?.selectedAdAccountId);
  const [clearRequested, setClearRequested] = useState(false);
  const [formAccount, setFormAccount] = useState(payload?.selectedAdAccountId);
  if (formAccount !== payload?.selectedAdAccountId) {
    setFormAccount(payload?.selectedAdAccountId); setDraft(''); setClearRequested(false); setNewData(false);
  }
  const asking = chat.busy;
  const mobile = useMediaQuery('(max-width: 900px)', true);
  const trigger = useRef<HTMLButtonElement>(null);
  const drag = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [following, setFollowing] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  function scrollToLatest() {
    follow.current = true; setFollowing(true);
    const element = thread.current;
    if (element) element.scrollTop = element.scrollHeight;
  }
  useEffect(() => {
    const element = thread.current;
    if (!opened || !element) return;
    scrollToLatest();
    const contents = element.firstElementChild;
    const observer = new ResizeObserver(() => { if (follow.current) element.scrollTop = element.scrollHeight; });
    if (contents) observer.observe(contents);
    return () => observer.disconnect();
  }, [opened, mobile]);
  useEffect(() => {
    const element = thread.current;
    if (element && follow.current) element.scrollTop = element.scrollHeight;
  }, [chat.state.revision, asking, pendingQuestion]);
  useEffect(() => {
    const resize = () => setWidth(w => assistantWidth(w, window.innerWidth - 60));
    resize(); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); };
  }, []);
  function close() { setOpened(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }
  async function ask(question: string) {
    if (asking || !question.trim()) return;
    scrollToLatest(); setNewData(false); setPendingQuestion(question); setDraft('');
    try { if (!await chat.ask(question)) setDraft(current => current || question); } finally { setPendingQuestion(null); }
  }
  const content = <div className={classes.content}>
    <header className={classes.chatHeader}><div><strong><IconSparkles size={16} /> Ask DeepVisor</strong><p>{payload?.selectedAdAccountName ?? 'Select an account in Connections'}</p></div><div className={classes.headerActions}>
      <Menu position="bottom-end" withinPortal><Menu.Target><button type="button" aria-label="Conversation options"><IconDots size={18}/></button></Menu.Target><Menu.Dropdown>
        <Menu.Label>Conversation</Menu.Label><Menu.Item leftSection={<IconInfoCircle size={16}/>} disabled>Saved account context · draft planning</Menu.Item>
        <Menu.Item leftSection={<IconTrash size={16}/>} disabled={asking || !chat.ready} onClick={() => setClearRequested(true)}>Clear conversation…</Menu.Item>
      </Menu.Dropdown></Menu>
      <button aria-label="Close assistant" onClick={close}><IconX size={19} /></button></div></header>
    {clearRequested && <div className={classes.historyActions}><span>Clear this account conversation?</span><button disabled={asking} onClick={() => void chat.clear().then(ok => { if (ok) setClearRequested(false); })}>Clear history</button><button onClick={() => setClearRequested(false)}>Cancel</button></div>}
    <div className={classes.conversationArea}>
    <div ref={thread} className={classes.thread} role="log" aria-live="polite" aria-label="Account conversation" onScroll={e => { const el=e.currentTarget; const near=el.scrollHeight-el.scrollTop-el.clientHeight<64; follow.current=near; setFollowing(near); }}><div className={classes.threadContents}>
      {!chat.state.messages.length && !pendingQuestion && <div className={classes.emptyState}><IconSparkles size={28}/><h2>What are we working on?</h2><p>Explore your advertising or plan your next ad.</p><div className={classes.prompts}>{["What's my usual budget?", 'Help me plan another ad', 'Compare my saved creatives'].map(p => <button key={p} disabled={asking || !chat.ready || !chat.configured} onClick={() => void ask(p)}>{p}</button>)}</div></div>}
      {chat.state.messages.map((message, i) => <article key={i} data-role={message.role}><small>{message.role === 'user' ? 'You' : 'DeepVisor'}</small><AssistantAnswer message={message} busy={asking || !chat.ready} onAsk={question => void ask(question)} /></article>)}
      {chat.state.creatives.length > 0 && <div className={classes.creativeCards} aria-label="Saved creative recommendations">{chat.state.creatives.map(c => <article key={c.id}>{c.image && <Image unoptimized width={256} height={160} src={c.image} alt={c.name} loading="lazy" referrerPolicy="no-referrer" />}<strong>{c.name}</strong><small>{c.kind ?? 'Saved creative'}</small></article>)}</div>}
      {chat.state.plan && <AssistantDraftCard key={`${payload?.selectedAdAccountId}:${chat.state.revision}`} plan={chat.state.plan} creatives={chat.state.creatives} currency={chat.currency} timezone={chat.timezone} busy={asking} savedDraftId={chat.state.savedDraftId} onSave={chat.save} onModify={chat.modify} />}
      {pendingQuestion && <article data-role="user"><small>You</small><p>{pendingQuestion}</p></article>}
      {asking && <p className={classes.working} role="status"><IconSparkles size={14}/> Working…</p>}
      {chat.error && <div role="alert"><p>{chat.error}</p><button disabled={asking} onClick={() => void chat.reload()}>Reload conversation</button></div>}
      {chat.ready && !chat.configured && <p>OpenAI is not configured for this environment.</p>}
      {(chat.state.attachments??[]).map(file=>{const src=`/api/intelligence/assistant/media?id=${encodeURIComponent(file.id)}&account=${encodeURIComponent(payload?.selectedAdAccountId??'')}`;return <figure key={file.id} className={classes.attachment}>{file.mime.startsWith('video/')?<video src={src} controls preload="metadata" aria-label={file.name}/>:<Image unoptimized width={320} height={220} src={src} alt={file.name}/>}<figcaption>{file.name} · Private draft media</figcaption></figure>;})}
    </div></div>
    {!following && <button className={classes.jumpLatest} type="button" aria-label="Scroll to latest message" onClick={scrollToLatest}><IconArrowDown size={16}/> Latest</button>}
    </div>
    {newData && <p className={classes.working} role="status">New account data is available. Ask again for an updated answer.</p>}
    <form className={classes.composer} onSubmit={e => { e.preventDefault(); void ask(draft); }}>
      <label className={classes.srOnly} htmlFor="assistant-question">Ask about this account</label>
      <textarea id="assistant-question" placeholder="Ask anything about your advertising…" maxLength={3000} value={draft} onChange={e => setDraft(e.target.value)} rows={3} onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(draft); } }}/>
      <div className={classes.composerTools}>
        <Menu position="top-start" withinPortal><Menu.Target><button type="button" className={classes.iconButton} aria-label="Add to conversation"><IconPlus size={21}/></button></Menu.Target><Menu.Dropdown><Menu.Label>Add to conversation</Menu.Label><Menu.Item leftSection={<IconPaperclip size={16}/>} disabled={asking||!chat.ready||(chat.state.attachments?.length??0)>=4} onClick={() => fileInput.current?.click()}>Images or video<small className={classes.menuHint}>Up to 4 files · 4 MB each</small></Menu.Item></Menu.Dropdown></Menu>
        <input ref={fileInput} className={classes.srOnly} tabIndex={-1} aria-label="Upload image or video" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={asking||!chat.ready||(chat.state.attachments?.length??0)>=4} onChange={e=>{const file=e.target.files?.[0];if(file){scrollToLatest();void chat.upload(file);}e.target.value='';}}/>
        <span className={classes.composerContext}>{chat.state.attachments?.length ? `${chat.state.attachments.length} attached` : 'Account context'}</span>
        <Tooltip label="Send · Enter (Shift+Enter for a new line)"><button className={classes.sendButton} aria-label="Send message" disabled={asking || !draft.trim() || !chat.ready || !chat.configured}><IconArrowUp size={19}/></button></Tooltip>
      </div>
    </form>
    <p className={classes.footerNote}>Drafts only. Nothing publishes to Meta.</p>
  </div>;
  return <>
    <div className={classes.workspace}>
      <div className={classes.main}>{children}</div>
      {opened && !mobile && <aside className={classes.panel} style={{ width }} aria-label="DeepVisor assistant" onKeyDown={e => { if (e.key === 'Escape') close(); }}>
        <div role="separator" aria-label="Resize assistant" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={typeof window === 'undefined' ? 600 : Math.floor(assistantWidth(Infinity, window.innerWidth - 60))} aria-valuenow={Math.round(width)} tabIndex={0} className={classes.resize}
          onKeyDown={e => { if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); setWidth(w => assistantWidth(e.key === 'Home' ? 320 : e.key === 'End' ? window.innerWidth : w + (e.key === 'ArrowLeft' ? 24 : -24), window.innerWidth - 60)); } }}
          onPointerDown={e => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (drag.current) setWidth(assistantWidth(window.innerWidth - e.clientX, window.innerWidth - 60)); }} onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }} />{content}
      </aside>}
    </div>
    {!opened && <button ref={trigger} className={classes.launcher} aria-expanded={opened} aria-label="Open DeepVisor assistant" onClick={() => setOpened(v => !v)}><IconSparkles size={20} /> Ask DeepVisor</button>}
    <Drawer onEnterTransitionEnd={scrollToLatest} opened={opened && mobile} onClose={close} position="right" size="100%" title="DeepVisor AI" withCloseButton={false} styles={{ body: { height: 'calc(100dvh - 60px)', padding: 0 } }} trapFocus returnFocus>{content}</Drawer>
  </>;
}
