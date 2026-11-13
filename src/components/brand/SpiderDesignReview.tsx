'use client';
import { useState } from 'react';
import SpiderMascot, { spiderStates, type SpiderMascotState } from './SpiderMascot';
import classes from './SpiderDesignReview.module.css';

const notes: Record<SpiderMascotState, string> = {
  idle: 'Breathes, blinks, glances and taps a foot on uneven holds (9.6s loop).',
  blink: 'One 300ms blink, then rest.',
  walking: 'Alternating gait with a 1px body bob, in place (800ms loop).',
  working: 'Eyes on the laptop, feet typing, screen line scrolling.',
  thinking: 'Looks up; three dots appear one by one.',
  scanning: 'Eyes sweep while a beam passes over the frame.',
  success: 'Crouch, jump, burst, land — then keeps the happy pose.',
  sleep: 'Slow breathing with drifting z’s. Deliberate inactive state only.',
  attention: 'Startles twice, then holds a steady “!” (no endless flashing).',
  wave: 'Greeting: raises a front leg and waves.',
  idea: 'Lightbulb pops in, then glows softly.',
  dangle: 'Hangs on a silk thread and swings. Good for empty states.',
};

/** Development-only review page for the production SpiderMascot. Illustrations only. */
export default function SpiderDesignReview() {
  const [paused, setPaused] = useState(false), [replay, setReplay] = useState(0);
  return <main className={classes.page}>
    <header><p className={classes.eyebrow}>DeepVisor · spider mascot v3</p><h1>One grid, whole-pixel scaling, twelve states.</h1>
      <p>32×32 native artwork, always drawn at 1×, 2×, 3× or 4×. The body bitmap never changes between frames; legs are solved from planted feet; the outline is generated so it is always one pixel.</p>
      <p className={classes.notice}>Animation previews only. Nothing here represents live agent activity.</p></header>
    <div className={classes.controls}><button onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? 'Resume' : 'Pause'} animations</button><button onClick={() => setReplay((n) => n + 1)}>Replay one-shot states</button><a href="/images/brand/mascot/deepvisor-spider-sprite.png">Light sheet</a><a href="/images/brand/mascot/deepvisor-spider-sprite-dark.png">Dark sheet</a></div>
    <div className={classes.grid}>{spiderStates.map((state) => <article key={`${state}:${replay}`} className={classes.card} data-mascot-state={state}>
      <h2>{state}</h2>
      <div className={classes.pair}>
        <div className={classes.light}><SpiderMascot state={state} size={128} paused={paused} /></div>
        <div className={classes.dark}><SpiderMascot state={state} size={128} tone="dark" paused={paused} /></div>
      </div>
      <div className={classes.sizes}>{[32, 64, 96].map((size) => <SpiderMascot key={size} state={state} size={size} paused={paused} />)}</div>
      <p>{notes[state]}</p>
    </article>)}</div>
  </main>;
}
