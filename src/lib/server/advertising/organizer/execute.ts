import type {RenameChange,RenameState} from '@/lib/shared/organizer/renamePlan';
import {sameState,sameIdentity} from '@/lib/shared/organizer/renamePlan';
export interface RenameAdapter {read(change:RenameChange):Promise<RenameState>;rename(change:RenameChange):Promise<void>;assertWritable():Promise<void>}
export type RenameEvent={entityId:string;kind:'intent'|'verified'|'blocked'|'uncertain'|'reconciled'|'unattempted';before:RenameState;after:RenameState|null;afterName:string;code:string|null};
export interface RenameAudit {append(event:RenameEvent):Promise<void>;finish(unresolved:boolean):Promise<void>}
/** Claim once before entering. Never resume this loop after a process interruption. */
export async function executeRenames(changes:RenameChange[],adapter:RenameAdapter,audit:RenameAudit){
 let unresolved=false;
 for(const change of changes){
  const base={entityId:change.entityId,before:change.before,afterName:change.afterName};
  try{await adapter.assertWritable();const current=await adapter.read(change);if(!sameState(current,change.before))throw new Error('STALE_STATE');}
  catch{await audit.append({...base,kind:'blocked',after:null,code:'REVALIDATION_FAILED'});continue;}
  // Failure to persist intent must abort the entire run before touching Meta.
  await audit.append({...base,kind:'intent',after:null,code:null});
  let after:RenameState|null=null;
  try{
   await adapter.assertWritable();await adapter.rename(change);after=await adapter.read(change);
   if(!sameIdentity(change.before,after)||after.name!==change.afterName)throw new Error('READBACK_MISMATCH');
  }catch{unresolved=true;await audit.append({...base,kind:'uncertain',after,code:'WRITE_OR_READBACK_UNCERTAIN'});continue;}
  // Audit failure after a successful write leaves intent and the durable lock intact.
  await audit.append({...base,kind:'verified',after,code:null});
 }
 await audit.finish(unresolved);
}
export async function reconcileRenames(changes:RenameChange[],events:RenameEvent[],adapter:RenameAdapter,audit:RenameAudit){
 let unresolved=false;
 for(const c of changes){
  const rows=events.filter(e=>e.entityId===c.entityId);const last=rows.at(-1);
  if(last&&['verified','reconciled','blocked','unattempted'].includes(last.kind))continue;
  const base={entityId:c.entityId,before:c.before,afterName:c.afterName};
  if(!rows.some(e=>e.kind==='intent')){await audit.append({...base,kind:'unattempted',after:null,code:'INTERRUPTED_BEFORE_WRITE'});continue;}
  try{const after=await adapter.read(c);if(!sameIdentity(c.before,after)||after.name!==c.afterName)throw new Error('UNRESOLVED');await audit.append({...base,kind:'reconciled',after,code:'TARGET_NAME_OBSERVED'});}
  catch{unresolved=true;}
 }
 await audit.finish(unresolved);
}
