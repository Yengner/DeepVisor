import { Skeleton, Stack } from '@mantine/core';
import classes from './Product.module.css';
export default function SectionSkeleton({kind='activity'}:{kind?:'metrics'|'attention'|'activity'|'chart'}) {
  if(kind==='metrics') return <div className={classes.tiles} aria-label="Loading performance" aria-busy="true">{[0,1,2,3].map(i=><Skeleton key={i} height="100%" mih={120} radius={8}/>)}</div>;
  return <Stack gap={16} className={classes.skeleton} aria-label={`Loading ${kind}`} aria-busy="true"><Skeleton height={16} width="40%"/>{kind==='chart'?<Skeleton height={190}/>:kind==='attention'?<Skeleton height={180} radius={8}/>:<>{[0,1,2].map(i=><Skeleton key={i} height={40} radius={4}/>)}</>}</Stack>;
}
