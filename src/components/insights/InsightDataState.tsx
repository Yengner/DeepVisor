import {Clock3,Info} from 'lucide-react';
import type {CSSProperties,ReactNode} from 'react';
import styles from './InsightsView.module.css';

/** `gap` (amber) is for real missing data; `neutral` for observed facts such as a zero count. */
export function InsightDataNotice({title,children,hourly=false,tone='gap'}:{title:string;children:ReactNode;hourly?:boolean;tone?:'gap'|'neutral'}){
 const Icon=hourly?Clock3:Info;
 return <div className={styles.dataNotice} data-tone={tone} role="status"><Icon size={18} aria-hidden="true"/><div><strong>{title}</strong><p>{children}</p></div></div>;
}
/** An availability diagram, never a substitute for measured performance. */
export function MissingObservationTrack({hourly=false}:{hourly?:boolean}){
 return <div><div className={styles.missingTrack} style={{'--slots':hourly?24:7} as CSSProperties}><span>{hourly?'0 of 24 hour slots have data':'No performance observations available'}</span></div>{hourly&&<div className={styles.missingAxis} aria-hidden="true">{['12 AM','6 AM','12 PM','6 PM','11 PM'].map(label=><span key={label}>{label}</span>)}</div>}</div>;
}
