import type {Presentation,Recap,SavedPresentation} from './model';
/** Keep the original immutable; a correction is a new saved report, never a new popup. */
export function recapRevision(previous:SavedPresentation,recap:Recap,syncedAt:string|null,now:string):Presentation|null{
 if(JSON.stringify(previous.payload.recap)===JSON.stringify(recap))return null;
 return {...previous.payload,revisionOf:previous.id,preparedAt:now,syncedAt,recap,limitations:[...previous.payload.limitations.filter(t=>!t.startsWith('Revised from saved update')),`Revised from saved update ${previous.id}. The original remains in history.`]};
}
