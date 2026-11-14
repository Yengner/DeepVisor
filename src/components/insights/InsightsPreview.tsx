'use client';
import { useEffect, useMemo, useState } from 'react';
import { Modal, useMantineColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ChevronDown, ChevronUp, ExternalLink, LayoutGrid, Moon, Square, Sun } from 'lucide-react';
import { InsightContent, InsightFooter, insightModalClassNames } from './InsightsView';
import { previewPresentation, previewScenarioGroups, previewScenarioNotes, previewScenarios } from '@/lib/shared/insights/preview';
import type { PreviewScenario } from '@/lib/shared/insights/preview';
import styles from './InsightsPreview.module.css';

const WIDTHS = [{ id: '740', label: 'Desktop' }, { id: '390', label: '390px' }, { id: '320', label: '320px' }] as const;
type Width = typeof WIDTHS[number]['id'];
const isScenario = (value: string | null): value is PreviewScenario => previewScenarios.some(([id]) => id === value);

/** The modal as owners see it: title bar, content and footer at a fixed width. */
function Frame({ scenario, width }: { scenario: PreviewScenario; width: Width }) {
  return <div className={styles.frame} style={{ width: Number(width) }}>
    <div className={styles.frameTitle}>Insights &amp; Events<span aria-hidden="true">×</span></div>
    <div className={styles.frameBody}>
      <InsightContent key={scenario} saved={previewPresentation(scenario)} preview />
      <InsightFooter note="This update stays in your history." action="Got it" onAction={() => undefined} />
    </div>
  </div>;
}

/**
 * Development-only workbench for the Insights & Events modal. Every scenario uses the production
 * renderer with synthetic data: no fetches, Meta calls, database writes or review receipts.
 */
export default function InsightsPreview() {
  const [scenario, setScenario] = useState<PreviewScenario>('all');
  const [width, setWidth] = useState<Width>('740');
  const [view, setView] = useState<'single' | 'gallery'>('single');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState(false);
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const mobile = useMediaQuery('(max-width: 600px)');

  // Deep links: /insights/preview?scenario=stale&width=390&view=gallery
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('scenario'), w = params.get('width'), v = params.get('view'), c = params.get('category');
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the URL after hydration */
    if (isScenario(fromUrl)) setScenario(fromUrl);
    if (WIDTHS.some(item => item.id === w)) setWidth(w as Width);
    if (v === 'gallery') setView('gallery');
    if (c && previewScenarioGroups.some(g => g.id === c)) setCategory(c);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    const params = new URLSearchParams({ scenario, width, view, ...(category !== 'all' ? { category } : {}) });
    window.history.replaceState(null, '', `?${params}`);
  }, [scenario, width, view, category]);

  const groups = useMemo(() => previewScenarioGroups.filter(group => category === 'all' || group.id === category), [category]);
  const ordered = useMemo(() => groups.flatMap(group => group.scenarios.map(([id]) => id as PreviewScenario)), [groups]);
  const index = ordered.indexOf(scenario);
  const step = (delta: number) => setScenario(ordered[(Math.max(index, 0) + delta + ordered.length) % ordered.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (modal || (event.target as HTMLElement | null)?.closest('input,select,textarea')) return;
      if (event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); step(1); }
      if (event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const label = previewScenarios.find(([id]) => id === scenario)?.[1] ?? scenario;
  const groupOf = previewScenarioGroups.find(group => group.scenarios.some(([id]) => id === scenario));

  return <div className={styles.workbench}>
    <header className={styles.top}>
      <div>
        <p className={styles.kicker}>Development only · synthetic data · {previewScenarios.length} scenarios</p>
        <h1>Insights &amp; Events preview</h1>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Preview width">{WIDTHS.map(item => <button key={item.id} type="button" aria-pressed={width === item.id} onClick={() => setWidth(item.id)}>{item.label}</button>)}</div>
        <div className={styles.segment} role="group" aria-label="Preview layout">
          <button type="button" aria-pressed={view === 'single'} onClick={() => setView('single')}><Square size={14} aria-hidden="true" />Single</button>
          <button type="button" aria-pressed={view === 'gallery'} onClick={() => setView('gallery')}><LayoutGrid size={14} aria-hidden="true" />Gallery</button>
        </div>
        <button type="button" className={styles.tool} onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}>
          {colorScheme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}Switch to {colorScheme === 'dark' ? 'light' : 'dark'}
        </button>
        <button type="button" className={styles.tool} onClick={() => setModal(true)}><ExternalLink size={14} aria-hidden="true" />Open as real modal</button>
      </div>
    </header>

    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <label className={styles.category}>Category
          <select aria-label="Preview category" value={category} onChange={e => {
            const value = e.target.value; setCategory(value);
            const group = previewScenarioGroups.find(g => g.id === value);
            if (group && !group.scenarios.some(([id]) => id === scenario)) setScenario(group.scenarios[0][0]);
          }}>
            <option value="all">All categories · {previewScenarios.length}</option>
            {previewScenarioGroups.map(group => <option key={group.id} value={group.id}>{group.label} · {group.scenarios.length}</option>)}
          </select>
        </label>
        <nav aria-label="Preview scenarios" className={styles.list}>
          {groups.map(group => <section key={group.id}>
            <h2>{group.label}<span>{group.scenarios.length}</span></h2>
            {group.scenarios.map(([id, name]) => <button key={id} type="button" data-scenario={id} aria-current={scenario === id ? 'true' : undefined}
              onClick={() => { setScenario(id); if (view === 'gallery') document.getElementById(`scenario-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <span>{name}</span><small>{previewScenarioNotes[id]}</small>
            </button>)}
          </section>)}
        </nav>
        <p className={styles.hint}>↑ / ↓ or J / K to move between scenarios</p>
      </aside>

      <main className={styles.stage}>
        {view === 'single' ? <>
          <div className={styles.stageBar}>
            <div>
              <p className={styles.kicker}>{groupOf?.label} · {index + 1} of {ordered.length}</p>
              <h2>{label}</h2>
              <p className={styles.note}>{previewScenarioNotes[scenario]}</p>
            </div>
            <div className={styles.stepper}>
              <button type="button" aria-label="Previous scenario" onClick={() => step(-1)}><ChevronUp size={16} /></button>
              <button type="button" aria-label="Next scenario" onClick={() => step(1)}><ChevronDown size={16} /></button>
            </div>
          </div>
          <div className={styles.canvas}><Frame scenario={scenario} width={width} /></div>
        </> : <div className={styles.gallery}>
          {ordered.map(id => <figure key={id} id={`scenario-${id}`} className={styles.galleryItem} data-current={id === scenario || undefined}>
            <figcaption><button type="button" onClick={() => { setScenario(id); setView('single'); }}>{previewScenarios.find(([s]) => s === id)?.[1]}</button><span>{previewScenarioNotes[id]}</span></figcaption>
            <Frame scenario={id} width={width} />
          </figure>)}
        </div>}
      </main>
    </div>

    <Modal opened={modal} onClose={() => setModal(false)} title="Insights & Events" size={740} fullScreen={mobile} radius="lg" classNames={insightModalClassNames}>
      <div className={styles.modalBanner} role="status">Preview · {label} · nothing here affects your account</div>
      <InsightContent key={scenario} saved={previewPresentation(scenario)} preview />
      <InsightFooter note="Dismissing this preview does not affect your account." action="Dismiss preview" onAction={() => setModal(false)} />
    </Modal>
  </div>;
}
