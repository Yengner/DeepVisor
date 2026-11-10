'use client';
import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import Image from 'next/image';
import SpiderMascot from './SpiderMascot';
import manifest from '../../../public/images/brand/mascot/review-v2/manifest.json';
import stateManifest from '../../../public/images/brand/mascot/review-v2/states-manifest.json';
import classes from './SpiderDesignReview.module.css';

type ProductState=keyof typeof stateManifest.states;
type Mode='idle'|'blink'|'still'|ProductState;
/** Review candidate only. The production SpiderMascot contract/assets remain unchanged. */
function Candidate({size=64,mode='idle',paused=false}:{size?:number;mode?:Mode;paused?:boolean}){
 const sprite=useRef<HTMLSpanElement>(null);
 const product=mode in stateManifest.states?stateManifest.states[mode as ProductState]:null;
 const count=product?stateManifest.frames.length:manifest.frames.length;
 const restingPosition=(product?.reducedMotionFrame??0)*100/(count-1);
 useEffect(()=>{
  const element=sprite.current;if(!element||mode==='still'||paused||product?.sequence.length===1)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const sequence=product?.sequence??(mode==='idle'?manifest.idle.sequence:manifest.blink.sequence);
  const duration=sequence.reduce((sum,frame)=>sum+frame.durationMs,0);let elapsed=0;
  const frames:Keyframe[]=sequence.map(frame=>{const offset=elapsed/duration;elapsed+=frame.durationMs;return {backgroundPositionX:`${frame.frame*100/(count-1)}%`,offset,easing:'steps(1,end)'};});
  frames.push({backgroundPositionX:`${restingPosition}%`,offset:1});
  const animation=element.animate(frames,{duration,iterations:(product?.loop??mode==='idle')?Infinity:1,fill:'forwards'});
  let inView=true;
  const sync=()=>{if(motion.matches){animation.pause();animation.currentTime=0;}else if(document.visibilityState==='hidden'||!inView)animation.pause();else if(animation.playState!=='finished')animation.play();};
  const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();});observer.observe(element);motion.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);sync();
  return()=>{observer.disconnect();motion.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);animation.cancel();};
 },[mode,paused,product,count,restingPosition]);
 return <span className={classes.mascot} role="img" aria-label={`Refined DeepVisor spider, ${product?mode:mode==='still'||paused?'resting':mode==='blink'?'blink preview':'resting with natural blinking'}`} style={{'--size':`${size}px`,'--rest-position':`${restingPosition}%`} as CSSProperties}><span ref={sprite} className={classes.sprite} style={{backgroundImage:`url('/images/brand/mascot/review-v2/${product?stateManifest.strip:manifest.strip}')`,backgroundSize:`${count*100}% 100%`,backgroundPositionX:`${restingPosition}%`}}/></span>;
}
export default function SpiderDesignReview(){
 const [paused,setPaused]=useState(false),[replay,setReplay]=useState(0);
 return <main className={classes.page}>
  <header><p className={classes.eyebrow}>DeepVisor · character system / product states</p><h1>A calmer, more consistent spider.</h1><p>PixelLab review candidate. Fixed anatomy, natural blinking and quiet product states.</p><p className={classes.notice}>These are animation previews, not live agent activity. Production artwork is unchanged. Supporting spider specialists remain concepts.</p></header>
  <div className={classes.controls}><button onClick={()=>setPaused(p=>!p)} aria-pressed={paused}>{paused?'Resume blinking':'Pause blinking'}</button><button onClick={()=>setReplay(n=>n+1)}>Replay one blink</button><a href="/images/brand/mascot/review-v2/review-sheet.png">Open review sheet</a><a href="/images/brand/mascot/review-v2/manifest.json">Animation manifest</a></div>
  <div className={classes.surfaces}>{(['light','dark'] as const).map(tone=><section key={tone} className={`${classes.surface} ${classes[tone]}`} aria-label={`${tone} background review`}><h2>{tone==='light'?'Light surface':'Dark surface'}</h2><div className={classes.hero}><Candidate size={256} paused={paused}/></div><div className={classes.frames}>{['open','half','closed'].map(name=><figure key={name}><Image src={`/images/brand/mascot/review-v2/deepvisor-spider-${name}.png`} alt={`${name} eyes`} width={96} height={72} unoptimized/><figcaption>{name==='half'?'Half closed':name==='open'?'Open':'Closed'}</figcaption></figure>)}</div><h3>Actual UI sizes</h3><div className={classes.sizes}>{[32,48,64].map(size=><figure key={size}><Candidate size={size} paused={paused}/><figcaption>{size}px</figcaption></figure>)}</div></section>)}</div>
  <section className={classes.comparison}><div><h2>Current production mascot</h2><SpiderMascot size={96} state="idle" paused={paused}/></div><div><h2>Refined candidate</h2><Candidate size={96} paused={paused}/></div><div><h2>One-shot blink</h2><Candidate key={replay} size={96} mode="blink" paused={paused}/><p>180ms closure and reopening.</p></div></section>
  <section className={classes.notes} aria-label="Product state previews"><h2>Product states</h2><p>Working and scanning loop gently. Success, attention and sleep hold a clear expression without repeated celebration or flashing.</p><div className={classes.stateGrid}>{(Object.keys(stateManifest.states) as ProductState[]).map(state=><article key={state} className={classes.stateCard} data-mascot-state={state}><h3>{state}</h3><div className={classes.statePair}><Candidate size={128} mode={state} paused={paused}/><div className={classes.dark}><Candidate size={128} mode={state} paused={paused}/></div></div><div className={classes.sizes}>{[32,48,64].map(size=><Candidate key={size} size={size} mode={state} paused={paused}/>)}</div></article>)}</div><p>Scanning also serves thinking/analysis. Sleep is intentionally still. Each state keeps its meaning when motion is reduced.</p><a href="/images/brand/mascot/review-v2/states-manifest.json">Product-state manifest</a></section>
  <section className={classes.notes}><h2>Design rules</h2><p>64×48 native grid · transparent edges · eight brand colors · two square cyan eyes · no mouth, glow or shadows.</p><p>Idle holds vary between 4.2, 6.2 and 5.1 seconds. Reduced-motion preference shows the resting pose. Offscreen or hidden previews stop animating.</p><h2>Later: the spider specialists</h2><p><strong>Scout:</strong> discovery lens. <strong>Studio:</strong> creative tile. <strong>Keeper:</strong> safeguard shield. Shared anatomy and palette, with the main spider remaining the face of DeepVisor.</p></section>
 </main>;
}
