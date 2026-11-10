'use client';
import {useState} from 'react';
import {Modal,useMantineColorScheme} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {InsightContent} from './InsightsView';
import {previewPresentation,previewScenarios} from '@/lib/shared/insights/preview';
import type {PreviewScenario} from '@/lib/shared/insights/preview';
import styles from './InsightsView.module.css';
export default function InsightsPreview(){
 const [scenario,setScenario]=useState<PreviewScenario>('all'),[opened,setOpened]=useState(true),[width,setWidth]=useState('740');
 const {colorScheme,setColorScheme}=useMantineColorScheme(),mobile=useMediaQuery('(max-width: 600px)');
 const selected=previewScenarios.findIndex(([id])=>id===scenario);
 const controls=<div className={styles.previewControls}><label>Scenario<select aria-label="Preview scenario" value={scenario} onChange={e=>setScenario(e.target.value as PreviewScenario)}>{previewScenarios.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Modal width<select aria-label="Preview width" value={width} onChange={e=>setWidth(e.target.value)}><option value="740">Desktop</option><option value="390">390px</option><option value="320">320px</option></select></label><button type="button" onClick={()=>setColorScheme(colorScheme==='dark'?'light':'dark')}>Switch to {colorScheme==='dark'?'light':'dark'}</button><button type="button" onClick={()=>setScenario(previewScenarios[(selected+1)%previewScenarios.length][0])}>Next scenario →</button></div>;
 return <section className={styles.history}><h1>Insights &amp; Events · Development preview</h1><p>Use the real modal renderer with synthetic data. Hot reload updates the preview as you edit components and CSS. No Meta calls, database changes, or review receipts.</p>{controls}<button type="button" onClick={()=>setOpened(true)}>Open scenario preview</button><Modal opened={opened} onClose={()=>setOpened(false)} size={Number(width)} fullScreen={mobile} radius="lg" title="Development preview · Synthetic data" classNames={{content:styles.modalContent,header:styles.modalHeader,title:styles.modalTitle}}>{controls}<div className={styles.previewBanner} role="status">Preview only · {previewScenarios.length} scenarios · No real advertising activity</div><InsightContent key={scenario} saved={previewPresentation(scenario)} preview/><footer className={styles.footer}><span>Dismissing this preview does not affect your account.</span><button type="button" onClick={()=>setOpened(false)}>Dismiss preview</button></footer></Modal></section>;
}
