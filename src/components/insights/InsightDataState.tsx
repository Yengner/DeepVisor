import {Clock3,Info} from 'lucide-react';
import {useLocale,useTranslations} from 'next-intl';
import type {CSSProperties,ReactNode} from 'react';
import styles from './InsightsView.module.css';

/** `gap` (amber) is for real missing data; `neutral` for observed facts such as a zero count. */
export function InsightDataNotice({title,children,hourly=false,tone='gap'}:{title:string;children:ReactNode;hourly?:boolean;tone?:'gap'|'neutral'}){
 const Icon=hourly?Clock3:Info;
 return <div className={styles.dataNotice} data-tone={tone} role="status"><Icon size={18} aria-hidden="true"/><div><strong>{title}</strong><p>{children}</p></div></div>;
}
/** An availability diagram, never a substitute for measured performance. */
export function MissingObservationTrack({hourly=false}:{hourly?:boolean}){
 const t=useTranslations('insights.chart');
 const intl=useLocale()==='es'?'es-US':'en-US';
 const hour=(h:number)=>new Intl.DateTimeFormat(intl,{hour:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(2000,0,1,h)));
 return <div><div className={styles.missingTrack} style={{'--slots':hourly?24:7} as CSSProperties}><span>{hourly?t('hourSlotsEmpty'):t('noObservations')}</span></div>{hourly&&<div className={styles.missingAxis} aria-hidden="true">{[0,6,12,18,23].map(h=><span key={h}>{hour(h)}</span>)}</div>}</div>;
}
