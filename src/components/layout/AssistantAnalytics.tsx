'use client';
import { useState } from 'react';
import { BarChart } from '@mantine/charts';
import { analyticsBlockSchema } from '@/lib/shared/assistant/analytics';
import type { AnalyticsBlock } from '@/lib/shared/assistant/analytics';
import classes from './Assistant.module.css';
export function AssistantMetricStrip({data}:{data:AnalyticsBlock}) {
 const order=['conversion','spend','costPerResult'];
 const items=[...data.items].sort((a,b)=>order.indexOf(a.key??'')-order.indexOf(b.key??''));
 return <dl className={classes.metricStrip}>{items.map((item,i)=><div key={i}><dt>{item.label}</dt><dd>{item.value}</dd>{item.change&&<small data-direction={item.change.direction}>{item.change.value>0?'↑':item.change.value<0?'↓':'→'} {Math.abs(item.change.value).toFixed(1)}{item.change.unit}</small>}{data.kind==='comparison'&&item.baseline&&<small>{data.baselineLabel}: {item.baseline}</small>}</div>)}</dl>;
}
export function AssistantTrendChart({data}:{data:AnalyticsBlock}) {
 const [metric,setMetric]=useState<'value'|'results'>('value');
 const hasResults=data.trend.some(p=>p.results!=null);
 const format=(v:number)=>metric==='results'?v.toLocaleString('en-US'):data.currency?new Intl.NumberFormat('en-US',{style:'currency',currency:data.currency,maximumFractionDigits:2}).format(v):`${v.toLocaleString('en-US')} (currency unknown)`;
 const points=[...data.trend].sort((a,b)=>a.day.localeCompare(b.day)).map(p=>({...p,label:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${p.day}T12:00:00Z`))}));
 return <><div className={classes.chartHeading}><strong>Daily {metric==='value'?'spend':'results'}</strong>{hasResults&&<div role="group" aria-label="Chart metric">{(['value','results'] as const).map(key=><button type="button" aria-pressed={metric===key} key={key} onClick={()=>setMetric(key)}>{key==='value'?'Spend':'Results'}</button>)}</div>}</div>
 <BarChart h={170} data={points} dataKey="label" series={[{name:metric,label:metric==='value'?'Spend':'Results',color:'blue.6'}]} withYAxis={false} yAxisProps={{domain:[0,'auto']}} xAxisProps={{tickLine:false,axisLine:false,minTickGap:8}} gridAxis="none" withLegend={false} valueFormatter={format} tooltipAnimationDuration={0} barProps={{isAnimationActive:false,radius:[3,3,0,0]}} aria-label={`Daily ${metric==='value'?'spend':'results'}. Missing observations are unavailable.`}/>
 <details className={classes.dataDetails}><summary>Accessible daily values</summary><table><caption>{metric==='value'?'Spend':'Results'}</caption><tbody>{points.map(p=><tr key={p.day}><th scope="row">{p.label}</th><td>{p[metric]==null?'Unavailable':format(p[metric]!)}</td></tr>)}</tbody></table></details></>;
}
export default function AssistantAnalytics({ blocks, hideDetails = false }: { blocks: unknown[]; hideDetails?: boolean }) {
 return <>{blocks.map((block,index)=>{const parsed=analyticsBlockSchema.safeParse(block);if(!parsed.success||parsed.data.kind==='creative')return null;const data=parsed.data;
 return <section className={classes.analyticsBlock} key={index} aria-label={data.title}>{data.kind==='trend'?<AssistantTrendChart data={data}/>:<><strong>{data.title}</strong><AssistantMetricStrip data={data}/></>}{data.status&&!blocks.slice(0,index).some(b=>analyticsBlockSchema.safeParse(b).data?.status===data.status)&&<p className={classes.visualStatus}>{data.status}</p>}{!hideDetails&&<details className={classes.dataDetails}><summary>Data details</summary><p>{data.scope}</p><p>{data.note}</p></details>}</section>;})}</>;
}
