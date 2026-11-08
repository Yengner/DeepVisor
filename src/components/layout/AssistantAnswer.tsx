'use client';
import Image from 'next/image';
import type { AssistantMessage } from '@/lib/shared/assistant/contracts';
import AssistantAnalytics from './AssistantAnalytics';
import classes from './Assistant.module.css';
export default function AssistantAnswer({ message, onAsk, busy }: { message: AssistantMessage; onAsk: (question: string) => void; busy: boolean }) {
  const presentation = message.presentation;
  return <div className={classes.answerBody}>
    <p>{presentation?.summary ?? message.text}</p>
    {presentation ? <>

      <AssistantAnalytics blocks={presentation.visuals} hideDetails />
      {!!message.creatives?.length && <div className={classes.answerCreatives}>{message.creatives.map(c => <figure key={c.id}>{c.image && <Image unoptimized width={240} height={150} src={c.image} alt={c.name} loading="lazy" referrerPolicy="no-referrer"/>}<figcaption>{c.name}</figcaption></figure>)}</div>}
      {presentation.insights.length > 0 && <ul className={classes.insightList}>{presentation.insights.map(insight => <li key={insight.id} data-tone={insight.tone}><span aria-label={insight.tone}>{insight.tone === 'favorable' ? '↗' : insight.tone === 'unfavorable' ? '↘' : '•'}</span>{insight.text}</li>)}</ul>}
      {presentation.metadata.length > 0 && <details className={classes.dataDetails}><summary>Data details</summary>{presentation.metadata.map(source => <div key={source.id}><strong>{source.title}</strong><ul>{source.details.map((detail, i) => <li key={i}>{detail}</li>)}</ul></div>)}</details>}
      {presentation.suggestedFollowUps.length > 0 && <div className={classes.followUps} aria-label="Suggested follow-up questions">{presentation.suggestedFollowUps.map(question => <button type="button" disabled={busy} key={question} onClick={() => onAsk(question)}>{question} <span aria-hidden>↗</span></button>)}</div>}
    </> : message.analytics && <AssistantAnalytics blocks={message.analytics}/>}
  </div>;
}
